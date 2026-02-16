import React from 'react';
import { GamePhase } from './padStates';

export function TopBar({
  isPlaying,
  onToggleTransport,
  // Game mode props
  appMode = 'freestyle',
  onModeChange,
  gamePhase = GamePhase.inactive,
  gameLevel = 1,
  gameScore = 0,
  onStartGame,
  onResetGame,
}) {
  const isGameMode = appMode === 'game';

  return (
    <header className="lp-topbar">
      <div className="lp-topbar__left">
        <div className="lp-brand">Launchpad</div>
        
        {/* Mode Toggle */}
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
            className={`lp-mode-btn ${isGameMode ? 'lp-mode-btn--active' : ''}`}
            onClick={() => onModeChange?.('game')}
          >
            Game
          </button>
        </div>
      </div>

      <div className="lp-topbar__center">
        {!isGameMode ? (
          // Freestyle Mode: Play/Stop button only
          <button className="lp-btn lp-btn--transport" type="button" onClick={onToggleTransport}>
            {isPlaying ? 'Stop' : 'Play'}
          </button>
        ) : (
          // Game Mode Controls
          <>
            {gamePhase === GamePhase.ready && (
              <button className="lp-btn lp-btn--game-start" type="button" onClick={onStartGame}>
                Start Game
              </button>
            )}
            
            {gamePhase === GamePhase.demonstrating && (
              <div className="lp-game-status lp-game-status--demo">
                Watch the sequence...
              </div>
            )}
            
            {gamePhase === GamePhase.waitingForInput && (
              <div className="lp-game-status lp-game-status--input">
                Your turn!
              </div>
            )}
            
            {gamePhase === GamePhase.success && (
              <div className="lp-game-status lp-game-status--success">
                Level Complete!
              </div>
            )}
            
            {gamePhase === GamePhase.gameOver && (
              <>
                <div className="lp-game-status lp-game-status--gameover">
                  Game Over!
                </div>
                <button className="lp-btn lp-btn--game-reset" type="button" onClick={onResetGame}>
                  Play Again
                </button>
              </>
            )}
          </>
        )}
      </div>

      <div className="lp-topbar__right">
        {isGameMode && (
          // Game Mode: Level and Score display
          <div className="lp-game-stats">
            <div className="lp-game-stat">
              <span className="lp-game-stat__label">Level</span>
              <span className="lp-game-stat__value">{gameLevel}</span>
            </div>
            <div className="lp-game-stat">
              <span className="lp-game-stat__label">Score</span>
              <span className="lp-game-stat__value">{gameScore}</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
