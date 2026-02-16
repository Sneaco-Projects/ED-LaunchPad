import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

import { AudioEngine } from './engine/AudioEngine';
import { getDemoProject } from './engine/demoProject';
import { buildCustomGridPads, buildMainGridPads } from './engine/buildPads';
import { PadState, GamePhase } from './ui/padStates';
import { TopBar } from './ui/TopBar';
import { LaunchpadGrid } from './ui/LaunchpadGrid';

// Fixed tempo - 130 BPM
const FIXED_BPM = 130;
// Fixed quantization - always 1 bar
const FIXED_QUANTIZATION = '1m';

// Game configuration
const GAME_CONFIG = {
  demoHighlightMs: 800,    // How long each pad stays highlighted during demo
  demoGapMs: 200,          // Gap between demo notes (loops layer on top of each other)
  feedbackDurationMs: 400, // How long correct/incorrect feedback shows
  levelUpDelayMs: 2000,    // Delay before next level starts (2 seconds)
  gameOverDelayMs: 2000,   // Delay before allowing restart
};

const App = () => {
  const engineRef = useRef(null);

  // =========================================================================
  // CORE STATE (Freestyle Mode)
  // =========================================================================
  const [project, setProject] = useState(() => getDemoProject());
  const [clipStatesById, setClipStatesById] = useState(() => new Map());
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioReady, setAudioReady] = useState(false);

  // =========================================================================
  // GAME MODE STATE
  // =========================================================================
  const [appMode, setAppMode] = useState('freestyle'); // 'freestyle' | 'game'
  const [gamePhase, setGamePhase] = useState(GamePhase.inactive);
  const [gameLevel, setGameLevel] = useState(1);
  const [gameScore, setGameScore] = useState(0);
  const [gameSequence, setGameSequence] = useState([]); // Array of clipIds
  const [playerProgress, setPlayerProgress] = useState(0); // Index in sequence
  const [gameHighlightedPads, setGameHighlightedPads] = useState(new Set());
  const [gameFeedbackPads, setGameFeedbackPads] = useState(new Map());
  
  // Track playable clips for game selection
  const playableClipIds = useRef([]);
  
  // Ref to track if game sequence should be aborted
  const gameAbortRef = useRef(false);
  // Ref to track current game phase (avoid stale closures)
  const gamePhaseRef = useRef(GamePhase.inactive);
  
  // Keep ref in sync with state
  useEffect(() => {
    gamePhaseRef.current = gamePhase;
  }, [gamePhase]);

  // =========================================================================
  // ENGINE INITIALIZATION
  // =========================================================================
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
    engine.setBpm(FIXED_BPM);
    engine.setTimeSignature(project.global.timeSignature ?? [4, 4]);
    engine.setQuantization(FIXED_QUANTIZATION);

    // Cache playable clip IDs
    playableClipIds.current = engine.getPlayableClipIds();

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.loadProject(project);
    engine.setTimeSignature(project.global.timeSignature ?? [4, 4]);
    playableClipIds.current = engine.getPlayableClipIds();
  }, [project]);

  // =========================================================================
  // MEMOIZED UI DATA
  // =========================================================================
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

  // =========================================================================
  // AUDIO INITIALIZATION
  // =========================================================================
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

  // =========================================================================
  // FREESTYLE MODE HANDLERS
  // =========================================================================
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

  const handleFreestylePadClick = async (clipId) => {
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

  // =========================================================================
  // GAME MODE LOGIC
  // =========================================================================

  // Generate a new sequence for the current level
  const generateSequence = useCallback((level) => {
    const availableClips = playableClipIds.current;
    if (availableClips.length === 0) return [];
    
    const sequence = [];
    for (let i = 0; i < level; i++) {
      const randomClip = availableClips[Math.floor(Math.random() * availableClips.length)];
      sequence.push(randomClip);
    }
    return sequence;
  }, []);

  // Play the demonstration sequence
  const playDemoSequence = useCallback(async (sequence) => {
    const engine = engineRef.current;
    if (!engine) return;

    // Mark sequence as active
    gameAbortRef.current = false;
    setGamePhase(GamePhase.demonstrating);

    for (let i = 0; i < sequence.length; i++) {
      // Check if aborted
      if (gameAbortRef.current) {
        setGameHighlightedPads(new Set());
        return;
      }
      
      const clipId = sequence[i];
      
      // Highlight the pad
      setGameHighlightedPads(new Set([clipId]));
      
      // Play the full loop (fire-and-forget, layers on top of any playing loops)
      engine.playClipOverlay(clipId);
      
      // Keep highlight visible for a moment
      await new Promise(resolve => setTimeout(resolve, GAME_CONFIG.demoHighlightMs));
      
      // Check if aborted
      if (gameAbortRef.current) {
        setGameHighlightedPads(new Set());
        return;
      }
      
      // Clear highlight
      setGameHighlightedPads(new Set());
      
      // Gap before next note (unless last note)
      if (i < sequence.length - 1) {
        await new Promise(resolve => setTimeout(resolve, GAME_CONFIG.demoGapMs));
      }
    }

    // Check if aborted before switching to input
    if (gameAbortRef.current) return;

    // Delay then switch to input phase
    await new Promise(resolve => setTimeout(resolve, 400));
    
    if (!gameAbortRef.current) {
      setGamePhase(GamePhase.waitingForInput);
      setPlayerProgress(0);
    }
  }, []);

  // Start a new game
  const handleStartGame = useCallback(async () => {
    // Abort any running sequence
    gameAbortRef.current = true;
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const ok = await ensureAudioReady();
    if (!ok) return;

    // Stop any running transport
    const engine = engineRef.current;
    if (engine?.isTransportRunning()) {
      engine.stopTransport();
      setIsPlaying(false);
      setClipStatesById(new Map());
    }

    // Reset game state
    setGameLevel(1);
    setGameScore(0);
    setPlayerProgress(0);
    setGameFeedbackPads(new Map());
    setGameHighlightedPads(new Set());

    // Generate and play first sequence
    const sequence = generateSequence(1);
    setGameSequence(sequence);

    // Small delay then start demo
    await new Promise(resolve => setTimeout(resolve, 400));
    await playDemoSequence(sequence);
  }, [ensureAudioReady, generateSequence, playDemoSequence]);

  // Handle player input in game mode
  const handleGamePadClick = useCallback(async (clipId) => {
    // Use ref to check phase to avoid stale closure
    if (gamePhaseRef.current !== GamePhase.waitingForInput) return;

    const engine = engineRef.current;
    if (!engine) return;

    const expectedClipId = gameSequence[playerProgress];
    const isCorrect = clipId === expectedClipId;

    // Play the full loop (layers on top of any playing loops)
    engine.playClipOverlay(clipId);

    if (isCorrect) {
      // Show correct feedback
      setGameFeedbackPads(new Map([[clipId, 'correct']]));
      
      setTimeout(() => {
        setGameFeedbackPads(new Map());
      }, GAME_CONFIG.feedbackDurationMs);

      const newProgress = playerProgress + 1;
      setPlayerProgress(newProgress);

      // Check if sequence complete
      if (newProgress >= gameSequence.length) {
        // Level complete!
        setGamePhase(GamePhase.success);
        const levelScore = gameLevel * 10;
        setGameScore(prev => prev + levelScore);

        // Start next level after delay
        setTimeout(async () => {
          const nextLevel = gameLevel + 1;
          setGameLevel(nextLevel);
          setPlayerProgress(0);
          
          const newSequence = generateSequence(nextLevel);
          setGameSequence(newSequence);
          
          await playDemoSequence(newSequence);
        }, GAME_CONFIG.levelUpDelayMs);
      }
    } else {
      // Wrong! Game Over
      setGameFeedbackPads(new Map([[clipId, 'incorrect']]));
      setGamePhase(GamePhase.gameOver);

      // Clear feedback after delay
      setTimeout(() => {
        setGameFeedbackPads(new Map());
      }, GAME_CONFIG.gameOverDelayMs);
    }
  }, [gameSequence, playerProgress, gameLevel, generateSequence, playDemoSequence]);

  // Reset game to ready state
  const handleResetGame = useCallback(() => {
    // Abort any running sequence
    gameAbortRef.current = true;
    
    setGamePhase(GamePhase.ready);
    setGameLevel(1);
    setGameScore(0);
    setGameSequence([]);
    setPlayerProgress(0);
    setGameFeedbackPads(new Map());
    setGameHighlightedPads(new Set());
  }, []);

  // Handle mode change
  const handleModeChange = useCallback((mode) => {
    // Abort any running game sequence
    gameAbortRef.current = true;
    
    // Stop transport when switching modes
    const engine = engineRef.current;
    if (engine?.isTransportRunning()) {
      engine.stopTransport();
      setIsPlaying(false);
      setClipStatesById(new Map());
    }

    setAppMode(mode);
    
    if (mode === 'game') {
      setGamePhase(GamePhase.ready);
      setGameLevel(1);
      setGameScore(0);
      setGameSequence([]);
      setPlayerProgress(0);
    } else {
      setGamePhase(GamePhase.inactive);
    }
    
    setGameFeedbackPads(new Map());
    setGameHighlightedPads(new Set());
  }, []);

  // Unified pad click handler
  const handlePadClick = useCallback(async (clipId) => {
    if (appMode === 'game') {
      await handleGamePadClick(clipId);
    } else {
      await handleFreestylePadClick(clipId);
    }
  }, [appMode, handleGamePadClick, handleFreestylePadClick]);

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

  // Determine if input should be disabled
  const disableInput = appMode === 'game' && 
    (gamePhase === GamePhase.demonstrating || 
     gamePhase === GamePhase.success || 
     gamePhase === GamePhase.gameOver);

  return (
    <div className="lp-app">
      <TopBar
        isPlaying={isPlaying}
        onToggleTransport={handleToggleTransport}
        appMode={appMode}
        onModeChange={handleModeChange}
        gamePhase={gamePhase}
        gameLevel={gameLevel}
        gameScore={gameScore}
        onStartGame={handleStartGame}
        onResetGame={handleResetGame}
      />

      <main className="lp-main">
        <LaunchpadGrid
          title={appMode === 'game' ? `Memory Game - Level ${gameLevel}` : project.name}
          columns={project.grid.columns}
          rows={project.grid.rows}
          pads={mainPads}
          onPadClick={handlePadClick}
          columnLabels={columnLabels}
          columnColors={columnColors}
          columnActivity={appMode === 'freestyle' ? mainColumnActivity : Array(project.grid.columns).fill('idle')}
          variant="main"
          gameHighlightedPads={gameHighlightedPads}
          gameFeedbackPads={gameFeedbackPads}
          disableInput={disableInput}
        />

        <LaunchpadGrid
          title={project.customGrid.label ?? 'Custom Clips'}
          columns={project.customGrid.columns}
          rows={project.customGrid.rows}
          pads={customPads}
          onPadClick={handlePadClick}
          columnLabels={Array(project.customGrid.columns).fill('')}
          columnColors={Array(project.customGrid.columns).fill('#2f3542')}
          columnActivity={appMode === 'freestyle' ? customColumnActivity : Array(project.customGrid.columns).fill('idle')}
          variant="custom"
          gameHighlightedPads={gameHighlightedPads}
          gameFeedbackPads={gameFeedbackPads}
          disableInput={disableInput}
        />
      </main>
    </div>
  );
};

export default App;
