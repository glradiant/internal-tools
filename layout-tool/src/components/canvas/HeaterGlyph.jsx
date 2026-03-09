import { useMemo, useRef, useEffect, useState } from 'react';
import { COLORS } from '../../utils/constants';

// Convert colors that are too light for white background to darker equivalents
// Mimics AutoCAD's behavior when exporting to white background
function invertColorForWhiteBg(color) {
  if (!color || color === 'none') return color;

  const colorLower = color.toLowerCase().trim();

  // Direct white mappings
  if (colorLower === 'white' || colorLower === '#fff' || colorLower === '#ffffff') {
    return '#1B3557'; // Navy blue (matches app theme)
  }

  // Yellow -> heater orange (common in CAD drawings)
  if (colorLower === '#ffff00' || colorLower === 'yellow') {
    return '#C74A1A'; // Heater orange
  }

  // Light gray -> darker gray
  if (colorLower === '#cccccc' || colorLower === '#ccc' || colorLower === 'lightgray' || colorLower === 'lightgrey') {
    return '#666666';
  }

  // Parse hex colors to check brightness
  const hexMatch = colorLower.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate perceived brightness (ITU-R BT.709)
    const brightness = (r * 0.299 + g * 0.587 + b * 0.114);

    // If color is very bright (>200), invert it
    if (brightness > 200) {
      // Invert: subtract from 255
      const newR = Math.max(0, 255 - r);
      const newG = Math.max(0, 255 - g);
      const newB = Math.max(0, 255 - b);
      return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    }
  }

  // Parse rgb() colors
  const rgbMatch = colorLower.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);

    const brightness = (r * 0.299 + g * 0.587 + b * 0.114);

    if (brightness > 200) {
      const newR = Math.max(0, 255 - r);
      const newG = Math.max(0, 255 - g);
      const newB = Math.max(0, 255 - b);
      return `rgb(${newR}, ${newG}, ${newB})`;
    }
  }

  return color;
}

