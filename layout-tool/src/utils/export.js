import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
import useLayoutStore from '../store/useLayoutStore';
import { GRID, HEATER_SCALE, OFFICES, GLR_LOGO_BASE64 } from './constants';

// Get heater display width from SVG dimensions (matches DrawingCanvas logic)
function getHeaterDisplayWidth(model) {
  if (model?.dimensions?.width) {
    return model.dimensions.width * HEATER_SCALE;
  }
  return (model?.lengthFt || 10) * GRID;
}

/**
 * Compute the bounding box of all entities including dimension labels.
 * Returns { x, y, w, h } in SVG coordinates, or null if nothing to export.
 */
function computeExtents(walls, heaters, dimensions, labelScale = 1) {
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
    // Include wall points
    pts.forEach((p) => expand(p.x, p.y));

    // Calculate centroid for determining dimension label direction
    if (pts.length >= 3) {
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;

      // For each wall segment, calculate where dimension label extends
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const segLen = Math.hypot(b.x - a.x, b.y - a.y);
        if (segLen === 0) continue;

        // Perpendicular normal (left-hand)
        let nx = -(b.y - a.y) / segLen;
        let ny = (b.x - a.x) / segLen;

        // Push to outside (away from centroid)
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const dot = (cx - mx) * nx + (cy - my) * ny;
        if (dot > 0) {
          nx = -nx;
          ny = -ny;
        }

        // Expand to include dimension label endpoints
        expand(a.x + nx * dimOffset, a.y + ny * dimOffset);
        expand(b.x + nx * dimOffset, b.y + ny * dimOffset);
      }
    } else if (pts.length === 2) {
      // Single wall segment - expand in both perpendicular directions
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

  // Include manual dimensions
  (dimensions || []).forEach((d) => {
    expand(d.x1, d.y1);
    expand(d.x2, d.y2);
  });

  if (minX === Infinity) return null;

  const margin = 20; // Small extra margin for safety
  return {
    x: minX - margin,
    y: minY - margin,
    w: maxX - minX + margin * 2,
    h: maxY - minY + margin * 2,
  };
}

/**
 * Prepare the SVG for export: clone, strip UI elements, set viewBox to extents.
 * Returns the SVG element ready for svg2pdf.
 */
function prepareSvgElement(svgElement, walls, heaters, dimensions, targetWidth, targetHeight, labelScale) {
  const svgClone = svgElement.cloneNode(true);

  // Strip UI-only elements
  svgClone.querySelectorAll('[data-no-print]').forEach((el) => el.remove());

  // Compute extents and set viewBox to fit all entities
  const extents = computeExtents(walls, heaters, dimensions, labelScale);
  if (extents) {
    // Calculate scale to fit within target area while maintaining aspect ratio
    const scaleX = targetWidth / extents.w;
    const scaleY = targetHeight / extents.h;
    const scale = Math.min(scaleX, scaleY);

    // Center the content
    const scaledW = extents.w * scale;
    const scaledH = extents.h * scale;
    const offsetX = (targetWidth - scaledW) / 2;
    const offsetY = (targetHeight - scaledH) / 2;

    svgClone.setAttribute('viewBox', `${extents.x} ${extents.y} ${extents.w} ${extents.h}`);
    svgClone.setAttribute('width', scaledW);
    svgClone.setAttribute('height', scaledH);
    svgClone._offsetX = offsetX;
    svgClone._offsetY = offsetY;
  } else {
    svgClone.setAttribute('width', targetWidth);
    svgClone.setAttribute('height', targetHeight);
    svgClone._offsetX = 0;
    svgClone._offsetY = 0;
  }

  svgClone.removeAttribute('style');

  return svgClone;
}

// Colors (RGB values for jsPDF)
const NAVY = [27, 53, 87];
const ORANGE = [243, 112, 33];
const GRAY = [138, 170, 191];
const MID_GRAY = [90, 122, 154];
const DARK_NAVY = [15, 30, 48];

/**
 * Export the layout as a vector PDF using jsPDF + svg2pdf.js.
 * All elements are rendered as vectors for infinite zoom quality.
 *
 * @param {SVGSVGElement} svgElement — the live SVG canvas element
 */
