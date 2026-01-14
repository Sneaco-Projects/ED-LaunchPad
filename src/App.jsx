import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

import { AudioEngine } from './engine/AudioEngine';
import { getDemoProject } from './engine/demoProject';
import { buildCustomGridPads, buildMainGridPads } from './engine/buildPads';
import { PadState } from './ui/padStates';
import { TopBar } from './ui/TopBar';
import { LaunchpadGrid } from './ui/LaunchpadGrid';

const TEMPO_PRESETS = [90, 100, 160];

function snapTempoToPreset(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return TEMPO_PRESETS[1];
  let best = TEMPO_PRESETS[0];
  let bestDist = Math.abs(n - best);
  for (const preset of TEMPO_PRESETS) {
    const d = Math.abs(n - preset);
    if (d < bestDist) {
      best = preset;
      bestDist = d;
    }
  }
  return best;
}

const App = () => {
  const engineRef = useRef(null);

  const [project, setProject] = useState(() => getDemoProject());
  const [tempoPreset, setTempoPreset] = useState(() => snapTempoToPreset(project.global.bpm ?? 100));
  const [quantization, setQuantization] = useState(() => project.global.quantization ?? '1m');
  const [clipStatesById, setClipStatesById] = useState(() => new Map());
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioReady, setAudioReady] = useState(false);

  useEffect(() => {
    const engine = new AudioEngine({
      onClipStateChange: (clipId, state) => {
        setClipStatesById((prev) => {
          const next = new Map(prev);
          next.set(clipId, state);
          return next;
        });
      },
    });

    engineRef.current = engine;
    engine.loadProject(project);
    engine.setBpm(tempoPreset);
    engine.setTimeSignature(project.global.timeSignature ?? [4, 4]);
    engine.setQuantization(quantization);

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setBpm(tempoPreset);
  }, [tempoPreset]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setQuantization(quantization);
  }, [quantization]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.loadProject(project);
    engine.setTimeSignature(project.global.timeSignature ?? [4, 4]);
  }, [project]);

  const mainPads = useMemo(
    () => buildMainGridPads(project, clipStatesById),
    [project, clipStatesById]
  );

  const customPads = useMemo(
    () => buildCustomGridPads(project, clipStatesById),
    [project, clipStatesById]
  );

  const columnLabels = useMemo(() => {
    const labels = Array(project.grid.columns).fill('');
    for (const track of project.tracks) {
      labels[track.column] = track.name;
    }
    return labels;
  }, [project]);

  const columnColors = useMemo(() => {
    const colors = Array(project.grid.columns).fill('#57606f');
    for (const track of project.tracks) {
      colors[track.column] = track.color ?? '#57606f';
    }
    return colors;
  }, [project]);

  const mainColumnActivity = useMemo(() => {
    const activity = Array(project.grid.columns).fill('idle');

    for (const track of project.tracks) {
      const col = track.column;
      let hasPlayingLoop = false;
      let hasQueuedLoop = false;

      for (const clip of track.clips) {
        if (clip.type !== 'loop') continue;
        const st = clipStatesById.get(clip.id);
        if (st === 'playing') hasPlayingLoop = true;
        if (st === 'queued') hasQueuedLoop = true;
      }

      activity[col] = hasPlayingLoop && hasQueuedLoop ? 'switching' : hasPlayingLoop ? 'playing' : hasQueuedLoop ? 'queued' : 'idle';
    }

    return activity;
  }, [project, clipStatesById]);

  const customColumnActivity = useMemo(() => {
    const cols = project.customGrid.columns;
    const activity = Array(cols).fill('idle');

    for (let col = 0; col < cols; col++) {
      let hasPlaying = false;
      let hasQueued = false;

      for (const clip of project.customClips) {
        if (clip.column !== col) continue;
        if (clip.type !== 'loop') continue;
        const st = clipStatesById.get(clip.id);
        if (st === 'playing') hasPlaying = true;
        if (st === 'queued') hasQueued = true;
      }

      activity[col] = hasPlaying && hasQueued ? 'switching' : hasPlaying ? 'playing' : hasQueued ? 'queued' : 'idle';
    }

    return activity;
  }, [project, clipStatesById]);

  const ensureAudioReady = async () => {
    if (audioReady) return true;
    const engine = engineRef.current;
    if (!engine) return false;
    try {
      await engine.initAudio();
      setAudioReady(true);
      return true;
    } catch {
      return false;
    }
  };

  const handleToggleTransport = async () => {
    const engine = engineRef.current;
    if (!engine) return;
    const ok = await ensureAudioReady();
    if (!ok) return;

    if (engine.isTransportRunning()) {
      engine.stopTransport();
      setIsPlaying(false);
      setClipStatesById(new Map());
    } else {
      engine.startTransport();
      setIsPlaying(true);
    }
  };

  const handlePadClick = async (clipId) => {
    const engine = engineRef.current;
    if (!engine) return;
    const ok = await ensureAudioReady();
    if (!ok) return;

    // Auto-start transport so quantized scheduling works.
    if (!engine.isTransportRunning()) {
      engine.startTransport();
      setIsPlaying(true);
    }

    engine.triggerClip(clipId);
  };

  // Ensure empty clip states default to idle.
  useEffect(() => {
    setClipStatesById((prev) => {
      const next = new Map(prev);
      for (const track of project.tracks) {
        for (const clip of track.clips) {
          if (!next.has(clip.id)) next.set(clip.id, PadState.idle);
        }
      }
      for (const clip of project.customClips) {
        if (!next.has(clip.id)) next.set(clip.id, PadState.idle);
      }
      return next;
    });
  }, [project]);

  return (
    <div className="lp-app">
      <TopBar
        tempoPreset={tempoPreset}
        quantization={quantization}
        isPlaying={isPlaying}
        onToggleTransport={handleToggleTransport}
        onTempoPresetChange={(next) => setTempoPreset(snapTempoToPreset(next))}
        onQuantizationChange={setQuantization}
      />

      <main className="lp-main">
        <LaunchpadGrid
          title={project.name}
          columns={project.grid.columns}
          rows={project.grid.rows}
          pads={mainPads}
          onPadClick={handlePadClick}
          columnLabels={columnLabels}
          columnColors={columnColors}
          columnActivity={mainColumnActivity}
          variant="main"
        />

        <LaunchpadGrid
          title={project.customGrid.label ?? 'Custom Clips'}
          columns={project.customGrid.columns}
          rows={project.customGrid.rows}
          pads={customPads}
          onPadClick={handlePadClick}
          columnLabels={Array(project.customGrid.columns).fill('')}
          columnColors={Array(project.customGrid.columns).fill('#2f3542')}
          columnActivity={customColumnActivity}
          variant="custom"
        />
      </main>

    </div>
  );
};

export default App;
