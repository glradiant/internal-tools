import { useState, useRef, useEffect, useMemo } from 'react';
import { HEATER_MODELS_FROM_SVG } from '../utils/heaterCatalog';
import { BUILDER_PARTS } from '../utils/builderPartsCatalog';

// ── Color inversion for SVGs on white background ────────────────────────
// Same logic as HeaterGlyph.jsx — converts light CAD colors to darker equivalents

function invertColorForWhiteBg(color) {
  if (!color || color === 'none') return color;
  const c = color.toLowerCase().trim();

  if (c === 'white' || c === '#fff' || c === '#ffffff') return '#1B3557';
  if (c === '#ffff00' || c === 'yellow') return '#f37021';
  if (c === '#cccccc' || c === '#ccc' || c === 'lightgray' || c === 'lightgrey') return '#666666';

  const hexMatch = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    if (r * 0.299 + g * 0.587 + b * 0.114 > 200) {
      return `#${(255 - r).toString(16).padStart(2, '0')}${(255 - g).toString(16).padStart(2, '0')}${(255 - b).toString(16).padStart(2, '0')}`;
    }
  }

  const rgbMatch = c.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    if (r * 0.299 + g * 0.587 + b * 0.114 > 200) {
      return `rgb(${255 - r}, ${255 - g}, ${255 - b})`;
    }
  }

  return color;
}

/**
 * Process SVG content string to invert light colors for white background display.
 * Handles both inline attributes and CSS style blocks.
 */
function processInvertedSvg(svgContent) {
  if (!svgContent) return svgContent;

  let result = svgContent;

  // Process CSS style blocks: replace color values in stroke/fill declarations
  result = result.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, css) => {
    let newCss = css;
    // Replace stroke colors
    newCss = newCss.replace(/stroke:\s*(#[0-9a-fA-F]{3,6}|white|yellow|lightgr[ae]y|rgb\([^)]+\))/gi,
      (m, color) => `stroke: ${invertColorForWhiteBg(color)}`);
    // Replace fill colors
    newCss = newCss.replace(/fill:\s*(#[0-9a-fA-F]{3,6}|white|yellow|lightgr[ae]y|rgb\([^)]+\))/gi,
      (m, color) => {
        if (color.trim() === 'none') return m;
        return `fill: ${invertColorForWhiteBg(color)}`;
      });
    return match.replace(css, newCss);
  });

  // Process inline stroke/fill attributes
  result = result.replace(/stroke="(#[0-9a-fA-F]{3,6}|white|yellow)"/gi,
    (m, color) => `stroke="${invertColorForWhiteBg(color)}"`);
  result = result.replace(/fill="(#[0-9a-fA-F]{3,6}|white|yellow)"/gi,
    (m, color) => {
      if (color.trim() === 'none') return m;
      return `fill="${invertColorForWhiteBg(color)}"`;
    });

  return result;
}

// ── Mode: "heaters" or "builder" ────────────────────────────────────────

const HEATER_POINT_TYPES = [
  { id: 'reflectorTopLeft', label: 'Reflector Top-Left', color: '#ff6b6b' },
  { id: 'reflectorTopRight', label: 'Reflector Top-Right', color: '#ff6b6b' },
  { id: 'reflectorBottomLeft', label: 'Reflector Bottom-Left', color: '#ff6b6b' },
  { id: 'reflectorBottomRight', label: 'Reflector Bottom-Right', color: '#ff6b6b' },
  { id: 'burner', label: 'Burner Corner', color: '#4ecdc4' },
];

const BUILDER_POINT_TYPES = [
  { id: 'inlet', label: 'Inlet Face Center', color: '#4ecdc4' },
  { id: 'outlet', label: 'Outlet Face Center', color: '#ff6b6b' },
];

const DIRECTION_OPTIONS = [
  { value: 0, label: 'Right (0°)' },
  { value: 90, label: 'Down (90°)' },
  { value: 180, label: 'Left (180°)' },
  { value: 270, label: 'Up (270°)' },
];

// Get unique heater SVGs
function getUniqueSvgs() {
  const seen = new Set();
  const unique = [];
  for (const model of HEATER_MODELS_FROM_SVG) {
    if (!seen.has(model.svgPath)) {
      seen.add(model.svgPath);
      unique.push({
        path: model.svgPath,
        content: model.svgContent,
        label: model.label,
        dimensions: model.dimensions,
      });
    }
  }
  return unique;
}

