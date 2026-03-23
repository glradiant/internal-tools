import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { BUILDER_PARTS, getBuilderPart } from '../../utils/builderPartsCatalog';
import { calculatePlacements, computeBoundingBox, composeHeaterSvg, stripAndNamespace, detectWarnings, resolveWarningMessages } from '../../utils/heaterComposer';

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
  // Recipe: array of { partId, flipped? }
  const [recipe, setRecipe] = useState(
    BURNER_PART ? [{ partId: BURNER_PART.partId }] : []
  );
  const [label, setLabel] = useState('');
  const [labelEdited, setLabelEdited] = useState(false);
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

  // Use a revision counter to force re-render on recipe changes (fixes flip disappearing bug)
  const [revision, setRevision] = useState(0);
  const updateRecipe = useCallback((updater) => {
    setRecipe(updater);
    setRevision(r => r + 1);
  }, []);

  // Calculate placements for the current recipe
  const placements = useMemo(
    () => calculatePlacements(recipe, getBuilderPart),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recipe, revision]
  );

  const bbox = useMemo(
    () => (placements.length > 0 ? computeBoundingBox(placements) : null),
    [placements]
  );

  // Warnings (overlap, length, U-turn) — messages are cached so they don't change on every render
  const warningCacheRef = useRef(new Map());
  const warnings = useMemo(() => {
    const raw = detectWarnings(recipe, placements, getBuilderPart);
    return resolveWarningMessages(raw, warningCacheRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe, revision, placements]);

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
    const part = getBuilderPart(partId);
    // Smart default: if adding a 90° turn after an existing 90° turn, default to S-config (flipped)
    if (part?.type === 'turn90' && recipe.length > 0) {
      const lastEntry = recipe[recipe.length - 1];
      const lastPart = getBuilderPart(lastEntry.partId);
      if (lastPart?.type === 'turn90') {
        // S-config = opposite flip state from the previous 90
        const flipped = !lastEntry.flipped;
        updateRecipe((prev) => [...prev, { partId, flipped }]);
        return;
      }
    }
    updateRecipe((prev) => [...prev, { partId }]);
  };

  const removeLast = () => {
    if (recipe.length <= 1) return; // Keep burner
    updateRecipe((prev) => prev.slice(0, -1));
  };

  const removePart = (index) => {
    if (index === 0) return; // Can't remove burner
    updateRecipe((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleFlip = (index) => {
    updateRecipe((prev) => prev.map((r, i) =>
      i === index ? { ...r, flipped: !r.flipped } : r
    ));
  };

  const resetRecipe = () => {
    updateRecipe(() => BURNER_PART ? [{ partId: BURNER_PART.partId }] : []);
    setLabelEdited(false);
  };

  const handleSave = () => {
    const result = composeHeaterSvg(recipe, getBuilderPart);
    if (!result) return;

    const kbtuVal = parseInt(kbtu, 10) || 0;
    const customLabel = label.trim() || defaultLabel;
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

  const defaultLabel = `${series} Custom ${totalLengthFt}'${kbtu ? ` ${kbtu}kBTU` : ''}${partCounts.turns90 > 0 ? ` ${partCounts.turns90}x90°` : ''}${partCounts.turns180 > 0 ? ` ${partCounts.turns180}x180°` : ''}`;

  // Keep label synced with default until user manually edits it
  useEffect(() => {
    if (!labelEdited) {
      setLabel(defaultLabel);
    }
  }, [defaultLabel, labelEdited]);

  // Generate a unique key for the entire SVG so React fully re-renders on any recipe/flip change
  const svgKey = recipe.map((r, i) => `${r.partId}${r.flipped ? 'f' : ''}`).join('-') + `-r${revision}`;

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
          height: 600,
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
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Preview Pane */}
          <div
            style={{
              flex: 1,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              borderRight: '1px solid rgba(255,255,255,0.08)',
              minHeight: 0,
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
                  key={svgKey}
                  viewBox={`${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`}
                  style={{ width: '100%', height: '100%', padding: 16 }}
                  preserveAspectRatio="xMidYMid meet"
                >
                  {(() => {
                    let tubeCount = 0;
                    return placements.map(({ part, worldX, worldY, rotation, scale, flipped }, idx) => {
                      const isFirstTube = part.type === 'tube' && tubeCount === 0;
                      if (part.type === 'tube') tubeCount++;
                      const inner = invertForPreview(stripAndNamespace(part.svgContent, idx, part.type, isFirstTube));
                      const vb = part.dimensions.viewBox;
                      const outerTransform = `translate(${worldX}, ${worldY}) rotate(${rotation}) scale(${scale})`;
                      const flipTransform = flipped ? `translate(0,${vb.y * 2 + vb.height}) scale(1,-1)` : '';
                      return (
                        <g key={`${idx}-${flipped ? 'f' : 'n'}-${revision}`} transform={outerTransform}>
                          <g transform={flipTransform} dangerouslySetInnerHTML={{ __html: inner }} />
                        </g>
                      );
                    });
                  })()}
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

            {/* Warnings */}
            {warnings.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {warnings.map((w, i) => (
                  <div
                    key={`${w.type}-${i}`}
                    style={{
                      fontSize: 10,
                      padding: '6px 10px',
                      borderRadius: 4,
                      background: w.type === 'overlap' ? 'rgba(255,60,60,0.15)' : 'rgba(255,180,0,0.15)',
                      border: `1px solid ${w.type === 'overlap' ? 'rgba(255,60,60,0.3)' : 'rgba(255,180,0,0.3)'}`,
                      color: w.type === 'overlap' ? '#ff6b6b' : '#ffbb33',
                    }}
                  >
                    {w.message}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Parts Palette */}
          <div style={{ width: 280, padding: 20, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
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

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexShrink: 0 }}>
              <button
                onClick={removeLast}
                disabled={recipe.length <= 1}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: recipe.length > 1 ? 'rgba(255,100,100,0.1)' : 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,100,100,0.2)',
                  borderRadius: 4,
                  color: recipe.length > 1 ? 'rgba(255,100,100,0.8)' : 'rgba(255,255,255,0.2)',
                  cursor: recipe.length > 1 ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                  fontSize: 11,
                }}
              >
                Undo
              </button>
              <button
                onClick={resetRecipe}
                disabled={recipe.length <= 1}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: recipe.length > 1 ? 'rgba(255,180,0,0.1)' : 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,180,0,0.2)',
                  borderRadius: 4,
                  color: recipe.length > 1 ? 'rgba(255,180,0,0.8)' : 'rgba(255,255,255,0.2)',
                  cursor: recipe.length > 1 ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                  fontSize: 11,
                }}
              >
                Reset
              </button>
            </div>

            {/* Recipe list */}
            <div
              style={{
                fontSize: 8,
                letterSpacing: 2,
                color: 'rgba(255,255,255,0.35)',
                marginBottom: 6,
                flexShrink: 0,
              }}
            >
              CURRENT PARTS
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {recipe.map((r, i) => {
                const part = getBuilderPart(r.partId);
                const isTurn = part?.type === 'turn90' || part?.type === 'turn180';
                const isBurner = i === 0;
                return (
                  <div
                    key={i}
                    style={{
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.5)',
                      padding: '3px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {i + 1}. {part?.label || r.partId}{r.flipped ? ' (flipped)' : ''}
                    </span>
                    <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                      {isTurn && (
                        <button
                          onClick={() => toggleFlip(i)}
                          style={{
                            background: r.flipped ? 'rgba(243,112,33,0.2)' : 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: 3,
                            color: r.flipped ? '#f37021' : 'rgba(255,255,255,0.4)',
                            cursor: 'pointer',
                            fontSize: 9,
                            padding: '1px 6px',
                            fontFamily: 'inherit',
                          }}
                          title="Flip turn direction"
                        >
                          Flip
                        </button>
                      )}
                      {!isBurner && (
                        <button
                          onClick={() => removePart(i)}
                          style={{
                            background: 'rgba(255,60,60,0.08)',
                            border: '1px solid rgba(255,60,60,0.2)',
                            borderRadius: 3,
                            color: 'rgba(255,100,100,0.6)',
                            cursor: 'pointer',
                            fontSize: 9,
                            padding: '1px 5px',
                            fontFamily: 'inherit',
                            lineHeight: 1,
                          }}
                          title="Remove this part"
                        >
                          ×
                        </button>
                      )}
                    </div>
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
            onChange={(e) => { setLabel(e.target.value); setLabelEdited(true); }}
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
