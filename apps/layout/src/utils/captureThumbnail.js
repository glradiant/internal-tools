/**
 * Captures the current SVG canvas as a PNG blob for use as a thumbnail.
 * Excludes grid, crosshairs and other UI-only elements.
 */

const THUMB_W = 600;
const THUMB_H = 400;
const GRID = 20; // must match constants.js

export async function captureThumbnail(svgEl, { walls, heaters }) {
  if (!svgEl || (walls.length === 0 && heaters.length === 0)) return null;

  const bounds = computeContentBounds(walls, heaters);
  if (!bounds) return null;

  // Clone the SVG and strip UI-only elements
  const clone = svgEl.cloneNode(true);
  clone.querySelectorAll('[data-no-print]').forEach((el) => el.remove());
  clone.querySelectorAll('[data-thumbnail-exclude]').forEach((el) => el.remove());

  // Fit viewBox to content with 5% padding
  const pad = Math.max(bounds.w, bounds.h) * 0.08 + GRID * 2;
  clone.setAttribute('viewBox', `${bounds.minX - pad} ${bounds.minY - pad} ${bounds.w + pad * 2} ${bounds.h + pad * 2}`);
  clone.setAttribute('width', THUMB_W);
  clone.setAttribute('height', THUMB_H);
  clone.style.background = 'white';

  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(clone);
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = THUMB_W;
      canvas.height = THUMB_H;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, THUMB_W, THUMB_H);
      ctx.drawImage(img, 0, 0, THUMB_W, THUMB_H);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => resolve(blob), 'image/png', 0.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function computeContentBounds(walls, heaters) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  walls.forEach((wall) => {
    wall.points.forEach((pt) => {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    });
  });

  // Use generous padding around heater centers since we don't know exact dims here
  heaters.forEach((h) => {
    const r = GRID * 5;
    minX = Math.min(minX, h.x - r);
    minY = Math.min(minY, h.y - r);
    maxX = Math.max(maxX, h.x + r);
    maxY = Math.max(maxY, h.y + r);
  });

  if (!isFinite(minX)) return null;
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}
