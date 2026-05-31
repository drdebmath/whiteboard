const { useState, useRef, useEffect, useCallback } = React;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const __TWEAKS_STYLE = `
  .tw-panel {
    position: fixed;
    top: 60px;
    right: 20px;
    width: 320px;
    max-height: calc(100vh - 100px);
    background: rgba(22, 22, 30, 0.82);
    backdrop-filter: blur(24px) saturate(1.4);
    -webkit-backdrop-filter: blur(24px) saturate(1.4);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    color: #e4e4e7;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif;
    font-size: 13px;
    z-index: 99999;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45), 0 0 0 0.5px rgba(255, 255, 255, 0.05) inset;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    user-select: none;
  }

  .tw-panel--hidden { display: none; }

  .tw-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px 10px;
    cursor: grab;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .tw-header:active { cursor: grabbing; }

  .tw-title {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: #f4f4f5;
  }

  .tw-close {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: none;
    background: rgba(255, 255, 255, 0.06);
    color: #a1a1aa;
    font-size: 14px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .tw-close:hover {
    background: rgba(239, 68, 68, 0.25);
    color: #f87171;
  }

  .tw-body {
    overflow-y: auto;
    padding: 6px 0;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
  }

  .tw-body::-webkit-scrollbar { width: 5px; }
  .tw-body::-webkit-scrollbar-track { background: transparent; }
  .tw-body::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }

  /* Section */
  .tw-section {
    padding: 10px 14px 4px;
  }

  .tw-section + .tw-section {
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .tw-section-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #71717a;
    margin-bottom: 6px;
  }

  /* Row */
  .tw-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 0;
    min-height: 32px;
  }

  .tw-row-label {
    font-size: 13px;
    color: #d4d4d8;
    flex-shrink: 0;
    margin-right: 10px;
  }

  .tw-row-value {
    font-size: 12px;
    color: #71717a;
    flex-shrink: 0;
    min-width: 42px;
    text-align: right;
    margin-left: 8px;
    font-variant-numeric: tabular-nums;
  }

  /* Slider */
  .tw-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 120px;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.1);
    outline: none;
    cursor: pointer;
  }

  .tw-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #a78bfa;
    border: 2px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    transition: transform 0.12s ease;
  }

  .tw-slider::-webkit-slider-thumb:hover {
    transform: scale(1.15);
  }

  .tw-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #a78bfa;
    border: 2px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    cursor: pointer;
  }

  /* Toggle */
  .tw-toggle {
    position: relative;
    width: 36px;
    height: 20px;
    flex-shrink: 0;
  }

  .tw-toggle input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }

  .tw-toggle-track {
    position: absolute;
    inset: 0;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.12);
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .tw-toggle-track::after {
    content: '';
    position: absolute;
    left: 2px;
    top: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #a1a1aa;
    transition: transform 0.2s ease, background 0.2s ease;
  }

  .tw-toggle input:checked + .tw-toggle-track {
    background: rgba(167, 139, 250, 0.4);
  }

  .tw-toggle input:checked + .tw-toggle-track::after {
    transform: translateX(16px);
    background: #a78bfa;
  }

  /* Radio / Segmented */
  .tw-radio-group {
    display: flex;
    gap: 2px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: 2px;
    flex-shrink: 0;
  }

  .tw-radio-btn {
    padding: 4px 10px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: #a1a1aa;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    white-space: nowrap;
  }

  .tw-radio-btn:hover {
    color: #d4d4d8;
  }

  .tw-radio-btn--active {
    background: rgba(167, 139, 250, 0.3);
    color: #e4e4e7;
  }

  /* Select */
  .tw-select {
    padding: 4px 24px 4px 8px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.06);
    color: #d4d4d8;
    font-size: 12px;
    font-family: inherit;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
    outline: none;
    background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2371717a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    flex-shrink: 0;
    max-width: 140px;
  }

  .tw-select:focus {
    border-color: rgba(167, 139, 250, 0.4);
  }

  .tw-select option {
    background: #1c1c24;
    color: #d4d4d8;
  }

  /* Inject helper */
  .tw-inject-anchor { display: none; }
`;

// Inject style once
(function injectTweaksStyle() {
  if (document.getElementById('__tweaks-style')) return;
  const el = document.createElement('style');
  el.id = '__tweaks-style';
  el.textContent = __TWEAKS_STYLE;
  document.head.appendChild(el);
})();

// ---------------------------------------------------------------------------
// useTweaks hook
// ---------------------------------------------------------------------------

function useTweaks(defaults) {
  const [values, setValues] = useState(() => {
    try {
      const key = 'tw_' + (defaults.__key || '__default');
      const stored = localStorage.getItem(key);
      return stored ? { ...defaults, ...JSON.parse(stored) } : { ...defaults };
    } catch {
      return { ...defaults };
    }
  });

  const setTweak = useCallback((patch, val) => {
    if (typeof patch === 'object' && patch !== null) {
      setValues(prev => {
        const next = { ...prev, ...patch };
        try {
          const key = 'tw_' + (defaults.__key || '__default');
          const { __key, ...rest } = next;
          localStorage.setItem(key, JSON.stringify(rest));
        } catch {}
        return next;
      });
    } else if (typeof patch === 'string') {
      setValues(prev => {
        const next = { ...prev, [patch]: val };
        try {
          const key = 'tw_' + (defaults.__key || '__default');
          const { __key, ...rest } = next;
          localStorage.setItem(key, JSON.stringify(rest));
        } catch {}
        return next;
      });
    }
  }, [defaults]);

  return [values, setTweak];
}

