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
 * Compute the bounding box of all entities with margin for dimension lines.
 * Returns { x, y, w, h } in SVG coordinates, or null if nothing to export.
 */
function computeExtents(walls, heaters, dimensions) {
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

  // Include manual dimensions
  (dimensions || []).forEach((d) => {
    expand(d.x1, d.y1);
    expand(d.x2, d.y2);
  });

  if (minX === Infinity) return null;

  const margin = 80; // Extra margin for dimension labels
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
function prepareSvgElement(svgElement, walls, heaters, dimensions, targetWidth, targetHeight) {
  const svgClone = svgElement.cloneNode(true);

  // Strip UI-only elements
  svgClone.querySelectorAll('[data-no-print]').forEach((el) => el.remove());

  // Compute extents and set viewBox to fit all entities
  const extents = computeExtents(walls, heaters, dimensions);
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

// Colors
const NAVY = '#1B3557';
const ORANGE = '#f37021';
const GRAY = '#8AAABF';
const MID_GRAY = '#5A7A9A';

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
  const MARGIN = 5;
  const HEADER_H = 18;
  const FOOTER_H = 24;

  // Drawing area
  const DRAW_X = MARGIN;
  const DRAW_Y = MARGIN + HEADER_H + 1;
  const DRAW_W = PAGE_W - MARGIN * 2;
  const DRAW_H = PAGE_H - MARGIN * 2 - HEADER_H - FOOTER_H - 2;

  // Prepare SVG for the drawing area (convert px to mm: 1px ≈ 0.264583mm)
  const svgClone = prepareSvgElement(
    svgElement,
    store.walls || [],
    store.heaters || [],
    store.dimensions || [],
    DRAW_W / 0.264583,
    DRAW_H / 0.264583
  );

  // Create landscape 11x17 PDF
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'tabloid',
  });

  try {
    // ═══════ BORDER ═══════
    doc.setDrawColor(NAVY);
    doc.setLineWidth(0.4);
    doc.rect(MARGIN, MARGIN, PAGE_W - MARGIN * 2, PAGE_H - MARGIN * 2);

    // ═══════ HEADER ═══════
    const headerY = MARGIN;
    const headerH = HEADER_H;

    // Header bottom line
    doc.setLineWidth(0.5);
    doc.line(MARGIN, headerY + headerH, PAGE_W - MARGIN, headerY + headerH);

    // Logo area (left side)
    const logoAreaW = 55;
    doc.setLineWidth(0.3);
    doc.setDrawColor(ORANGE);
    doc.line(MARGIN + logoAreaW, headerY, MARGIN + logoAreaW, headerY + headerH);

    // Add logo if available
    if (GLR_LOGO_BASE64) {
      try {
        doc.addImage(GLR_LOGO_BASE64, 'PNG', MARGIN + 3, headerY + 2, 49, 11);
      } catch (e) {
        // Fallback text if logo fails
        doc.setFontSize(10);
        doc.setTextColor(NAVY);
        doc.text('GREAT LAKES RADIANT', MARGIN + 27.5, headerY + 10, { align: 'center' });
      }
    }

    // Contact info under logo
    doc.setFontSize(5);
    doc.setTextColor(GRAY);
    doc.text('sales@glradiant.com  |  www.glradiant.com', MARGIN + 27.5, headerY + 16, { align: 'center' });

    // Project title (center)
    doc.setDrawColor(NAVY);
    const titleX = MARGIN + logoAreaW + 5;
    const metaX = PAGE_W - MARGIN - 50;

    doc.setFontSize(14);
    doc.setTextColor(NAVY);
    doc.setFont('helvetica', 'bold');
    doc.text(store.projectName || 'Untitled Layout', titleX, headerY + 8);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(MID_GRAY);
    const customerInfo = [store.customerName, store.customerAddress].filter(Boolean).join('  ·  ');
    if (customerInfo) {
      doc.text(customerInfo, titleX, headerY + 14);
    }

    // Meta grid (right side) - vertical line
    doc.setDrawColor(NAVY);
    doc.setLineWidth(0.2);
    doc.line(metaX, headerY, metaX, headerY + headerH);
    doc.line(metaX + 25, headerY, metaX + 25, headerY + headerH);
    doc.line(metaX, headerY + headerH / 2, PAGE_W - MARGIN, headerY + headerH / 2);

    // Meta labels and values
    const metaCells = [
      { label: 'PREPARED BY', value: store.preparedBy || '—', x: metaX + 2, y: headerY + 2 },
      { label: 'DATE', value: store.date || '—', x: metaX + 27, y: headerY + 2 },
      { label: 'QUOTE NO.', value: store.quoteNumber || '—', x: metaX + 2, y: headerY + headerH / 2 + 1 },
      { label: 'SCALE', value: 'As noted', x: metaX + 27, y: headerY + headerH / 2 + 1 },
    ];

    metaCells.forEach(({ label, value, x, y }) => {
      doc.setFontSize(4);
      doc.setTextColor(GRAY);
      doc.text(label, x, y + 3);
      doc.setFontSize(7);
      doc.setTextColor(NAVY);
      doc.text(value, x, y + 7);
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
    doc.setDrawColor(NAVY);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, footerY, PAGE_W - MARGIN, footerY);

    // Equipment Schedule (left)
    const scheduleW = 45;
    doc.setLineWidth(0.2);
    doc.line(MARGIN + scheduleW, footerY, MARGIN + scheduleW, PAGE_H - MARGIN);

    doc.setFontSize(4);
    doc.setTextColor(GRAY);
    doc.text('EQUIPMENT SCHEDULE', MARGIN + 3, footerY + 4);

    // Group heaters by model
    const schedule = Object.values(
      (store.heaters || []).reduce((acc, h) => {
        const key = h.model.id;
        if (!acc[key]) acc[key] = { model: h.model, count: 0 };
        acc[key].count++;
        return acc;
      }, {})
    );

    doc.setFontSize(6);
    doc.setTextColor(NAVY);
    let schedY = footerY + 8;
    if (schedule.length === 0) {
      doc.setTextColor(GRAY);
      doc.text('No heaters placed', MARGIN + 3, schedY);
    } else {
      schedule.forEach(({ model, count }) => {
        // Orange swatch
        doc.setFillColor(ORANGE);
        doc.rect(MARGIN + 3, schedY - 1.5, 4, 1.5, 'F');
        doc.setTextColor(NAVY);
        doc.text(`${count}× ${model.label}`, MARGIN + 9, schedY);
        schedY += 4;
      });
    }

    // Total Output (center-left)
    const totalX = MARGIN + scheduleW;
    const totalW = 25;
    doc.line(totalX + totalW, footerY, totalX + totalW, PAGE_H - MARGIN);

    const totalKbtu = (store.heaters || []).reduce((sum, h) => sum + h.model.kbtu, 0);

    doc.setFontSize(4);
    doc.setTextColor(GRAY);
    doc.text('TOTAL OUTPUT', totalX + totalW / 2, footerY + 5, { align: 'center' });

    doc.setFontSize(18);
    doc.setTextColor(ORANGE);
    doc.setFont('helvetica', 'bold');
    doc.text(String(totalKbtu), totalX + totalW / 2, footerY + 14, { align: 'center' });

    doc.setFontSize(5);
    doc.setTextColor(GRAY);
    doc.setFont('helvetica', 'normal');
    doc.text('kBTU / HR', totalX + totalW / 2, footerY + 19, { align: 'center' });

    // Offices (right side, fills remaining width)
    const officesX = totalX + totalW;
    const officeW = (PAGE_W - MARGIN - officesX) / OFFICES.length;

    OFFICES.forEach((office, i) => {
      const ox = officesX + i * officeW;
      if (i > 0) {
        doc.setDrawColor(200, 210, 220);
        doc.setLineWidth(0.1);
        doc.line(ox, footerY + 2, ox, PAGE_H - MARGIN - 2);
      }

      doc.setFontSize(6);
      doc.setTextColor(NAVY);
      doc.setFont('helvetica', 'bold');
      doc.text(office.name, ox + 3, footerY + 5);

      doc.setFontSize(5);
      doc.setTextColor(MID_GRAY);
      doc.setFont('helvetica', 'normal');
      office.lines.forEach((line, j) => {
        doc.text(line, ox + 3, footerY + 9 + j * 3.5);
      });
    });

    doc.save(`${store.projectName || 'layout'}-layout.pdf`);
  } catch (err) {
    console.error('PDF export failed:', err);
    alert('PDF export failed: ' + err.message);
  }
}
