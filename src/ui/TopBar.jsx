import React from 'react';

export function TopBar({
  tempoPreset,
  quantization,
  isPlaying,
  onToggleTransport,
  onTempoPresetChange,
  onQuantizationChange,
}) {
  return (
    <header className="lp-topbar">
      <div className="lp-topbar__left">
        <div className="lp-brand">Launchpad</div>
      </div>

      <div className="lp-topbar__center">
        <button className="lp-btn" type="button" onClick={onToggleTransport}>
          {isPlaying ? 'Stop' : 'Play'}
        </button>

        <label className="lp-field">
          <span>Quantize</span>
          <select
            className="lp-select"
            value={quantization}
            onChange={(e) => onQuantizationChange(e.target.value)}
          >
            <option value="1m">1 bar</option>
            <option value="2n">1/2 bar</option>
            <option value="4n">1/4 bar</option>
            <option value="8n">1/8 bar</option>
            <option value="none">none</option>
          </select>
        </label>
      </div>

      <div className="lp-topbar__right">
        <label className="lp-field">
          <span>Tempo</span>
          <select
            className="lp-select"
            value={String(tempoPreset)}
            onChange={(e) => onTempoPresetChange(Number(e.target.value))}
          >
            <option value={90}>90</option>
            <option value={100}>100</option>
            <option value={160}>160</option>
          </select>
        </label>
      </div>
    </header>
  );
}
