import useLayoutStore from '../../store/useLayoutStore';
import { GRID } from '../../utils/constants';

export default function DistributionPanel() {
  const selectedIds = useLayoutStore((s) => s.selectedIds);
  const heaters = useLayoutStore((s) => s.heaters);
  const walls = useLayoutStore((s) => s.walls);
  const updateHeatersPositions = useLayoutStore((s) => s.updateHeatersPositions);

  // Get selected heaters and walls
  const selectedHeaters = heaters.filter((h) => selectedIds.includes(h.id));
  const selectedWalls = walls.filter((w) => selectedIds.includes(w.id));

  // Need at least 2 heaters to distribute
  if (selectedHeaters.length < 2) {
    return null;
  }

  // Calculate bounds from selected walls (if any) or from heater positions
  const getBounds = (axis) => {
    const isX = axis === 'x';

    // If walls are selected, use them as boundaries
    if (selectedWalls.length >= 1) {
      let min = Infinity, max = -Infinity;
      selectedWalls.forEach((wall) => {
        wall.points.forEach((p) => {
          const val = isX ? p.x : p.y;
          if (val < min) min = val;
          if (val > max) max = val;
        });
      });
      if (min !== Infinity) {
        return { min, max, fromWalls: true };
      }
    }

    // Otherwise use the outermost heater positions
    let min = Infinity, max = -Infinity;
    selectedHeaters.forEach((h) => {
      const val = isX ? h.x : h.y;
      if (val < min) min = val;
      if (val > max) max = val;
    });

    return { min, max, fromWalls: false };
  };

  const distributeHorizontally = () => {
    if (selectedHeaters.length < 2) return;

    const bounds = getBounds('x');
    const sorted = [...selectedHeaters].sort((a, b) => a.x - b.x);

    // Calculate spacing
    const count = sorted.length;
    const totalSpan = bounds.max - bounds.min;
    const spacing = totalSpan / (count - 1 + (bounds.fromWalls ? 2 : 0));

    const updates = sorted.map((h, i) => ({
      id: h.id,
      x: bounds.fromWalls
        ? bounds.min + spacing * (i + 1)
        : bounds.min + spacing * i,
      y: h.y, // Keep Y position
    }));

    updateHeatersPositions(updates);
  };

  const distributeVertically = () => {
    if (selectedHeaters.length < 2) return;

    const bounds = getBounds('y');
    const sorted = [...selectedHeaters].sort((a, b) => a.y - b.y);

    // Calculate spacing
    const count = sorted.length;
    const totalSpan = bounds.max - bounds.min;
    const spacing = totalSpan / (count - 1 + (bounds.fromWalls ? 2 : 0));

    const updates = sorted.map((h, i) => ({
      id: h.id,
      x: h.x, // Keep X position
      y: bounds.fromWalls
        ? bounds.min + spacing * (i + 1)
        : bounds.min + spacing * i,
    }));

    updateHeatersPositions(updates);
  };

  const alignHorizontally = () => {
    // Align all heaters to the average Y position
    const avgY = selectedHeaters.reduce((sum, h) => sum + h.y, 0) / selectedHeaters.length;
    const updates = selectedHeaters.map((h) => ({
      id: h.id,
      x: h.x,
      y: avgY,
    }));
    updateHeatersPositions(updates);
  };

  const alignVertically = () => {
    // Align all heaters to the average X position
    const avgX = selectedHeaters.reduce((sum, h) => sum + h.x, 0) / selectedHeaters.length;
    const updates = selectedHeaters.map((h) => ({
      id: h.id,
      x: avgX,
      y: h.y,
    }));
    updateHeatersPositions(updates);
  };

  // Calculate current spacing info
  const getSpacingInfo = () => {
    if (selectedHeaters.length < 2) return null;

    const sortedX = [...selectedHeaters].sort((a, b) => a.x - b.x);
    const sortedY = [...selectedHeaters].sort((a, b) => a.y - b.y);

    const hSpan = sortedX[sortedX.length - 1].x - sortedX[0].x;
    const vSpan = sortedY[sortedY.length - 1].y - sortedY[0].y;

    return {
      hSpanFt: Math.round(hSpan / GRID * 10) / 10,
      vSpanFt: Math.round(vSpan / GRID * 10) / 10,
    };
  };

  const spacingInfo = getSpacingInfo();

  const btnStyle = {
    flex: 1,
    padding: '6px 4px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 3,
    color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 8,
    letterSpacing: 0.5,
  };

  return (
    <div
      style={{
        padding: '10px 18px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div style={{ fontSize: 8, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
        DISTRIBUTE ({selectedHeaters.length} HEATERS{selectedWalls.length > 0 ? ` + ${selectedWalls.length} WALLS` : ''})
      </div>

      {spacingInfo && (
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
          Span: {spacingInfo.hSpanFt}ft H × {spacingInfo.vSpanFt}ft V
        </div>
      )}

      {selectedWalls.length > 0 && (
        <div style={{ fontSize: 8, color: '#f37021', marginBottom: 8, opacity: 0.8 }}>
          Using selected wall(s) as boundaries
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        <button onClick={distributeHorizontally} style={btnStyle} title="Distribute evenly horizontally">
          DISTRIBUTE H
        </button>
        <button onClick={distributeVertically} style={btnStyle} title="Distribute evenly vertically">
          DISTRIBUTE V
        </button>
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={alignHorizontally} style={btnStyle} title="Align to same horizontal line">
          ALIGN H
        </button>
        <button onClick={alignVertically} style={btnStyle} title="Align to same vertical line">
          ALIGN V
        </button>
      </div>

      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
        Tip: Shift+click to select multiple items. Select walls to use as distribution boundaries.
      </div>
    </div>
  );
}
