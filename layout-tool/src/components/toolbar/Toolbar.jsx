import useLayoutStore from '../../store/useLayoutStore';

const GRID_SCALE_OPTIONS = [0.5, 1, 2, 5, 10];

export default function Toolbar({ onBack, saveStatus }) {
  const projectName = useLayoutStore((s) => s.projectName);
  const showDimensions = useLayoutStore((s) => s.showDimensions);
  const showGrid = useLayoutStore((s) => s.showGrid);
  const gridDivisionFt = useLayoutStore((s) => s.gridDivisionFt);
  const toggleDimensions = useLayoutStore((s) => s.toggleDimensions);
  const toggleGrid = useLayoutStore((s) => s.toggleGrid);
  const setGridDivisionFt = useLayoutStore((s) => s.setGridDivisionFt);
  const undo = useLayoutStore((s) => s.undo);
  const redo = useLayoutStore((s) => s.redo);
  const canUndo = useLayoutStore((s) => s.past.length > 0);
  const canRedo = useLayoutStore((s) => s.future.length > 0);

  const buttonStyle = (enabled) => ({
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 3,
    color: enabled ? 'white' : 'rgba(255,255,255,0.3)',
    fontSize: 14,
    padding: '2px 8px',
    cursor: enabled ? 'pointer' : 'default',
    outline: 'none',
    opacity: enabled ? 1 : 0.5,
  });

  return (
    <div
      style={{
        height: 36,
        background: '#1B3557',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 16,
        borderBottom: '1px solid rgba(0,0,0,0.2)',
        flexShrink: 0,
        fontFamily: "'DM Mono', monospace",
      }}
    >
      {onBack && (
        <button
          onClick={onBack}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 3,
            color: 'rgba(255,255,255,0.7)',
            fontSize: 11,
            padding: '2px 10px',
            cursor: 'pointer',
            outline: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          title="Back to Layouts"
        >
          <span style={{ fontSize: 12 }}>&larr;</span>
          Layouts
        </button>
      )}
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>
        {projectName.toUpperCase()}
      </span>
      {saveStatus && (
        <span
          style={{
            fontSize: 9,
            color: saveStatus === 'error' ? '#FF6B35' : 'rgba(255,255,255,0.3)',
            fontStyle: 'italic',
          }}
        >
          {saveStatus === 'saving' && 'Saving...'}
          {saveStatus === 'saved' && 'Saved'}
          {saveStatus === 'error' && 'Save failed'}
        </span>
      )}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={undo}
          disabled={!canUndo}
          style={buttonStyle(canUndo)}
          title="Undo (Ctrl+Z)"
        >
          &#x21A9;
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          style={buttonStyle(canRedo)}
          title="Redo (Ctrl+Y)"
        >
          &#x21AA;
        </button>
      </div>
      <span style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
        {showGrid ? `1 div = ${gridDivisionFt} ft \u00B7 snap enabled` : 'freeform \u00B7 snap disabled'}
      </span>
      {showGrid && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>SCALE:</span>
          <select
            value={gridDivisionFt}
            onChange={(e) => setGridDivisionFt(Number(e.target.value))}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 3,
              color: 'white',
              fontSize: 9,
              padding: '2px 4px',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {GRID_SCALE_OPTIONS.map((opt) => (
              <option key={opt} value={opt} style={{ background: '#1B3557' }}>
                {opt} ft
              </option>
            ))}
          </select>
        </div>
      )}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 9,
          color: 'rgba(255,255,255,0.4)',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={showGrid}
          onChange={toggleGrid}
          style={{ accentColor: '#FF6B35' }}
        />
        GRID
      </label>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 9,
          color: 'rgba(255,255,255,0.4)',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={showDimensions}
          onChange={toggleDimensions}
          style={{ accentColor: '#FF6B35' }}
        />
        DIMENSIONS
      </label>
    </div>
  );
}
