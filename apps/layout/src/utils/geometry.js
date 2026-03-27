export function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function closestOnSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: ax, y: ay, t: 0 };
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: ax + t * dx, y: ay + t * dy, t };
}

export function segmentAngleDeg(ax, ay, bx, by) {
  return (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
}

export function dimensionLabelData(ax, ay, bx, by, grid) {
  const len = Math.hypot(bx - ax, by - ay);
  if (len === 0) return null;
  const ft = Math.round(len / grid);
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const nx = -(by - ay) / len;
  const ny = (bx - ax) / len;
  return { ft, mx, my, nx, ny };
}

export function polarToCartesian(originX, originY, lengthPx, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: originX + lengthPx * Math.cos(rad),
    y: originY - lengthPx * Math.sin(rad),
  };
}

export function findNearestWallSegment(x, y, walls) {
  let best = { dist: Infinity, wallId: null, segmentIndex: null, point: null };
  walls.forEach((wall) => {
    const pts = wall.points;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const d = distToSegment(x, y, a.x, a.y, b.x, b.y);
      if (d < best.dist) {
        best = {
          dist: d,
          wallId: wall.id,
          segmentIndex: i,
          point: closestOnSegment(x, y, a.x, a.y, b.x, b.y),
        };
      }
    }
  });
  return best;
}
