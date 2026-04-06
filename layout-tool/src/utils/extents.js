import { GRID, HEATER_SCALE } from './constants';

// Get heater display width from SVG dimensions (matches DrawingCanvas logic)
export function getHeaterDisplayWidth(model) {
  if (model?.dimensions?.width) {
    return model.dimensions.width * HEATER_SCALE;
  }
  return (model?.lengthFt || 10) * GRID;
}

/**
 * Compute the bounding box of all entities including dimension labels.
 * Returns { x, y, w, h } in SVG coordinates, or null if nothing to export.
 */
export function computeExtents(walls, heaters, dimensions, labelScale = 1) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  const expand = (x, y) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  // Dimension label constants (must match DimensionLabel.jsx)
  const BASE_GAP = 4;
  const BASE_EXTEND = 20;
  const BASE_OVERSHOOT = 3;
  const BASE_FONT_SIZE = 7;
  const BASE_TEXT_PAD = 2;
  const dimOffset = (BASE_GAP + BASE_EXTEND + BASE_OVERSHOOT + BASE_FONT_SIZE + BASE_TEXT_PAD) * labelScale;

  walls.forEach((wall) => {
    const pts = wall.points;
    pts.forEach((p) => expand(p.x, p.y));

    if (pts.length >= 3) {
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;

      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const segLen = Math.hypot(b.x - a.x, b.y - a.y);
        if (segLen === 0) continue;

        let nx = -(b.y - a.y) / segLen;
        let ny = (b.x - a.x) / segLen;

        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const dot = (cx - mx) * nx + (cy - my) * ny;
        if (dot > 0) {
          nx = -nx;
          ny = -ny;
        }

        expand(a.x + nx * dimOffset, a.y + ny * dimOffset);
        expand(b.x + nx * dimOffset, b.y + ny * dimOffset);
      }
    } else if (pts.length === 2) {
      const a = pts[0];
      const b = pts[1];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      if (segLen > 0) {
        const nx = -(b.y - a.y) / segLen;
        const ny = (b.x - a.x) / segLen;
        expand(a.x + nx * dimOffset, a.y + ny * dimOffset);
        expand(b.x + nx * dimOffset, b.y + ny * dimOffset);
        expand(a.x - nx * dimOffset, a.y - ny * dimOffset);
        expand(b.x - nx * dimOffset, b.y - ny * dimOffset);
      }
    }
  });

  heaters.forEach((h) => {
    const width = getHeaterDisplayWidth(h.model);
    const aspectRatio = h.model?.dimensions?.aspectRatio || 1;
    const height = width / aspectRatio;
    expand(h.x - width / 2, h.y - height / 2);
    expand(h.x + width / 2, h.y + height / 2);
  });

  (dimensions || []).forEach((d) => {
    expand(d.x1, d.y1);
    expand(d.x2, d.y2);
  });

  if (minX === Infinity) return null;

  const margin = 20;
  return {
    x: minX - margin,
    y: minY - margin,
    w: maxX - minX + margin * 2,
    h: maxY - minY + margin * 2,
  };
}