export async function exportPDF(svgElement) {
  const store = useLayoutStore.getState();

  // Page dimensions in mm (11x17 landscape)
  const PAGE_W = 431.8;
  const PAGE_H = 279.4;
  const MARGIN = 4;
  const HEADER_H = 20;
  const FOOTER_H = 32;

  // Drawing area
  const DRAW_X = MARGIN;
  const DRAW_Y = MARGIN + HEADER_H;
  const DRAW_W = PAGE_W - MARGIN * 2;
  const DRAW_H = PAGE_H - MARGIN * 2 - HEADER_H - FOOTER_H;

  // Get label scale for proper dimension extents
  const labelScale = store.getLabelScale ? store.getLabelScale() : 1;

  // Prepare SVG for the drawing area (convert px to mm: 1px ≈ 0.264583mm)
  const svgClone = prepareSvgElement(
    svgElement,
    store.walls || [],
    store.heaters || [],
    store.dimensions || [],
    DRAW_W / 0.264583,
    DRAW_H / 0.264583,
    labelScale
  );

  // Create landscape 11x17 PDF
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'tabloid',
  });

  try {
    // ═══════ BORDER ═══════
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.5);
    doc.rect(MARGIN, MARGIN, PAGE_W - MARGIN * 2, PAGE_H - MARGIN * 2);

    // ═══════ HEADER ═══════
    const headerY = MARGIN;
    const headerH = HEADER_H;

    // Header bottom line
    doc.setLineWidth(0.6);
    doc.line(MARGIN, headerY + headerH, PAGE_W - MARGIN, headerY + headerH);

    // Logo area (left side)
    const logoAreaW = 60;
    doc.setLineWidth(1);
    doc.setDrawColor(...ORANGE);
    doc.line(MARGIN + logoAreaW, headerY + 0.5, MARGIN + logoAreaW, headerY + headerH - 0.5);

    // Add logo if available
    if (GLR_LOGO_BASE64) {
      try {
        doc.addImage(GLR_LOGO_BASE64, 'PNG', MARGIN + 4, headerY + 2.5, 52, 12);
      } catch (e) {
        // Fallback text if logo fails
        doc.setFontSize(12);
        doc.setTextColor(...NAVY);
        doc.text('GREAT LAKES RADIANT', MARGIN + logoAreaW / 2, headerY + 10, { align: 'center' });
      }
    }

    // Contact info under logo (courier for mono style)
    doc.setFont('courier', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(...GRAY);
    doc.text('sales@glradiant.com  |  www.glradiant.com', MARGIN + logoAreaW / 2, headerY + 17.5, { align: 'center' });

    // Project title (center)
    doc.setDrawColor(...NAVY);
    const titleX = MARGIN + logoAreaW + 6;
    const metaW = 75; // Wider for 3 columns
    const metaX = PAGE_W - MARGIN - metaW;
    const colW = metaW / 3;

    doc.setFontSize(16);
    doc.setTextColor(...NAVY);
    doc.setFont('helvetica', 'bold');
    doc.text(store.projectName || 'Untitled Layout', titleX, headerY + 9);

    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MID_GRAY);
    const customerInfo = [store.customerName, store.customerAddress].filter(Boolean).join('  ·  ');
    if (customerInfo) {
      doc.text(customerInfo, titleX, headerY + 15);
    }

    // Meta grid (right side) - 3 columns x 2 rows
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.3);
    doc.line(metaX, headerY + 0.5, metaX, headerY + headerH - 0.5);
    doc.line(metaX + colW, headerY + 0.5, metaX + colW, headerY + headerH - 0.5);
    doc.line(metaX + colW * 2, headerY + 0.5, metaX + colW * 2, headerY + headerH - 0.5);
    doc.line(metaX, headerY + headerH / 2, PAGE_W - MARGIN - 0.5, headerY + headerH / 2);

    // Meta labels and values (3 cols x 2 rows)
    const metaCells = [
      { label: 'PREPARED BY', value: store.preparedBy || '—', x: metaX + 2, y: headerY + 1.5 },
      { label: 'DATE', value: store.date || '—', x: metaX + colW + 2, y: headerY + 1.5 },
      { label: 'REVISION', value: store.revision || '—', x: metaX + colW * 2 + 2, y: headerY + 1.5 },
      { label: 'QUOTE NO.', value: store.quoteNumber || '—', x: metaX + 2, y: headerY + headerH / 2 + 0.5 },
      { label: 'GAS TYPE', value: store.gasType || '—', x: metaX + colW + 2, y: headerY + headerH / 2 + 0.5 },
      { label: 'SCALE', value: 'Not to scale', x: metaX + colW * 2 + 2, y: headerY + headerH / 2 + 0.5 },
    ];

    metaCells.forEach(({ label, value, x, y }) => {
      doc.setFont('courier', 'normal');
      doc.setFontSize(4.5);
      doc.setTextColor(...GRAY);
      doc.text(label, x, y + 3.5);
      doc.setFont('courier', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...NAVY);
      doc.text(value, x, y + 8);
    });

    // ═══════ DRAWING AREA ═══════
    // Render SVG as vectors
    const offsetX = (svgClone._offsetX || 0) * 0.264583;
    const offsetY = (svgClone._offsetY || 0) * 0.264583;

    // Temporarily add to DOM for svg2pdf
    svgClone.style.position = 'absolute';
    svgClone.style.left = '-9999px';
    document.body.appendChild(svgClone);

    await doc.svg(svgClone, {
      x: DRAW_X + offsetX,
      y: DRAW_Y + offsetY,
      width: parseFloat(svgClone.getAttribute('width')) * 0.264583,
      height: parseFloat(svgClone.getAttribute('height')) * 0.264583,
    });

    document.body.removeChild(svgClone);

    // ═══════ FOOTER / TITLE BLOCK ═══════
    const footerY = PAGE_H - MARGIN - FOOTER_H;

    // Footer top line
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.6);
    doc.line(MARGIN, footerY, PAGE_W - MARGIN, footerY);

    // Equipment Schedule (left)
    const scheduleW = 65;
    doc.setLineWidth(0.3);
    doc.line(MARGIN + scheduleW, footerY + 0.5, MARGIN + scheduleW, PAGE_H - MARGIN - 0.5);

    doc.setFont('courier', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...GRAY);
    doc.text('EQUIPMENT SCHEDULE', MARGIN + 5, footerY + 6);

    // Group heaters by model
    const schedule = Object.values(
      (store.heaters || []).reduce((acc, h) => {
        const key = h.model.id;
        if (!acc[key]) acc[key] = { model: h.model, count: 0 };
        acc[key].count++;
        return acc;
      }, {})
    );

    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    let schedY = footerY + 13;
    if (schedule.length === 0) {
      doc.setTextColor(...GRAY);
      doc.text('No heaters placed', MARGIN + 5, schedY);
    } else {
      schedule.forEach(({ model, count }) => {
        // Orange swatch
        doc.setFillColor(...ORANGE);
        doc.rect(MARGIN + 5, schedY - 2.5, 6, 3, 'F');
        doc.setTextColor(...NAVY);
        doc.text(`${count}x ${model.label}`, MARGIN + 13, schedY);
        schedY += 6;
      });
    }

    // Total Output (center-left)
    const totalX = MARGIN + scheduleW;
    const totalW = 36;
    doc.setDrawColor(...NAVY);
    doc.line(totalX + totalW, footerY + 0.5, totalX + totalW, PAGE_H - MARGIN - 0.5);

    const totalKbtu = (store.heaters || []).reduce((sum, h) => sum + h.model.kbtu, 0);

    doc.setFont('courier', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...GRAY);
    doc.text('TOTAL OUTPUT', totalX + totalW / 2, footerY + 7, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(...ORANGE);
    doc.text(String(totalKbtu), totalX + totalW / 2, footerY + 20, { align: 'center' });

    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text('kBTU / HR', totalX + totalW / 2, footerY + 27, { align: 'center' });

    // Offices (fills remaining space)
    const officesX = totalX + totalW;
    const officeW = (PAGE_W - MARGIN - officesX) / OFFICES.length;

    OFFICES.forEach((office, i) => {
      const ox = officesX + i * officeW;
      if (i > 0) {
        doc.setDrawColor(200, 210, 220);
        doc.setLineWidth(0.15);
        doc.line(ox, footerY + 3, ox, PAGE_H - MARGIN - 3);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...NAVY);
      doc.text(office.name, ox + 3, footerY + 7);

      doc.setFont('courier', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...MID_GRAY);
      office.lines.forEach((line, j) => {
        doc.text(line, ox + 3, footerY + 13 + j * 4.5);
      });
    });

    const fileName = store.quoteNumber
      ? `${store.projectName || 'Layout'} Layout - ${store.quoteNumber}.pdf`
      : `${store.projectName || 'Layout'} Layout.pdf`;
    doc.save(fileName);
  } catch (err) {
    console.error('PDF export failed:', err);
    alert('PDF export failed: ' + err.message);
  }
}
