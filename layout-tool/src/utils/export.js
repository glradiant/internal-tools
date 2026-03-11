import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import useLayoutStore from '../store/useLayoutStore';
import LayoutTemplate from '../components/LayoutTemplate';
import { GRID, HEATER_SCALE } from './constants';

// Get heater display width from SVG dimensions (matches DrawingCanvas logic)
function getHeaterDisplayWidth(model) {
  if (model?.dimensions?.width) {
    return model.dimensions.width * HEATER_SCALE;
  }
  return (model?.lengthFt || 10) * GRID;
}

/**
 * Compute the bounding box of all entities with margin for dimension lines.
 * Returns { x, y, w, h } in SVG coordinates, or null if nothing to export.
 */
function computeExtents(walls, heaters) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  const expand = (x, y) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  walls.forEach((wall) => {
    wall.points.forEach((p) => expand(p.x, p.y));
  });

  heaters.forEach((h) => {
    const width = getHeaterDisplayWidth(h.model);
    const aspectRatio = h.model?.dimensions?.aspectRatio || 1;
    const height = width / aspectRatio;
    expand(h.x - width / 2, h.y - height / 2);
    expand(h.x + width / 2, h.y + height / 2);
  });

  if (minX === Infinity) return null;

  const margin = 60;
  return {
    x: minX - margin,
    y: minY - margin,
    w: maxX - minX + margin * 2,
    h: maxY - minY + margin * 2,
  };
}

/**
 * Prepare the SVG for export: clone, strip UI elements, set viewBox to extents.
 * Returns the serialized SVG string ready for embedding.
 */
function prepareSvg(svgElement, walls, heaters) {
  const svgClone = svgElement.cloneNode(true);

  // Strip UI-only elements
  svgClone.querySelectorAll('[data-no-print]').forEach((el) => el.remove());

  // Compute extents and set viewBox to fit all entities
  const extents = computeExtents(walls, heaters);
  if (extents) {
    svgClone.setAttribute('viewBox', `${extents.x} ${extents.y} ${extents.w} ${extents.h}`);
  }

  // Set SVG to fill its container
  svgClone.setAttribute('width', '100%');
  svgClone.setAttribute('height', '100%');
  svgClone.removeAttribute('style');
  svgClone.style.display = 'block';
  svgClone.style.width = '100%';
  svgClone.style.height = '100%';

  return new XMLSerializer().serializeToString(svgClone);
}

/**
 * Export the layout as a branded PDF using html-to-image + jsPDF.
 * Renders the LayoutTemplate component off-screen, captures it at 3x resolution,
 * and embeds the result as a JPEG in a landscape Letter PDF.
 *
 * @param {SVGSVGElement} svgElement — the live SVG canvas element
 */
export async function exportPDF(svgElement) {
  const store = useLayoutStore.getState();
  const svgMarkup = prepareSvg(svgElement, store.walls || [], store.heaters || []);

  // Create off-screen container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '1056px';
  container.style.height = '816px';
  container.style.overflow = 'hidden';
  container.style.background = 'white';
  document.body.appendChild(container);

  // Render the LayoutTemplate into the off-screen container
  const root = createRoot(container);
  root.render(
    createElement(LayoutTemplate, { store, svgMarkup })
  );

  // Wait for React to render + fonts to be ready
  await document.fonts.ready;
  await new Promise((resolve) => setTimeout(resolve, 100));

  try {
    // Capture at 3x resolution (~288dpi for print quality)
    const canvas = await html2canvas(container, {
      scale: 3,
      useCORS: true,
      backgroundColor: 'white',
      logging: false,
    });

    // Create landscape Letter PDF
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'letter',
    });

    // Letter landscape: 279.4mm × 215.9mm
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    doc.addImage(imgData, 'JPEG', 0, 0, 279.4, 215.9);

    doc.save(`${store.projectName || 'layout'}-layout.pdf`);
  } catch (err) {
    console.error('PDF export failed:', err);
    alert('PDF export failed: ' + err.message);
  } finally {
    // Clean up
    root.unmount();
    document.body.removeChild(container);
  }
}
