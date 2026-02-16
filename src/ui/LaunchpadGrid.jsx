import React from 'react';

function hexToRgbTriplet(hex) {
  if (typeof hex !== 'string') return '87,96,111';
  const normalized = hex.trim().replace('#', '');
  if (normalized.length === 3) {
    const r = parseInt(normalized[0] + normalized[0], 16);
    const g = parseInt(normalized[1] + normalized[1], 16);
    const b = parseInt(normalized[2] + normalized[2], 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return '87,96,111';
    return `${r},${g},${b}`;
  }
  if (normalized.length === 6) {
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return '87,96,111';
    return `${r},${g},${b}`;
  }
  return '87,96,111';
}

export function LaunchpadGrid({
  title,
  columns,
  rows,
  pads,
  onPadClick,
  columnLabels,
  columnColors,
  columnActivity,
  variant = 'main',
  // Game mode props
  gameHighlightedPads = new Set(), // Set of clipIds currently highlighted for demo
  gameFeedbackPads = new Map(),    // Map<clipId, 'correct' | 'incorrect'>
  disableInput = false,            // Disable pad clicks during demo phase
}) {
  return (
    <section className={`lp-section lp-section--${variant}`}>
      {title ? (
        <div className="lp-section__title">
          <h2>{title}</h2>
        </div>
      ) : null}

      <div
        className="lp-grid"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }).map((_, col) => (
          <div
            key={`colhdr-${col}`}
            className={`lp-colhdr lp-colhdr--${columnActivity?.[col] ?? 'idle'}`}
            style={{
              '--col': columnColors?.[col] ?? '#57606f',
              '--col-rgb': hexToRgbTriplet(columnColors?.[col] ?? '#57606f'),
            }}
          >
            <div className="lp-colhdr__dot" style={{ background: columnColors?.[col] ?? '#57606f' }} />
            <div className="lp-colhdr__label">{columnLabels?.[col] ?? `Col ${col + 1}`}</div>
          </div>
        ))}

        {Array.from({ length: columns * rows }).map((_, idx) => {
          const col = idx % columns;
          const row = Math.floor(idx / columns);
          const key = `${col}:${row}`;
          const pad = pads.get(key);

          // Determine pad state - check game states first
          let state = pad?.state ?? 'idle';
          const isGameHighlighted = pad && gameHighlightedPads.has(pad.id);
          const gameFeedback = pad ? gameFeedbackPads.get(pad.id) : null;
          
          // Game states override normal states
          if (gameFeedback === 'correct') {
            state = 'correct';
          } else if (gameFeedback === 'incorrect') {
            state = 'incorrect';
          } else if (isGameHighlighted) {
            state = 'demo';
          }

          const isStop = pad?.type === 'stop';
          const colColor = columnColors?.[col] ?? 'rgba(255,255,255,0.12)';
          const badge =
            pad && state === 'queued'
              ? pad.type === 'loop'
                ? 'NEXT'
                : pad.type === 'oneShot'
                  ? 'QUEUED'
                  : ''
              : '';

          // Build class names
          const padClasses = [
            'lp-pad',
            `lp-pad--${state}`,
            isStop ? 'lp-pad--stop' : '',
            disableInput ? 'lp-pad--disabled-input' : '',
          ].filter(Boolean).join(' ');

          return (
            <button
              key={key}
              type="button"
              className={padClasses}
              style={{
                '--col': colColor,
                '--col-rgb': hexToRgbTriplet(colColor),
                borderColor: colColor,
                background: isStop ? 'rgba(255,255,255,0.06)' : undefined,
              }}
              onClick={() => !disableInput && pad?.id && onPadClick(pad.id)}
              disabled={!pad || disableInput}
              title={pad?.name ?? ''}
            >
              <div className="lp-pad__label">
                <div className="lp-pad__name">{pad?.name ?? ''}</div>
                <div className="lp-pad__meta">{pad ? (isStop ? 'STOP' : pad.type) : ''}</div>
              </div>

              {badge ? <div className="lp-pad__badge">{badge}</div> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
