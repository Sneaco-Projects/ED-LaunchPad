import React from 'react';
import { GamePhase } from './padStates';

export function TopBar({
  isPlaying,
  onToggleTransport,
  appMode = 'freestyle',
  onModeChange,
  gamePhase = GamePhase.inactive,
  gameLevel = 1,
  gameScore = 0,
  onStartGame,
  onResetGame,
  isRecording = false,
  onToggleRecord,
  onShowTutorial,
}) {
  const isGameMode = appMode === 'game';

  return (
    <header className="lp-topbar">
      {/* ── LEFT: Brand + Mode Toggle + Mode Label ── */}
      <div className="lp-topbar__left">
        <img src="/icons/icon-32.png" alt="Rebeat" className="lp-logo" />
        <span className="lp-brand">Rebeat</span>

        <div className="lp-mode-toggle">
          <button
            type="button"
            className={`lp-mode-btn ${!isGameMode ? 'lp-mode-btn--active' : ''}`}
            onClick={() => onModeChange?.('freestyle')}
          >
            Freestyle
          </button>
          <button
            type="button"
            className={`lp-mode-btn lp-mode-btn--game ${isGameMode ? 'lp-mode-btn--active lp-mode-btn--game-active' : ''}`}
            onClick={() => onModeChange?.('game')}
          >
            Game
          </button>
        </div>

        <span className="lp-mode-label">
          MODE: <strong>{appMode.toUpperCase()}</strong>
        </span>
      </div>

      {/* ── CENTER: Transport Controls ── */}
      <div className="lp-topbar__center">
        {!isGameMode ? (
          <>
            <button
              className="lp-btn lp-btn--transport"
              type="button"
              onClick={onToggleTransport}
            >
              {isPlaying ? 'Stop' : 'Play'}
            </button>
            <button
              className={`lp-btn lp-btn--record ${isRecording ? 'lp-btn--record-active' : ''}`}
              type="button"
              onClick={onToggleRecord}
            >
              <span className="lp-record-dot" />
              Record
            </button>
          </>
        ) : (
          <>
            {gamePhase === GamePhase.ready && (
              <button className="lp-btn lp-btn--game-start" type="button" onClick={onStartGame}>
                Start Game
              </button>
            )}
            {gamePhase === GamePhase.demonstrating && (
              <div className="lp-game-status lp-game-status--demo">Watch the sequence…</div>
            )}
            {gamePhase === GamePhase.waitingForInput && (
              <div className="lp-game-status lp-game-status--input">Your turn!</div>
            )}
            {gamePhase === GamePhase.success && (
              <div className="lp-game-status lp-game-status--success">Level Complete!</div>
            )}
            {gamePhase === GamePhase.gameOver && (
              <>
                <div className="lp-game-status lp-game-status--gameover">Game Over!</div>
                <button className="lp-btn lp-btn--game-reset" type="button" onClick={onResetGame}>
                  Play Again
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* ── RIGHT: Game HUD (Level + Score + Tutorial) ── */}
      <div className="lp-topbar__right">
        {isGameMode && (
          <div className="lp-game-stats">
            <div className="lp-game-stat">
              <span className="lp-game-stat__label">LEVEL</span>
              <span className="lp-game-stat__value">{gameLevel}</span>
            </div>
            <div className="lp-game-stat">
              <span className="lp-game-stat__label">SCORE</span>
              <span className="lp-game-stat__value">{gameScore}</span>
            </div>
            <button
              className="lp-btn lp-btn--tutorial"
              type="button"
              onClick={onShowTutorial}
            >
              <span className="lp-tutorial-icon">?</span>
              Tutorial
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
