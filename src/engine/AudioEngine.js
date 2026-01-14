import * as Tone from 'tone';
import { createGeneratedLoop, playGeneratedOneShot } from '../audio/generatedClips';
import { nextQuantizedTick, parseQuantizationToTicks } from './quantization';

const LOOP_STOP_FADE_SECONDS = 0.03;
const LOOP_START_FADE_SECONDS = 0.01;

function clampNumber(value, { min, max }) {
  const n = Number(value);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export class AudioEngine {
  constructor({ onClipStateChange } = {}) {
    this._onClipStateChange = onClipStateChange ?? (() => {});

    this._master = new Tone.Gain(0.9);
    this._limiter = new Tone.Limiter(-1);
    this._master.chain(this._limiter, Tone.Destination);

    this._project = null;
    this._quantization = '1m';

    this._clipIndex = new Map(); // clipId -> { clip, column, isCustom }
    this._loopNodesByClipId = new Map(); // clipId -> { node, output }
    this._loopGainsByClipId = new Map();

    this._activeLoopByColumn = new Map(); // column -> clipId
    this._queuedLoopByColumn = new Map(); // column -> clipId
    this._scheduledEventIds = new Set();
  }

  dispose() {
    for (const id of this._scheduledEventIds) {
      try {
        Tone.Transport.clear(id);
      } catch {
        // ignore
      }
    }
    this._scheduledEventIds.clear();

    for (const { node } of this._loopNodesByClipId.values()) {
      try {
        node.stop(0);
      } catch {
        // ignore
      }
      try {
        node.dispose();
      } catch {
        // ignore
      }
    }
    this._loopNodesByClipId.clear();
    for (const gain of this._loopGainsByClipId.values()) {
      try {
        gain.dispose();
      } catch {
        // ignore
      }
    }
    this._loopGainsByClipId.clear();

    this._clipIndex.clear();
    this._activeLoopByColumn.clear();
    this._queuedLoopByColumn.clear();

    try {
      this._master.dispose();
      this._limiter.dispose();
    } catch {
      // ignore
    }
  }

  async initAudio() {
    // Must be called from a user gesture.
    await Tone.start();
  }

  setBpm(bpm) {
    const next = clampNumber(bpm, { min: 40, max: 200 });
    Tone.Transport.bpm.value = next;
  }

  setTimeSignature([num, den]) {
    const numerator = clampNumber(num, { min: 1, max: 12 });
    // Tone.js timeSignature is numerator, assumes quarter note beat.
    Tone.Transport.timeSignature = numerator;
    // Denominator is kept in project but not used here.
    void den;
  }

  setQuantization(q) {
    this._quantization = q ?? '1m';
  }

  getQuantization() {
    return this._quantization;
  }

  loadProject(project) {
    this._project = project;

    this._clipIndex.clear();
    this._loopNodesByClipId.clear();
    this._activeLoopByColumn.clear();
    this._queuedLoopByColumn.clear();

    for (const track of project.tracks) {
      for (const clip of track.clips) {
        this._clipIndex.set(clip.id, { clip, column: track.column, isCustom: false, track });
      }
    }

    for (const clip of project.customClips) {
      // custom clips use their own (custom) column index, but quantization rules are same.
      this._clipIndex.set(clip.id, { clip, column: clip.column, isCustom: true, track: null });
    }

    // Pre-create loop nodes to avoid first-trigger gaps.
    for (const { clip } of this._clipIndex.values()) {
      if (clip.type !== 'loop') continue;

      const node = this._createLoopNode(clip);
      this._loopNodesByClipId.set(clip.id, node);
    }
  }

  startTransport() {
    if (Tone.Transport.state !== 'started') {
      Tone.Transport.start();
    }
  }

  stopTransport() {
    Tone.Transport.stop();
    Tone.Transport.position = 0;

    for (const id of this._scheduledEventIds) {
      try {
        Tone.Transport.clear(id);
      } catch {
        // ignore
      }
    }
    this._scheduledEventIds.clear();

    // Clear active state (but keep nodes loaded).
    for (const [column, clipId] of this._activeLoopByColumn.entries()) {
      this._setClipState(clipId, 'idle');
      void column;
    }
    for (const clipId of this._queuedLoopByColumn.values()) {
      this._setClipState(clipId, 'idle');
    }

    this._activeLoopByColumn.clear();
    this._queuedLoopByColumn.clear();
  }

  isTransportRunning() {
    return Tone.Transport.state === 'started';
  }

  triggerClip(clipId) {
    const entry = this._clipIndex.get(clipId);
    if (!entry) return;

    const { clip, column } = entry;

    if (clip.type === 'stop') {
      this.stopColumn(column);
      return;
    }

    if (clip.type === 'oneShot') {
      this._triggerOneShot(clip);
      return;
    }

    if (clip.type === 'loop') {
      this._triggerLoop(clip, column);
    }
  }

  stopColumn(column) {
    const active = this._activeLoopByColumn.get(column);
    const queued = this._queuedLoopByColumn.get(column);

    // Always let loops finish the bar when stopping.
    const tick = this._nextTick('1m');

    if (queued) {
      this._queuedLoopByColumn.delete(column);
      this._setClipState(queued, 'idle');
    }

    if (active) {
      this._scheduleAtTick(tick, ({ audioTime, transportTick }) => {
        this._stopLoopAt(active, { audioTime, transportTick });
        this._activeLoopByColumn.delete(column);
      });
    }
  }

  // --- Internals ---

  _nextTick(quantizationOverride) {
    const now = Tone.Transport.ticks;
    const qTicks = parseQuantizationToTicks(quantizationOverride ?? this._quantization);
    return nextQuantizedTick({ nowTicks: now, quantizationTicks: qTicks, strictlyFuture: true });
  }

  _scheduleAtTick(tick, fn) {
    const transportTime = Tone.Ticks(tick);
    const id = Tone.Transport.scheduleOnce((audioTime) => fn({ audioTime, transportTick: tick }), transportTime);
    this._scheduledEventIds.add(id);
    return id;
  }

  _setClipState(clipId, state) {
    this._onClipStateChange(clipId, state);
  }

  _createLoopNode(clip) {
    const loopEnd = '1m';

    const gain = new Tone.Gain(1);
    gain.connect(this._master);
    this._loopGainsByClipId.set(clip.id, gain);

    if (clip.source?.kind === 'generated') {
      const node = createGeneratedLoop(clip.source.generator, { loopEnd });
      node.output.connect(gain);
      return {
        node: {
          start: ({ transportTick, audioTime }) => {
            const transportTime = Tone.Ticks(transportTick);
            gain.gain.setValueAtTime(0, audioTime);
            gain.gain.rampTo(1, LOOP_START_FADE_SECONDS, audioTime);
            node.start(transportTime);
          },
          stop: ({ transportTick, audioTime }) => {
            const transportTime = Tone.Ticks(transportTick);
            gain.gain.rampTo(0, LOOP_STOP_FADE_SECONDS, audioTime);
            node.stop(transportTime);
          },
          dispose: () => {
            node.dispose();
          },
        },
      };
    }

    if (clip.source?.kind === 'url') {
      const player = new Tone.Player(clip.source.url);
      player.loop = true;
      player.autostart = false;
      player.connect(gain);

      // Sync loop players to the transport so transport stop/pause works.
      player.sync();

      return {
        node: {
          start: ({ transportTick, audioTime }) => {
            const transportTime = Tone.Ticks(transportTick);
            try {
              player.stop(transportTime);
            } catch {
              // ignore
            }
            gain.gain.setValueAtTime(0, audioTime);
            gain.gain.rampTo(1, LOOP_START_FADE_SECONDS, audioTime);
            player.start(transportTime);
          },
          stop: ({ transportTick, audioTime }) => {
            const transportTime = Tone.Ticks(transportTick);
            gain.gain.rampTo(0, LOOP_STOP_FADE_SECONDS, audioTime);
            try {
              player.stop(transportTime);
            } catch {
              // ignore
            }
          },
          dispose: () => player.dispose(),
        },
      };
    }

    // Fallback: silent generated loop.
    const node = createGeneratedLoop('default', { loopEnd });
    node.output.connect(gain);
    return {
      node: {
        start: ({ transportTick, audioTime }) => {
          const transportTime = Tone.Ticks(transportTick);
          gain.gain.setValueAtTime(0, audioTime);
          gain.gain.rampTo(1, LOOP_START_FADE_SECONDS, audioTime);
          node.start(transportTime);
        },
        stop: ({ transportTick, audioTime }) => {
          const transportTime = Tone.Ticks(transportTick);
          gain.gain.rampTo(0, LOOP_STOP_FADE_SECONDS, audioTime);
          node.stop(transportTime);
        },
        dispose: () => node.dispose(),
      },
    };
  }

  _triggerOneShot(clip) {
    const tick = this._nextTick();
    this._setClipState(clip.id, 'queued');

    this._scheduleAtTick(tick, ({ audioTime }) => {
      this._setClipState(clip.id, 'playing');

      if (clip.source?.kind === 'generated') {
        playGeneratedOneShot(clip.source.generator, { destination: this._master, time: audioTime });
      } else if (clip.source?.kind === 'url') {
        const player = new Tone.Player(clip.source.url).connect(this._master);
        player.start(audioTime);
        window.setTimeout(() => player.dispose(), 2500);
      }

      const bars = typeof clip.source?.bars === 'number' ? clip.source.bars : 0.5;
      const barSeconds = Tone.Time('1m').toSeconds();
      const durationMs = Math.max(120, Math.floor(bars * barSeconds * 1000));
      window.setTimeout(() => this._setClipState(clip.id, 'idle'), durationMs);
    });
  }

  _stopLoopAt(clipId, { transportTick, audioTime }) {
    const loop = this._loopNodesByClipId.get(clipId);
    if (!loop) return;
    try {
      loop.node.stop({ transportTick, audioTime });
    } catch {
      // ignore
    }
    this._setClipState(clipId, 'idle');
  }

  _startLoopAt(clipId, { transportTick, audioTime }) {
    const loop = this._loopNodesByClipId.get(clipId);
    if (!loop) return;
    try {
      loop.node.start({ transportTick, audioTime });
    } catch {
      // ignore
    }
    this._setClipState(clipId, 'playing');
  }

  _triggerLoop(clip, column) {
    const active = this._activeLoopByColumn.get(column);
    const queued = this._queuedLoopByColumn.get(column);

    // Toggle off if same loop is active (schedule stop at quantization).
    if (active === clip.id) {
      // Always finish the bar before stopping.
      const tick = this._nextTick('1m');
      this._setClipState(clip.id, 'queued');
      this._scheduleAtTick(tick, ({ audioTime, transportTick }) => {
        this._stopLoopAt(clip.id, { audioTime, transportTick });
        this._activeLoopByColumn.delete(column);
      });
      return;
    }

    // Replace: clear previous queued loop.
    if (queued && queued !== clip.id) {
      this._setClipState(queued, 'idle');
    }

    this._queuedLoopByColumn.set(column, clip.id);
    this._setClipState(clip.id, 'queued');

    // If something is already active in this column, wait until the end of the bar
    // so the current loop finishes cleanly before switching.
    const tick = this._nextTick(active ? '1m' : undefined);

    this._scheduleAtTick(tick, ({ audioTime, transportTick }) => {
      const stillQueued = this._queuedLoopByColumn.get(column) === clip.id;
      if (!stillQueued) return;

      // Stop currently active loop at this boundary.
      const currentActive = this._activeLoopByColumn.get(column);
      if (currentActive && currentActive !== clip.id) {
        this._stopLoopAt(currentActive, { audioTime, transportTick });
      }

      this._queuedLoopByColumn.delete(column);
      this._activeLoopByColumn.set(column, clip.id);
      this._startLoopAt(clip.id, { audioTime, transportTick });
    });
  }
}
