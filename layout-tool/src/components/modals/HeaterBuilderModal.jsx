import { useState, useMemo, useRef, useEffect } from 'react';
import { BUILDER_PARTS, getBuilderPart } from '../../utils/builderPartsCatalog';
import { calculatePlacements, computeBoundingBox, composeHeaterSvg, stripAndNamespace } from '../../utils/heaterComposer';

// Color inversion for white/light SVG colors (same as HeaterGlyph)
function invertColorForWhiteBg(color) {
  if (!color || color === 'none') return color;
  const c = color.toLowerCase().trim();
  if (c === 'white' || c === '#fff' || c === '#ffffff') return '#1B3557';
  if (c === '#ffff00' || c === 'yellow') return '#f37021';
  if (c === '#cccccc' || c === '#ccc') return '#666666';
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
  return color;
}

// Process SVG content: invert colors for display on white/light backgrounds
// Color inversion for preview on white background (after catalog color remap)
function invertForPreview(svgInner) {
  return svgInner
    .replace(/stroke:\s*#fff(?:fff)?(?![0-9a-f])/gi, 'stroke: #1B3557')
    .replace(/stroke:\s*white/gi, 'stroke: #1B3557')
    .replace(/stroke:\s*#ffff00/gi, 'stroke: #f37021')
    .replace(/fill:\s*#fff(?:fff)?(?![0-9a-f])/gi, 'fill: #1B3557')
    .replace(/fill:\s*white/gi, 'fill: #1B3557')
    .replace(/#ffffff/gi, '#1B3557')
    .replace(/#ffff00/gi, '#f37021');
}

// Available parts for the palette, grouped by type
const TUBE_PARTS = BUILDER_PARTS.filter((p) => p.type === 'tube');
const TURN_PARTS = BUILDER_PARTS.filter((p) => p.type === 'turn90' || p.type === 'turn180');
const BURNER_PART = BUILDER_PARTS.find((p) => p.type === 'burner' && !p.isStainless);

export default function HeaterBuilderModal({ onClose, onSave }) {
  // Recipe: array of { partId }
  const [recipe, setRecipe] = useState(
    BURNER_PART ? [{ partId: BURNER_PART.partId }] : []
  );
  const [label, setLabel] = useState('');
  const [series, setSeries] = useState('LS3');
  const [kbtu, setKbtu] = useState('');
  const previewRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Calculate placements for the current recipe
  const placements = useMemo(
    () => calculatePlacements(recipe, getBuilderPart),
    [recipe]
  );

  const bbox = useMemo(
    () => (placements.length > 0 ? computeBoundingBox(placements) : null),
    [placements]
  );

  // Total tube length
  const totalLengthFt = useMemo(
    () => recipe.reduce((sum, r) => sum + (getBuilderPart(r.partId)?.lengthFt || 0), 0),
    [recipe]
  );

  // Part counts
  const partCounts = useMemo(() => {
    const counts = { tubes: 0, turns90: 0, turns180: 0 };
    recipe.forEach((r) => {
      const p = getBuilderPart(r.partId);
      if (!p) return;
      if (p.type === 'tube') counts.tubes++;
      else if (p.type === 'turn90') counts.turns90++;
      else if (p.type === 'turn180') counts.turns180++;
    });
    return counts;
  }, [recipe]);

  const addPart = (partId) => {
    setRecipe((prev) => [...prev, { partId }]);
  };

  const removeLast = () => {
    if (recipe.length <= 1) return; // Keep burner
    setRecipe((prev) => prev.slice(0, -1));
  };

  const handleSave = () => {
    const result = composeHeaterSvg(recipe, getBuilderPart);
    if (!result) return;

    const kbtuVal = parseInt(kbtu, 10) || 0;
    const customLabel = label.trim() || `${series} Custom ${totalLengthFt}'${kbtuVal ? ` ${kbtuVal}kBTU` : ''}`;
    const model = {
      id: `custom__${crypto.randomUUID()}`,
      label: customLabel,
      categoryId: 'custom',
      svgContent: result.svgContent,
      svgPath: null,
      dimensions: result.dimensions,
      kbtu: kbtuVal,
      lengthFt: totalLengthFt,
      series,
      isElectric: false,
      isCustom: true,
      builderRecipe: recipe,
    };

    onSave(model);
  };

  // Auto-generate label suggestion
  useEffect(() => {
    if (!label) return; // Don't override if user has typed something
  }, [recipe]);

  const defaultLabel = `${series} Custom ${totalLengthFt}'${kbtu ? ` ${kbtu}kBTU` : ''}${partCounts.turns90 > 0 ? ` ${partCounts.turns90}x90°` : ''}${partCounts.turns180 > 0 ? ` ${partCounts.turns180}x180°` : ''}`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,30,48,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1B2B3D',
          borderRadius: 10,
          width: 820,
          maxWidth: '95vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ color: 'white', fontSize: 15, fontWeight: 500 }}>
            Build Custom Unit
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.5)',
              fontSize: 18,
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Preview Pane */}
          <div
            style={{
              flex: 1,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              borderRight: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div
              style={{
                fontSize: 8,
                letterSpacing: 2,
                color: 'rgba(255,255,255,0.35)',
                marginBottom: 8,
              }}
            >
              PREVIEW
            </div>
            <div
              ref={previewRef}
              style={{
                flex: 1,
                minHeight: 250,
                background: 'rgba(255,255,255,0.95)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {bbox && placements.length > 0 ? (
                <svg
                  viewBox={`${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`}
                  style={{ width: '100%', height: '100%', padding: 16 }}
                  preserveAspectRatio="xMidYMid meet"
                >
                  {placements.map(({ part, worldX, worldY, rotation, scale }, idx) => {
                    const inner = invertForPreview(stripAndNamespace(part.svgContent, idx, part.type));
                    return (
                      <g
                        key={idx}
                        transform={`translate(${worldX}, ${worldY}) rotate(${rotation}) scale(${scale})`}
                        dangerouslySetInnerHTML={{ __html: inner }}
                      />
                    );
                  })}
                </svg>
              ) : (
                <div style={{ color: '#999', fontSize: 12 }}>
                  No parts added
                </div>
              )}
            </div>

            {/* Stats */}
            <div
              style={{
                marginTop: 12,
                display: 'flex',
                gap: 16,
                fontSize: 11,
                color: 'rgba(255,255,255,0.6)',
              }}
            >
              <span>
                Total Length: <strong style={{ color: '#f37021' }}>{totalLengthFt}'</strong>
              </span>
              <span>Parts: {recipe.length}</span>
              {partCounts.turns90 > 0 && <span>90° Turns: {partCounts.turns90}</span>}
              {partCounts.turns180 > 0 && <span>180° Turns: {partCounts.turns180}</span>}
            </div>
          </div>

          {/* Parts Palette */}
          <div style={{ width: 280, padding: 20, overflowY: 'auto' }}>
            <div
              style={{
                fontSize: 8,
                letterSpacing: 2,
                color: 'rgba(255,255,255,0.35)',
                marginBottom: 8,
              }}
            >
              ADD PARTS
            </div>

            {/* Tube sections */}
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 9,
                  color: 'rgba(255,255,255,0.45)',
                  marginBottom: 6,
                  fontWeight: 500,
                }}
              >
                Tube Sections
              </div>
              {TUBE_PARTS.map((part) => (
                <button
                  key={part.partId}
                  onClick={() => addPart(part.partId)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    marginBottom: 4,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 4,
                    color: 'rgba(255,255,255,0.7)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    fontSize: 11,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>{part.label}</span>
                  <span style={{ fontSize: 9, opacity: 0.5 }}>+</span>
                </button>
              ))}
            </div>

            {/* Turns */}
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 9,
                  color: 'rgba(255,255,255,0.45)',
                  marginBottom: 6,
                  fontWeight: 500,
                }}
              >
                Turns
              </div>
              {TURN_PARTS.map((part) => (
                <button
                  key={part.partId}
                  onClick={() => addPart(part.partId)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    marginBottom: 4,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 4,
                    color: 'rgba(255,255,255,0.7)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    fontSize: 11,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>{part.label}</span>
                  <span style={{ fontSize: 9, opacity: 0.5 }}>+</span>
                </button>
              ))}
            </div>

            {/* Undo */}
            <button
              onClick={removeLast}
              disabled={recipe.length <= 1}
              style={{
                width: '100%',
                padding: '8px 12px',
                marginBottom: 16,
                background: recipe.length > 1 ? 'rgba(255,100,100,0.1)' : 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,100,100,0.2)',
                borderRadius: 4,
                color: recipe.length > 1 ? 'rgba(255,100,100,0.8)' : 'rgba(255,255,255,0.2)',
                cursor: recipe.length > 1 ? 'pointer' : 'default',
                fontFamily: 'inherit',
                fontSize: 11,
              }}
            >
              Remove Last Part
            </button>

            {/* Recipe list */}
            <div
              style={{
                fontSize: 8,
                letterSpacing: 2,
                color: 'rgba(255,255,255,0.35)',
                marginBottom: 6,
              }}
            >
              CURRENT PARTS
            </div>
            <div style={{ maxHeight: 150, overflowY: 'auto' }}>
              {recipe.map((r, i) => {
                const part = getBuilderPart(r.partId);
                return (
                  <div
                    key={i}
                    style={{
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.5)',
                      padding: '3px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    {i + 1}. {part?.label || r.partId}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <select
            value={series}
            onChange={(e) => setSeries(e.target.value)}
            style={{
              padding: '8px 10px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 4,
              color: 'white',
              fontSize: 12,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          >
            <option value="LS3" style={{ background: '#1B2B3D', color: 'white' }}>LS3</option>
            <option value="HL3" style={{ background: '#1B2B3D', color: 'white' }}>HL3</option>
            <option value="LD3" style={{ background: '#1B2B3D', color: 'white' }}>LD3</option>
          </select>
          <input
            type="number"
            value={kbtu}
            onChange={(e) => setKbtu(e.target.value)}
            placeholder="kBTU"
            style={{
              width: 70,
              padding: '8px 10px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 4,
              color: 'white',
              fontSize: 12,
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={defaultLabel}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 4,
              color: 'white',
              fontSize: 12,
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4,
              color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={recipe.length < 2}
            style={{
              padding: '8px 24px',
              background: recipe.length >= 2 ? '#f37021' : 'rgba(243,112,33,0.3)',
              border: 'none',
              borderRadius: 4,
              color: 'white',
              cursor: recipe.length >= 2 ? 'pointer' : 'default',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Save & Place
          </button>
        </div>
      </div>
    </div>
  );
}
