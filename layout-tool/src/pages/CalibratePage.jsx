import { useState, useRef, useEffect } from 'react';
import { HEATER_MODELS_FROM_SVG } from '../utils/heaterCatalog';

// Point types for labeling
const POINT_TYPES = [
  { id: 'reflectorTopLeft', label: 'Reflector Top-Left', color: '#ff6b6b' },
  { id: 'reflectorTopRight', label: 'Reflector Top-Right', color: '#ff6b6b' },
  { id: 'reflectorBottomLeft', label: 'Reflector Bottom-Left', color: '#ff6b6b' },
  { id: 'reflectorBottomRight', label: 'Reflector Bottom-Right', color: '#ff6b6b' },
  { id: 'burner', label: 'Burner Corner', color: '#4ecdc4' },
];

// Get unique SVGs (dedupe by svgPath)
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

export default function CalibratePage() {
  const [svgList] = useState(() => getUniqueSvgs());
  const [selectedSvg, setSelectedSvg] = useState(null);
  const [anchors, setAnchors] = useState(() => {
    // Load from localStorage
    const saved = localStorage.getItem('heaterAnchors');
    return saved ? JSON.parse(saved) : {};
  });
  const [activePointType, setActivePointType] = useState('reflectorTopLeft');
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const svgContainerRef = useRef(null);
  const [viewBox, setViewBox] = useState(null);

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
  }, [selectedSvg]);

  // Save anchors to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('heaterAnchors', JSON.stringify(anchors));
  }, [anchors]);

  const getSvgKey = (svg) => {
    // Extract filename from path
    const parts = svg.path.split('/');
    return parts[parts.length - 1];
  };

  const handleSvgClick = (e) => {
    if (!selectedSvg || !viewBox) return;

    const container = svgContainerRef.current;
    const rect = container.getBoundingClientRect();

    // Get click position relative to container
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert to viewBox coordinates
    const svgX = viewBox.x + (clickX / rect.width) * viewBox.width;
    const svgY = viewBox.y + (clickY / rect.height) * viewBox.height;

    const svgKey = getSvgKey(selectedSvg);
    const currentAnchors = anchors[svgKey] || { reflector: {}, burner: [] };

    if (activePointType === 'burner') {
      // Burner points are stored as an array
      const newBurner = [...(currentAnchors.burner || []), { x: svgX, y: svgY }];
      setAnchors({
        ...anchors,
        [svgKey]: { ...currentAnchors, burner: newBurner },
      });
    } else {
      // Reflector points are stored by name
      const newReflector = {
        ...(currentAnchors.reflector || {}),
        [activePointType]: { x: svgX, y: svgY },
      };
      setAnchors({
        ...anchors,
        [svgKey]: { ...currentAnchors, reflector: newReflector },
      });
    }
  };

  const clearPoint = (pointType, index = null) => {
    if (!selectedSvg) return;
    const svgKey = getSvgKey(selectedSvg);
    const currentAnchors = anchors[svgKey];
    if (!currentAnchors) return;

    if (pointType === 'burner' && index !== null) {
      const newBurner = currentAnchors.burner.filter((_, i) => i !== index);
      setAnchors({
        ...anchors,
        [svgKey]: { ...currentAnchors, burner: newBurner },
      });
    } else if (pointType !== 'burner') {
      const newReflector = { ...currentAnchors.reflector };
      delete newReflector[pointType];
      setAnchors({
        ...anchors,
        [svgKey]: { ...currentAnchors, reflector: newReflector },
      });
    }
  };

  const clearAllForSvg = () => {
    if (!selectedSvg) return;
    const svgKey = getSvgKey(selectedSvg);
    const newAnchors = { ...anchors };
    delete newAnchors[svgKey];
    setAnchors(newAnchors);
  };

  const exportAnchors = () => {
    const json = JSON.stringify(anchors, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'heaterAnchors.json';
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
        setAnchors(imported);
      } catch (err) {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  const currentSvgAnchors = selectedSvg ? anchors[getSvgKey(selectedSvg)] : null;

  // Convert viewBox coords to screen coords for rendering points
  const toScreenCoords = (pt) => {
    if (!viewBox || !svgContainerRef.current) return { x: 0, y: 0 };
    const rect = svgContainerRef.current.getBoundingClientRect();
    return {
      x: ((pt.x - viewBox.x) / viewBox.width) * rect.width,
      y: ((pt.y - viewBox.y) / viewBox.height) * rect.height,
    };
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#1a1a2e', color: 'white' }}>
      {/* Sidebar - SVG List */}
      <div style={{ width: 280, borderRight: '1px solid #333', overflow: 'auto', padding: 16 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16 }}>SVG Calibration Tool</h2>

        <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          <button
            onClick={exportAnchors}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: '#4ecdc4',
              border: 'none',
              borderRadius: 4,
              color: 'white',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            Export JSON
          </button>
          <label style={{
            flex: 1,
            padding: '8px 12px',
            background: '#666',
            border: 'none',
            borderRadius: 4,
            color: 'white',
            cursor: 'pointer',
            fontSize: 11,
            textAlign: 'center',
          }}>
            Import
            <input type="file" accept=".json" onChange={importAnchors} style={{ display: 'none' }} />
          </label>
        </div>

        <div style={{ fontSize: 10, color: '#888', marginBottom: 8 }}>
          {svgList.length} SVGs | {Object.keys(anchors).length} calibrated
        </div>

        {svgList.map((svg) => {
          const svgKey = getSvgKey(svg);
          const hasAnchors = !!anchors[svgKey];
          const isComplete = hasAnchors &&
            anchors[svgKey].reflector?.reflectorTopLeft &&
            anchors[svgKey].reflector?.reflectorTopRight &&
            anchors[svgKey].reflector?.reflectorBottomLeft &&
            anchors[svgKey].reflector?.reflectorBottomRight;

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
              <div style={{ fontSize: 11, fontWeight: 500 }}>{svgKey}</div>
              <div style={{ fontSize: 9, color: '#888' }}>
                {isComplete ? 'Complete' : hasAnchors ? 'Partial' : 'Not calibrated'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Area - SVG Viewer */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <div style={{ padding: 12, borderBottom: '1px solid #333', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#888', marginRight: 8 }}>Click to place:</span>
          {POINT_TYPES.map((pt) => (
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

          {selectedSvg && (
            <button
              onClick={clearAllForSvg}
              style={{
                marginLeft: 'auto',
                padding: '6px 12px',
                background: '#333',
                border: '1px solid #666',
                borderRadius: 4,
                color: '#ff6b6b',
                cursor: 'pointer',
                fontSize: 10,
              }}
            >
              Clear All Points
            </button>
          )}
        </div>

        {/* SVG Display */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 32, position: 'relative' }}>
          {selectedSvg ? (
            <div
              ref={svgContainerRef}
              onClick={handleSvgClick}
              style={{
                position: 'relative',
                maxWidth: '90%',
                maxHeight: '90%',
                cursor: 'crosshair',
              }}
            >
              <div
                dangerouslySetInnerHTML={{ __html: selectedSvg.content }}
                style={{
                  width: '100%',
                  height: 'auto',
                  background: 'white',
                  borderRadius: 4,
                }}
              />

              {/* Render placed points */}
              {currentSvgAnchors && (
                <svg
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                  }}
                >
                  {/* Reflector points */}
                  {Object.entries(currentSvgAnchors.reflector || {}).map(([key, pt]) => {
                    const screen = toScreenCoords(pt);
                    const pointType = POINT_TYPES.find((p) => p.id === key);
                    return (
                      <g key={key}>
                        <circle
                          cx={screen.x}
                          cy={screen.y}
                          r={8}
                          fill={pointType?.color || '#ff6b6b'}
                          stroke="white"
                          strokeWidth={2}
                          style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            clearPoint(key);
                          }}
                        />
                        <text
                          x={screen.x}
                          y={screen.y - 12}
                          textAnchor="middle"
                          fill="white"
                          fontSize={10}
                          style={{ pointerEvents: 'none' }}
                        >
                          {pointType?.label?.replace('Reflector ', '')}
                        </text>
                      </g>
                    );
                  })}

                  {/* Burner points */}
                  {(currentSvgAnchors.burner || []).map((pt, i) => {
                    const screen = toScreenCoords(pt);
                    return (
                      <g key={`burner-${i}`}>
                        <circle
                          cx={screen.x}
                          cy={screen.y}
                          r={6}
                          fill="#4ecdc4"
                          stroke="white"
                          strokeWidth={2}
                          style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            clearPoint('burner', i);
                          }}
                        />
                        <text
                          x={screen.x}
                          y={screen.y - 10}
                          textAnchor="middle"
                          fill="white"
                          fontSize={9}
                        >
                          B{i + 1}
                        </text>
                      </g>
                    );
                  })}

                  {/* Draw reflector rectangle if all 4 corners exist */}
                  {currentSvgAnchors.reflector?.reflectorTopLeft &&
                    currentSvgAnchors.reflector?.reflectorTopRight &&
                    currentSvgAnchors.reflector?.reflectorBottomLeft &&
                    currentSvgAnchors.reflector?.reflectorBottomRight && (
                      <polygon
                        points={[
                          toScreenCoords(currentSvgAnchors.reflector.reflectorTopLeft),
                          toScreenCoords(currentSvgAnchors.reflector.reflectorTopRight),
                          toScreenCoords(currentSvgAnchors.reflector.reflectorBottomRight),
                          toScreenCoords(currentSvgAnchors.reflector.reflectorBottomLeft),
                        ].map((p) => `${p.x},${p.y}`).join(' ')}
                        fill="rgba(255, 107, 107, 0.1)"
                        stroke="#ff6b6b"
                        strokeWidth={2}
                        strokeDasharray="4,2"
                      />
                    )}
                </svg>
              )}
            </div>
          ) : (
            <div style={{ color: '#666', fontSize: 14 }}>
              Select an SVG from the list to begin calibration
            </div>
          )}
        </div>

        {/* Info Panel */}
        {selectedSvg && viewBox && (
          <div style={{ padding: 12, borderTop: '1px solid #333', fontSize: 10, color: '#888' }}>
            <strong>ViewBox:</strong> {viewBox.x}, {viewBox.y}, {viewBox.width}, {viewBox.height}
            {currentSvgAnchors && (
              <span style={{ marginLeft: 16 }}>
                <strong>Points:</strong> {Object.keys(currentSvgAnchors.reflector || {}).length} reflector, {(currentSvgAnchors.burner || []).length} burner
              </span>
            )}
            <span style={{ marginLeft: 16 }}>
              <strong>Tip:</strong> Click points to delete them
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
