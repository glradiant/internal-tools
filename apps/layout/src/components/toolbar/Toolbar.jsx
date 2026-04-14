import useLayoutStore from '../../store/useLayoutStore';

const GRID_SCALE_OPTIONS = [0.5, 1, 2, 5, 10];

export default function Toolbar({ onBack, saveStatus, onRecenter, isTouch, sidebarOpen, onToggleSidebar }) {
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
  const selectedIds = useLayoutStore((s) => s.selectedIds);
  const walls = useLayoutStore((s) => s.walls);
  const doors = useLayoutStore((s) => s.doors);
  const heaters = useLayoutStore((s) => s.heaters);
  const dimensions = useLayoutStore((s) => s.dimensions);
  const removeWall = useLayoutStore((s) => s.removeWall);
  const removeDoor = useLayoutStore((s) => s.removeDoor);
  const removeHeater = useLayoutStore((s) => s.removeHeater);
  const removeDimension = useLayoutStore((s) => s.removeDimension);
  const panMode = useLayoutStore((s) => s.panMode);
  const togglePanMode = useLayoutStore((s) => s.togglePanMode);

  const toolbarHeight = isTouch ? 48 : 36;

  const buttonStyle = (enabled, active) => ({
    background: active ? 'rgba(243,112,33,0.3)' : 'rgba(255,255,255,0.1)',
    border: `1px solid ${active ? '#f37021' : 'rgba(255,255,255,0.2)'}`,
    borderRadius: 3,
    color: enabled ? 'white' : 'rgba(255,255,255,0.3)',
    fontSize: isTouch ? 18 : 14,
    padding: isTouch ? '6px 12px' : '2px 8px',
    cursor: enabled ? 'pointer' : 'default',
    outline: 'none',
    opacity: enabled ? 1 : 0.5,
    minWidth: isTouch ? 44 : undefined,
    minHeight: isTouch ? 44 : undefined,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  const handleDelete = () => {
    selectedIds.forEach((id) => {
      if (walls.find((w) => w.id === id)) removeWall(id);
      else if (doors.find((d) => d.id === id)) removeDoor(id);
      else if (heaters.find((h) => h.id === id)) removeHeater(id);
      else if (dimensions.find((d) => d.id === id)) removeDimension(id);
    });
  };

  return (
    <div
      style={{
        height: toolbarHeight,
        background: '#1B3557',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: isTouch ? 8 : 16,
        borderBottom: '1px solid rgba(0,0,0,0.2)',
        flexShrink: 0,
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      {/* Sidebar toggle (touch) or Back button (desktop) */}
      {isTouch && onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          style={buttonStyle(true)}
          title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {sidebarOpen ? '\u2715' : '\u2630'}
        </button>
      )}
      {onBack && !isTouch && (
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
      {isTouch && onBack && (
        <button onClick={onBack} style={buttonStyle(true)} title="Back to Layouts">
          &larr;
        </button>
      )}
      {!isTouch && (
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>
          {projectName.toUpperCase()}
        </span>
      )}
      {saveStatus && (
        <span
          style={{
            fontSize: 9,
            color: saveStatus === 'error' ? '#f37021' : 'rgba(255,255,255,0.3)',
            fontStyle: 'italic',
          }}
        >
          {saveStatus === 'saving' && 'Saving...'}
          {saveStatus === 'saved' && 'Saved'}
          {saveStatus === 'error' && 'Save failed'}
        </span>
      )}
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={undo} disabled={!canUndo} style={buttonStyle(canUndo)} title="Undo">
          &#x21A9;
        </button>
        <button onClick={redo} disabled={!canRedo} style={buttonStyle(canRedo)} title="Redo">
          &#x21AA;
        </button>
        <button onClick={onRecenter} style={buttonStyle(true)} title="Recenter">
          &#x2316;
        </button>
      </div>

      {/* Touch-only: pan mode toggle and delete */}
      {isTouch && (
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={togglePanMode}
            style={buttonStyle(true, panMode)}
            title={panMode ? 'Pan mode (active)' : 'Pan mode'}
          >
            &#x270B;
          </button>
          <button
            onClick={handleDelete}
            disabled={selectedIds.length === 0}
            style={buttonStyle(selectedIds.length > 0)}
            title="Delete selected"
          >
            &#x1F5D1;
          </button>
        </div>
      )}

      <span style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
        {showGrid ? `1 div = ${gridDivisionFt} ft \u00B7 snap enabled` : 'freeform \u00B7 snap disabled'}
      </span>
      {showGrid && !isTouch && (
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
          style={{ accentColor: '#f37021' }}
        />
        GRID
      </label>
      {!isTouch && (
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
            style={{ accentColor: '#f37021' }}
          />
          DIMENSIONS
        </label>
      )}
    </div>
  );
}