export default function HeaterGlyph({ model, lengthPx, selected, preview, flipH = false, flipV = false }) {
  const stroke = preview ? COLORS.heaterPreview : COLORS.heaterNormal;

  // Build flip transform
  const flipTransform = `scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`;
  const groupRef = useRef(null);
  const [svgParsed, setSvgParsed] = useState(null);

  // Parse SVG content on mount/model change
  useEffect(() => {
    if (!model?.svgContent) {
      setSvgParsed(null);
      return;
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(model.svgContent, 'image/svg+xml');
      const svgEl = doc.querySelector('svg');

      if (svgEl) {
        // Get viewBox
        const viewBox = svgEl.getAttribute('viewBox');
        const [vbX, vbY, vbW, vbH] = (viewBox || '0 0 100 100').split(/\s+/).map(Number);

        // Get all child elements (defs, g, paths, etc.)
        const children = svgEl.innerHTML;

        setSvgParsed({
          viewBox: { x: vbX, y: vbY, width: vbW, height: vbH },
          aspectRatio: vbW / vbH,
          children
        });
      }
    } catch (e) {
      console.error('Failed to parse SVG:', e);
      setSvgParsed(null);
    }
  }, [model?.svgContent]);

  // Render parsed SVG content into the group
  useEffect(() => {
    if (!svgParsed || !groupRef.current) return;

    const g = groupRef.current;

    // Clear existing content
    while (g.firstChild) {
      g.removeChild(g.firstChild);
    }

    // Create a wrapper group for the SVG content
    const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    wrapper.innerHTML = svgParsed.children;

    // Apply color overrides - invert white/light colors to dark (like AutoCAD export)
    const elements = wrapper.querySelectorAll('*');
    elements.forEach(el => {
      // Handle stroke attribute
      const currentStroke = el.getAttribute('stroke');
      if (currentStroke && currentStroke !== 'none') {
        el.setAttribute('stroke', invertColorForWhiteBg(currentStroke));
      }

      // Handle fill attribute
      const currentFill = el.getAttribute('fill');
      if (currentFill && currentFill !== 'none') {
        el.setAttribute('fill', invertColorForWhiteBg(currentFill));
      }

      // Handle style attribute
      const style = el.getAttribute('style');
      if (style) {
        let newStyle = style;
        // Replace stroke colors
        newStyle = newStyle.replace(/stroke:\s*([^;]+)/g, (match, color) => {
          return `stroke: ${invertColorForWhiteBg(color.trim())}`;
        });
        // Replace fill colors
        newStyle = newStyle.replace(/fill:\s*([^;]+)/g, (match, color) => {
          if (color.trim() === 'none') return match;
          return `fill: ${invertColorForWhiteBg(color.trim())}`;
        });
        el.setAttribute('style', newStyle);
      }
    });

    // Also process any style elements (CSS rules)
    const styleEls = wrapper.querySelectorAll('style');
    styleEls.forEach(styleEl => {
      let css = styleEl.textContent;
      // Replace white/light colors in CSS
      css = css.replace(/stroke:\s*#fff(?:fff)?(?![0-9a-f])/gi, 'stroke: #1B3557');
      css = css.replace(/stroke:\s*white/gi, 'stroke: #1B3557');
      css = css.replace(/stroke:\s*#ffff00/gi, 'stroke: #C74A1A'); // Yellow to heater orange
      css = css.replace(/fill:\s*#fff(?:fff)?(?![0-9a-f])/gi, 'fill: #1B3557');
      css = css.replace(/fill:\s*white/gi, 'fill: #1B3557');
      styleEl.textContent = css;
    });

    g.appendChild(wrapper);
  }, [svgParsed, stroke]);

  // If we have parsed SVG content, render it
  if (svgParsed) {
    const { viewBox, aspectRatio } = svgParsed;

    // Calculate display dimensions based on lengthPx (this is the width)
    const displayWidth = lengthPx;
    const displayHeight = lengthPx / aspectRatio;

    // Center the SVG around origin (0, 0)
    const offsetX = -displayWidth / 2;
    const offsetY = -displayHeight / 2;

    // Scale factors
    const scaleX = displayWidth / viewBox.width;
    const scaleY = displayHeight / viewBox.height;

    return (
      <g transform={flipTransform}>
        {/* Invisible hit area for easier clicking */}
        <rect
          x={offsetX - 5}
          y={offsetY - 5}
          width={displayWidth + 10}
          height={displayHeight + 10}
          fill="transparent"
          stroke="none"
          style={{ cursor: 'pointer' }}
        />
        {/* Selection box */}
        {selected && (
          <rect
            x={offsetX - 5}
            y={offsetY - 5}
            width={displayWidth + 10}
            height={displayHeight + 10}
            rx={4}
            fill="none"
            stroke="#60A5FA"
            strokeWidth={1.5}
            strokeDasharray="4,3"
          />
        )}

        {/* SVG content container */}
        <g
          ref={groupRef}
          transform={`translate(${offsetX - viewBox.x * scaleX}, ${offsetY - viewBox.y * scaleY}) scale(${scaleX}, ${scaleY})`}
          style={{ opacity: preview ? 0.7 : 1 }}
        />

        {/* Preview overlay */}
        {preview && (
          <rect
            x={offsetX}
            y={offsetY}
            width={displayWidth}
            height={displayHeight}
            fill="rgba(255,107,53,0.08)"
            stroke={stroke}
            strokeWidth={1}
            strokeDasharray="4,2"
            rx={2}
          />
        )}
      </g>
    );
  }

  // Fallback: procedural drawing if no SVG content
  const hl = lengthPx / 2;
  const fillBody = preview ? 'rgba(255,107,53,0.15)' : 'rgba(199,74,26,0.12)';
  const fillBurner = preview ? 'rgba(255,107,53,0.2)' : 'rgba(199,74,26,0.2)';

  return (
    <g transform={flipTransform}>
      {/* Invisible hit area for easier clicking */}
      <rect
        x={-hl - 12}
        y={-20}
        width={lengthPx + 24}
        height={40}
        fill="transparent"
        stroke="none"
        style={{ cursor: 'pointer' }}
      />
      {selected && (
        <rect
          x={-hl - 10} y={-12}
          width={lengthPx + 20} height={24}
          rx={4}
          fill="none"
          stroke="#60A5FA"
          strokeWidth={1.5}
          strokeDasharray="4,3"
        />
      )}
      {/* Reflector/shield arc */}
      <path
        d={`M ${-hl} -8 Q 0 -18 ${hl} -8`}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {/* Tube body */}
      <rect
        x={-hl} y={-4}
        width={lengthPx} height={8}
        rx={4}
        fill={fillBody}
        stroke={stroke}
        strokeWidth={1.5}
      />
      {/* Burner head */}
      <rect
        x={-hl - 10} y={-6}
        width={18} height={12}
        rx={2}
        fill={fillBurner}
        stroke={stroke}
        strokeWidth={1.5}
      />
      {/* Flame icon hint */}
      <circle
        cx={-hl - 2} cy={0}
        r={2.5}
        fill={stroke}
        opacity={0.7}
      />
      {/* End cap */}
      <circle
        cx={hl} cy={0}
        r={3.5}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
      />
      {/* Mounting hangers */}
      {[-hl * 0.5, 0, hl * 0.5].map((x, i) => (
        <line
          key={i}
          x1={x} y1={-4}
          x2={x} y2={-13}
          stroke={stroke}
          strokeWidth={1}
          opacity={0.5}
          strokeDasharray="2,2"
        />
      ))}
    </g>
  );
}