// Get builder part SVGs
function getBuilderSvgs() {
  return BUILDER_PARTS.map((part) => ({
    path: part.svgPath,
    content: part.svgContent,
    label: part.label,
    partId: part.partId,
    fileName: part.fileName,
    type: part.type,
    dimensions: part.dimensions,
    defaultInlet: part.inlet,
    defaultOutlet: part.outlet,
  }));
}

export default function CalibratePage() {
  const [mode, setMode] = useState('builder'); // 'heaters' | 'builder'
  const [heaterSvgs] = useState(() => getUniqueSvgs());
  const [builderSvgs] = useState(() => getBuilderSvgs());
  const [selectedSvg, setSelectedSvg] = useState(null);

  // Heater anchors (original calibration)
  const [heaterAnchors, setHeaterAnchors] = useState(() => {
    try {
      const saved = localStorage.getItem('heaterAnchors');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  // Builder part anchors (inlet/outlet)
  const [builderAnchors, setBuilderAnchors] = useState(() => {
    try {
      const saved = localStorage.getItem('builderPartAnchors');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const [activePointType, setActivePointType] = useState(mode === 'builder' ? 'inlet' : 'reflectorTopLeft');
  const [directionForNext, setDirectionForNext] = useState(0);
  const svgContainerRef = useRef(null);
  const [viewBox, setViewBox] = useState(null);

  // Zoom & pan state
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOffsetStart = useRef({ x: 0, y: 0 });

  const svgList = mode === 'builder' ? builderSvgs : heaterSvgs;
  const pointTypes = mode === 'builder' ? BUILDER_POINT_TYPES : HEATER_POINT_TYPES;

  // Parse viewBox when SVG changes
  useEffect(() => {
    if (selectedSvg?.content) {
      const match = selectedSvg.content.match(/viewBox=["']([^"']+)["']/);
      if (match) {
        const parts = match[1].split(/\s+/).map(Number);
        if (parts.length >= 4) {
          setViewBox({ x: parts[0], y: parts[1], width: parts[2], height: parts[3] });
        }
      }
    }
    // Reset zoom/pan when switching SVGs
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, [selectedSvg]);

  // Persist anchors
  useEffect(() => {
    localStorage.setItem('heaterAnchors', JSON.stringify(heaterAnchors));
  }, [heaterAnchors]);
  useEffect(() => {
    localStorage.setItem('builderPartAnchors', JSON.stringify(builderAnchors));
  }, [builderAnchors]);

  // Reset selection when switching modes
  useEffect(() => {
    setSelectedSvg(null);
    setActivePointType(mode === 'builder' ? 'inlet' : 'reflectorTopLeft');
  }, [mode]);

  const getSvgKey = (svg) => {
    if (svg.fileName) return svg.fileName;
    const parts = svg.path.split('/');
    return parts[parts.length - 1];
  };

  // Padded viewBox adds 25% padding around the SVG for easier edge access
  const PAD_FACTOR = 0.25;
  const paddedViewBox = viewBox ? {
    x: viewBox.x - viewBox.width * PAD_FACTOR,
    y: viewBox.y - viewBox.height * PAD_FACTOR,
    width: viewBox.width * (1 + PAD_FACTOR * 2),
    height: viewBox.height * (1 + PAD_FACTOR * 2),
  } : null;

  // Zoomed/panned viewBox
  const displayViewBox = paddedViewBox ? {
    x: paddedViewBox.x + panOffset.x + (paddedViewBox.width * (1 - 1 / zoom)) / 2,
    y: paddedViewBox.y + panOffset.y + (paddedViewBox.height * (1 - 1 / zoom)) / 2,
    width: paddedViewBox.width / zoom,
    height: paddedViewBox.height / zoom,
  } : null;

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.max(0.5, Math.min(20, prev * delta)));
  };

  const handleMouseDown = (e) => {
    if (e.button === 1 || e.shiftKey || e.altKey) {
      // Middle-click or shift/alt+click to pan
      e.preventDefault();
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY };
      panOffsetStart.current = { ...panOffset };
    }
  };

  const handleMouseMove = (e) => {
    if (!isPanning.current || !displayViewBox || !svgContainerRef.current) return;
    const rect = svgContainerRef.current.getBoundingClientRect();
    const dx = (e.clientX - panStart.current.x) / rect.width * displayViewBox.width;
    const dy = (e.clientY - panStart.current.y) / rect.height * displayViewBox.height;
    setPanOffset({
      x: panOffsetStart.current.x - dx,
      y: panOffsetStart.current.y - dy,
    });
  };

  const handleMouseUp = () => {
    isPanning.current = false;
  };

  const handleSvgClick = (e) => {
    if (!selectedSvg || !displayViewBox || isPanning.current) return;

    // Use SVG's own coordinate transform to handle preserveAspectRatio correctly
    const svgEl = svgContainerRef.current;
    const pt = svgEl.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPt = pt.matrixTransform(svgEl.getScreenCTM().inverse());
    const svgX = svgPt.x;
    const svgY = svgPt.y;

    const svgKey = getSvgKey(selectedSvg);

    if (mode === 'builder') {
      // Builder mode: store inlet/outlet with direction angle
      const current = builderAnchors[svgKey] || {};
      setBuilderAnchors({
        ...builderAnchors,
        [svgKey]: {
          ...current,
          [activePointType]: { x: Math.round(svgX), y: Math.round(svgY), angle: directionForNext },
        },
      });
    } else {
      // Heater mode: original behavior
      const current = heaterAnchors[svgKey] || { reflector: {}, burner: [] };
      if (activePointType === 'burner') {
        setHeaterAnchors({
          ...heaterAnchors,
          [svgKey]: { ...current, burner: [...(current.burner || []), { x: svgX, y: svgY }] },
        });
      } else {
        setHeaterAnchors({
          ...heaterAnchors,
          [svgKey]: {
            ...current,
            reflector: { ...(current.reflector || {}), [activePointType]: { x: svgX, y: svgY } },
          },
        });
      }
    }
  };

  const clearPoint = (pointType, index = null) => {
    if (!selectedSvg) return;
    const svgKey = getSvgKey(selectedSvg);

    if (mode === 'builder') {
      const current = { ...builderAnchors[svgKey] };
      delete current[pointType];
      setBuilderAnchors({ ...builderAnchors, [svgKey]: current });
    } else {
      const current = heaterAnchors[svgKey];
      if (!current) return;
      if (pointType === 'burner' && index !== null) {
        setHeaterAnchors({
          ...heaterAnchors,
          [svgKey]: { ...current, burner: current.burner.filter((_, i) => i !== index) },
        });
      } else {
        const newReflector = { ...current.reflector };
        delete newReflector[pointType];
        setHeaterAnchors({ ...heaterAnchors, [svgKey]: { ...current, reflector: newReflector } });
      }
    }
  };

  const clearAllForSvg = () => {
    if (!selectedSvg) return;
    const svgKey = getSvgKey(selectedSvg);
    if (mode === 'builder') {
      const newAnchors = { ...builderAnchors };
      delete newAnchors[svgKey];
      setBuilderAnchors(newAnchors);
    } else {
      const newAnchors = { ...heaterAnchors };
      delete newAnchors[svgKey];
      setHeaterAnchors(newAnchors);
    }
  };

  const exportAnchors = () => {
    const data = mode === 'builder' ? builderAnchors : heaterAnchors;
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = mode === 'builder' ? 'builderPartAnchors.json' : 'heaterAnchors.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importAnchors = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (mode === 'builder') setBuilderAnchors(imported);
        else setHeaterAnchors(imported);
      } catch { alert('Invalid JSON file'); }
    };
    reader.readAsText(file);
  };

  // Points are now rendered directly in SVG viewBox coordinates
  const toSvgCoords = (pt) => ({ x: pt.x, y: pt.y });

  // Marker size scales with current view
  const markerSize = displayViewBox ? displayViewBox.width * 0.012 : 10;
  const fontSize = displayViewBox ? displayViewBox.width * 0.018 : 12;
  const strokeW = displayViewBox ? displayViewBox.width * 0.002 : 2;

  // Direction arrow offset for rendering
  const dirArrow = (pt, angle, len) => {
    const arrowLen = len || (displayViewBox ? displayViewBox.width * 0.04 : 30);
    const rad = (angle * Math.PI) / 180;
    return { x: pt.x + Math.cos(rad) * arrowLen, y: pt.y + Math.sin(rad) * arrowLen };
  };

  const currentAnchors = selectedSvg
    ? mode === 'builder'
      ? builderAnchors[getSvgKey(selectedSvg)]
      : heaterAnchors[getSvgKey(selectedSvg)]
    : null;

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#1a1a2e', color: 'white' }}>
      {/* Sidebar */}
      <div style={{ width: 280, borderRight: '1px solid #333', overflow: 'auto', padding: 16 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>SVG Calibration Tool</h2>

        {/* Mode Toggle */}
        <div style={{ display: 'flex', marginBottom: 12, gap: 4 }}>
          {['heaters', 'builder'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                padding: '6px 0',
                background: mode === m ? '#f37021' : '#333',
                border: 'none',
                borderRadius: 4,
                color: 'white',
                cursor: 'pointer',
                fontSize: 10,
                fontWeight: mode === m ? 600 : 400,
              }}
            >
              {m === 'heaters' ? 'Heater Models' : 'Builder Parts'}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
          <button
            onClick={exportAnchors}
            style={{
              flex: 1, padding: '8px 12px', background: '#4ecdc4', border: 'none',
              borderRadius: 4, color: 'white', cursor: 'pointer', fontSize: 11,
            }}
          >
            Export JSON
          </button>
          <label style={{
            flex: 1, padding: '8px 12px', background: '#666', border: 'none',
            borderRadius: 4, color: 'white', cursor: 'pointer', fontSize: 11, textAlign: 'center',
          }}>
            Import
            <input type="file" accept=".json" onChange={importAnchors} style={{ display: 'none' }} />
          </label>
        </div>

        <div style={{ fontSize: 10, color: '#888', marginBottom: 8 }}>
          {svgList.length} SVGs | {Object.keys(mode === 'builder' ? builderAnchors : heaterAnchors).length} calibrated
        </div>

        {svgList.map((svg) => {
          const svgKey = getSvgKey(svg);
          const anchors = mode === 'builder' ? builderAnchors : heaterAnchors;
          const hasAnchors = !!anchors[svgKey];
          let isComplete = false;
          if (mode === 'builder') {
            isComplete = hasAnchors && anchors[svgKey]?.inlet && anchors[svgKey]?.outlet;
            // Burner only needs outlet
            if (svg.type === 'burner') isComplete = hasAnchors && anchors[svgKey]?.outlet;
          } else {
            isComplete = hasAnchors &&
              anchors[svgKey]?.reflector?.reflectorTopLeft &&
              anchors[svgKey]?.reflector?.reflectorTopRight &&
              anchors[svgKey]?.reflector?.reflectorBottomLeft &&
              anchors[svgKey]?.reflector?.reflectorBottomRight;
          }

          return (
            <div
              key={svg.path}
              onClick={() => setSelectedSvg(svg)}
              style={{
                padding: '8px 12px',
                marginBottom: 4,
                background: selectedSvg?.path === svg.path ? '#333' : 'transparent',
                borderRadius: 4,
                cursor: 'pointer',
                borderLeft: isComplete ? '3px solid #4ecdc4' : hasAnchors ? '3px solid #ff6b6b' : '3px solid transparent',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 500 }}>{svg.label || svgKey}</div>
              <div style={{ fontSize: 9, color: '#888' }}>
                {isComplete ? 'Complete' : hasAnchors ? 'Partial' : 'Not calibrated'}
                {mode === 'builder' && svg.type && <span> ({svg.type})</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <div style={{ padding: 12, borderBottom: '1px solid #333', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#888', marginRight: 8 }}>Click to place:</span>
          {pointTypes.map((pt) => (
            <button
              key={pt.id}
              onClick={() => setActivePointType(pt.id)}
              style={{
                padding: '6px 12px',
                background: activePointType === pt.id ? pt.color : '#333',
                border: `1px solid ${pt.color}`,
                borderRadius: 4,
                color: 'white',
                cursor: 'pointer',
                fontSize: 10,
              }}
            >
              {pt.label}
            </button>
          ))}

          {/* Direction selector for builder mode */}
          {mode === 'builder' && (
            <>
              <span style={{ fontSize: 11, color: '#888', marginLeft: 12 }}>Face direction:</span>
              <select
                value={directionForNext}
                onChange={(e) => setDirectionForNext(Number(e.target.value))}
                style={{
                  padding: '5px 8px',
                  background: '#333',
                  border: '1px solid #555',
                  borderRadius: 4,
                  color: 'white',
                  fontSize: 10,
                }}
              >
                {DIRECTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </>
          )}

          {selectedSvg && (
            <button
              onClick={clearAllForSvg}
              style={{
                marginLeft: 'auto', padding: '6px 12px', background: '#333',
                border: '1px solid #666', borderRadius: 4, color: '#ff6b6b',
                cursor: 'pointer', fontSize: 10,
              }}
            >
              Clear All Points
            </button>
          )}
        </div>

        {/* SVG Display */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16, position: 'relative', overflow: 'hidden' }}>
          {selectedSvg && displayViewBox ? (
            <svg
              ref={svgContainerRef}
              viewBox={`${displayViewBox.x} ${displayViewBox.y} ${displayViewBox.width} ${displayViewBox.height}`}
              preserveAspectRatio="xMidYMid meet"
              style={{ width: '100%', height: '100%', cursor: isPanning.current ? 'grabbing' : 'crosshair' }}
              onClick={handleSvgClick}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Grid pattern definition */}
              {(() => {
                const gridSize = paddedViewBox.width * 0.005; // ~200 squares across
                return (
                  <defs>
                    <pattern id="calibGrid" x={0} y={0} width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
                      <line x1={0} y1={0} x2={gridSize} y2={0} stroke="#e8e8e8" strokeWidth={paddedViewBox.width * 0.0003} />
                      <line x1={0} y1={0} x2={0} y2={gridSize} stroke="#e8e8e8" strokeWidth={paddedViewBox.width * 0.0003} />
                    </pattern>
                  </defs>
                );
              })()}
              {/* White background with padding */}
              <rect
                x={paddedViewBox.x} y={paddedViewBox.y}
                width={paddedViewBox.width} height={paddedViewBox.height}
                fill="white" rx={displayViewBox.width * 0.005}
              />
              {/* Subtle border around actual SVG area */}
              {viewBox && (
                <rect
                  x={viewBox.x} y={viewBox.y}
                  width={viewBox.width} height={viewBox.height}
                  fill="none" stroke="#d0d0d0" strokeWidth={displayViewBox.width * 0.001}
                  strokeDasharray={`${displayViewBox.width * 0.003},${displayViewBox.width * 0.003}`}
                />
              )}
              {/* SVG content with color inversion */}
              <g dangerouslySetInnerHTML={{ __html: processInvertedSvg(selectedSvg.content).replace(/<\?xml[^?]*\?>/, '').replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '') }} />

              {/* Grid overlay on top of SVG */}
              <rect
                x={paddedViewBox.x} y={paddedViewBox.y}
                width={paddedViewBox.width} height={paddedViewBox.height}
                fill="url(#calibGrid)" style={{ pointerEvents: 'none' }}
              />

              {/* Render placed points */}
              {currentAnchors && (
                <g>
                  {mode === 'builder' ? (
                    // Builder mode: inlet/outlet points with direction arrows
                    <>
                      {['inlet', 'outlet'].map((key) => {
                        const pt = currentAnchors[key];
                        if (!pt) return null;
                        const pos = toSvgCoords(pt);
                        const ptType = BUILDER_POINT_TYPES.find((p) => p.id === key);
                        const arrowEnd = dirArrow(pos, pt.angle);
                        return (
                          <g key={key}>
                            <circle
                              cx={pos.x} cy={pos.y} r={markerSize}
                              fill={ptType.color} stroke="white" strokeWidth={strokeW}
                              style={{ cursor: 'pointer' }}
                              onClick={(e) => { e.stopPropagation(); clearPoint(key); }}
                            />
                            <line
                              x1={pos.x} y1={pos.y}
                              x2={arrowEnd.x} y2={arrowEnd.y}
                              stroke={ptType.color} strokeWidth={strokeW * 1.5}
                            />
                            <circle cx={arrowEnd.x} cy={arrowEnd.y} r={markerSize * 0.5} fill={ptType.color} />
                            <text
                              x={pos.x} y={pos.y - markerSize * 1.8}
                              textAnchor="middle" fill={ptType.color} fontSize={fontSize} fontWeight="bold"
                              stroke="white" strokeWidth={strokeW * 2} paintOrder="stroke"
                            >
                              {key.toUpperCase()} ({pt.angle}°)
                            </text>
                          </g>
                        );
                      })}
                    </>
                  ) : (
                    // Heater mode: reflector + burner points
                    <>
                      {Object.entries(currentAnchors.reflector || {}).map(([key, pt]) => {
                        const pos = toSvgCoords(pt);
                        const ptType = HEATER_POINT_TYPES.find((p) => p.id === key);
                        return (
                          <g key={key}>
                            <circle
                              cx={pos.x} cy={pos.y} r={markerSize}
                              fill={ptType?.color || '#ff6b6b'} stroke="white" strokeWidth={strokeW}
                              style={{ cursor: 'pointer' }}
                              onClick={(e) => { e.stopPropagation(); clearPoint(key); }}
                            />
                            <text
                              x={pos.x} y={pos.y - markerSize * 1.5}
                              textAnchor="middle" fill={ptType?.color || '#ff6b6b'} fontSize={fontSize * 0.8}
                              stroke="white" strokeWidth={strokeW * 2} paintOrder="stroke"
                            >
                              {ptType?.label?.replace('Reflector ', '')}
                            </text>
                          </g>
                        );
                      })}
                      {(currentAnchors.burner || []).map((pt, i) => {
                        const pos = toSvgCoords(pt);
                        return (
                          <g key={`burner-${i}`}>
                            <circle
                              cx={pos.x} cy={pos.y} r={markerSize * 0.75}
                              fill="#4ecdc4" stroke="white" strokeWidth={strokeW}
                              style={{ cursor: 'pointer' }}
                              onClick={(e) => { e.stopPropagation(); clearPoint('burner', i); }}
                            />
                            <text
                              x={pos.x} y={pos.y - markerSize * 1.3}
                              textAnchor="middle" fill="#4ecdc4" fontSize={fontSize * 0.7}
                              stroke="white" strokeWidth={strokeW * 2} paintOrder="stroke"
                            >
                              B{i + 1}
                            </text>
                          </g>
                        );
                      })}
                      {/* Reflector rectangle */}
                      {currentAnchors.reflector?.reflectorTopLeft &&
                        currentAnchors.reflector?.reflectorTopRight &&
                        currentAnchors.reflector?.reflectorBottomLeft &&
                        currentAnchors.reflector?.reflectorBottomRight && (
                          <polygon
                            points={[
                              toSvgCoords(currentAnchors.reflector.reflectorTopLeft),
                              toSvgCoords(currentAnchors.reflector.reflectorTopRight),
                              toSvgCoords(currentAnchors.reflector.reflectorBottomRight),
                              toSvgCoords(currentAnchors.reflector.reflectorBottomLeft),
                            ].map((p) => `${p.x},${p.y}`).join(' ')}
                            fill="rgba(255, 107, 107, 0.1)"
                            stroke="#ff6b6b" strokeWidth={strokeW} strokeDasharray={`${markerSize},${markerSize * 0.5}`}
                          />
                        )}
                    </>
                  )}
                </g>
              )}
            </svg>
          ) : (
            <div style={{ color: '#666', fontSize: 14 }}>
              Select an SVG from the list to begin calibration
            </div>
          )}
        </div>

        {/* Info Panel */}
        {selectedSvg && viewBox && (
          <div style={{ padding: 12, borderTop: '1px solid #333', fontSize: 10, color: '#888', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span><strong>Zoom:</strong> {(zoom * 100).toFixed(0)}%</span>
            <button
              onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }}
              style={{ padding: '2px 8px', background: '#333', border: '1px solid #555', borderRadius: 3, color: '#aaa', cursor: 'pointer', fontSize: 9 }}
            >
              Reset View
            </button>
            <span><strong>ViewBox:</strong> {viewBox.x}, {viewBox.y}, {viewBox.width}, {viewBox.height}</span>
            {mode === 'builder' && currentAnchors && (
              <span>
                <strong>Inlet:</strong> {currentAnchors.inlet ? `(${currentAnchors.inlet.x}, ${currentAnchors.inlet.y}) ${currentAnchors.inlet.angle}°` : 'not set'}
                {' | '}
                <strong>Outlet:</strong> {currentAnchors.outlet ? `(${currentAnchors.outlet.x}, ${currentAnchors.outlet.y}) ${currentAnchors.outlet.angle}°` : 'not set'}
              </span>
            )}
            {mode === 'builder' && selectedSvg.defaultInlet && (
              <span>
                <strong>Defaults:</strong> In({selectedSvg.defaultInlet.x}, {selectedSvg.defaultInlet.y}) {selectedSvg.defaultInlet.angle}°
                {' | Out('}
                {selectedSvg.defaultOutlet?.x}, {selectedSvg.defaultOutlet?.y}) {selectedSvg.defaultOutlet?.angle}°
              </span>
            )}
            <span style={{ color: '#666' }}>Scroll to zoom | Shift+drag to pan | Click to place | Click points to delete</span>
          </div>
        )}
      </div>
    </div>
  );
}