// ---------------------------------------------------------------------------
// TweaksPanel
// ---------------------------------------------------------------------------

function TweaksPanel({ title = 'Tweaks', children }) {
  const [hidden, setHidden] = useState(true);
  const panelRef = useRef(null);
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  // Keyboard shortcut to toggle
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        setHidden(h => !h);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Global toggle API
  useEffect(() => {
    window.__toggleTweaksPanel = () => setHidden(h => !h);
    return () => { delete window.__toggleTweaksPanel; };
  }, []);

  const onPointerDown = useCallback((e) => {
    const panel = panelRef.current;
    if (!panel) return;
    if (e.target.closest('.tw-close')) return;

    const rect = panel.getBoundingClientRect();
    const d = dragRef.current;
    d.dragging = true;
    d.startX = e.clientX;
    d.startY = e.clientY;
    d.origX = rect.left;
    d.origY = rect.top;

    panel.style.transition = 'none';

    const onMove = (ev) => {
      if (!d.dragging) return;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      panel.style.left = (d.origX + dx) + 'px';
      panel.style.top = (d.origY + dy) + 'px';
      panel.style.right = 'auto';
    };

    const onUp = () => {
      d.dragging = false;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, []);

  return (
    <>
      <button
        className="tw-fab"
        onClick={() => setHidden(false)}
        title="Open Tweaks (⌘⇧T)"
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          width: 40,
          height: 40,
          borderRadius: 12,
          border: '1px solid var(--line)',
          background: 'var(--panel-bg)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          color: 'var(--accent)',
          fontSize: 18,
          cursor: 'pointer',
          zIndex: 99998,
          display: hidden ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--panel-shadow)',
        }}
      >
        ⚙
      </button>

      <div
        ref={panelRef}
        className={`tw-panel ${hidden ? 'tw-panel--hidden' : ''}`}
        onPointerDown={onPointerDown}
      >
        <div className="tw-header">
          <span className="tw-title">{title}</span>
          <button className="tw-close" onClick={() => setHidden(true)} title="Close">
            ✕
          </button>
        </div>
        <div className="tw-body">
          {children}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// TweakSection
// ---------------------------------------------------------------------------

function TweakSection({ label, children }) {
  return (
    <div className="tw-section">
      {label && <div className="tw-section-label">{label}</div>}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TweakRow
// ---------------------------------------------------------------------------

function TweakRow({ label, value, children }) {
  return (
    <div className="tw-row">
      {label && <span className="tw-row-label">{label}</span>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {children}
        {value != null && <span className="tw-row-value">{value}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TweakSlider
// ---------------------------------------------------------------------------

function TweakSlider({ label, value, min = 0, max = 100, step = 1, unit = '', onChange }) {
  const display = typeof value === 'number'
    ? (Number.isInteger(step) ? value : value.toFixed(step < 1 ? String(step).split('.')[1].length : 0))
    : value;

  return (
    <TweakRow label={label} value={display != null ? `${display}${unit || ''}` : undefined}>
      <input
        type="range"
        className="tw-slider"
        min={min}
        max={max}
        step={step}
        value={value ?? 0}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </TweakRow>
  );
}

// ---------------------------------------------------------------------------
// TweakToggle
// ---------------------------------------------------------------------------

function TweakToggle({ label, value, onChange }) {
  return (
    <TweakRow label={label}>
      <label className="tw-toggle">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="tw-toggle-track" />
      </label>
    </TweakRow>
  );
}

// ---------------------------------------------------------------------------
// TweakRadio
// ---------------------------------------------------------------------------

const TW_RADIO_MAX = 5;

function TweakRadio({ label, value, options, onChange }) {
  // options: [{ value, label }] or ['a','b','c']
  const normalized = Array.isArray(options)
    ? options.map(o => typeof o === 'string' ? { value: o, label: o } : o)
    : [];

  if (normalized.length > TW_RADIO_MAX) {
    return (
      <TweakRow label={label}>
        <TweakSelect value={value} options={options} onChange={onChange} />
      </TweakRow>
    );
  }

  return (
    <TweakRow label={label}>
      <div className="tw-radio-group">
        {normalized.map((opt) => (
          <button
            key={opt.value}
            className={`tw-radio-btn ${opt.value === value ? 'tw-radio-btn--active' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </TweakRow>
  );
}

// ---------------------------------------------------------------------------
// TweakSelect
// ---------------------------------------------------------------------------

function TweakSelect({ label, value, options, onChange }) {
  const normalized = Array.isArray(options)
    ? options.map(o => typeof o === 'string' ? { value: o, label: o } : o)
    : [];

  const select = (
    <select
      className="tw-select"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    >
      {normalized.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );

  return label ? <TweakRow label={label}>{select}</TweakRow> : select;
}

// ---------------------------------------------------------------------------
// Expose to window
// ---------------------------------------------------------------------------

Object.assign(window, {
  useTweaks, TweaksPanel, TweakSection, TweakRow,
  TweakSlider, TweakToggle, TweakRadio, TweakSelect,
});
