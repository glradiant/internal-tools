import { useState, useEffect, useMemo } from 'react';
import useLayoutStore from '../../store/useLayoutStore';
import { GRID } from '../../utils/constants';

// Shared styles
const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: 'white',
  padding: '4px 8px',
  fontSize: 10,
  borderRadius: 3,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  outline: 'none',
};

const labelStyle = {
  fontSize: 8,
  color: 'rgba(255,255,255,0.4)',
  marginBottom: 2,
};

const buttonStyle = {
  padding: '6px 12px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 3,
  color: 'rgba(255,255,255,0.6)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 11,
};

// Single label editor component (for heaters, doors, dimensions, wall segments)
function LabelEditor({
  labelText,
  labelSizeOffset,
  labelRotation,
  labelVisible,
  defaultLabel,
  onUpdate,
  onReset,
  showReset = true,
}) {
  const [customText, setCustomText] = useState(labelText || '');
  const [rotationInput, setRotationInput] = useState(
    labelRotation !== null && labelRotation !== undefined ? String(labelRotation) : ''
  );

  // Sync local state when props change
  useEffect(() => {
    setCustomText(labelText || '');
    setRotationInput(
      labelRotation !== null && labelRotation !== undefined ? String(labelRotation) : ''
    );
  }, [labelText, labelRotation]);

  const handleTextBlur = () => {
    const newText = customText.trim() === '' ? null : customText;
    onUpdate({ labelText: newText });
  };

  const handleRotationBlur = () => {
    if (rotationInput.trim() === '') {
      onUpdate({ labelRotation: null });
    } else {
      const val = parseFloat(rotationInput);
      if (!isNaN(val)) {
        onUpdate({ labelRotation: val });
      }
    }
  };

  const sizeOffset = labelSizeOffset || 0;
  const isModified = labelText !== null || sizeOffset !== 0 || labelRotation !== null || labelVisible === false;

  return (
    <div>
      {/* Visibility Toggle */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
          <input
            type="checkbox"
            checked={labelVisible !== false}
            onChange={() => onUpdate({ labelVisible: !(labelVisible !== false) })}
            style={{ cursor: 'pointer' }}
          />
          Show label
        </label>
      </div>

      {/* Custom Text */}
      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>Custom text</div>
        <input
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          onBlur={handleTextBlur}
          onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
          placeholder={defaultLabel}
          style={inputStyle}
        />
      </div>

      {/* Size Controls */}
      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>Size</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={() => onUpdate({ labelSizeOffset: Math.max(-5, sizeOffset - 1) })}
            disabled={sizeOffset <= -5}
            style={{ ...buttonStyle, opacity: sizeOffset <= -5 ? 0.3 : 1, cursor: sizeOffset <= -5 ? 'not-allowed' : 'pointer' }}
          >
            -
          </button>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 10, color: sizeOffset === 0 ? 'rgba(255,255,255,0.5)' : 'white' }}>
            {sizeOffset === 0 ? 'Normal' : `${sizeOffset > 0 ? '+' : ''}${sizeOffset * 10}%`}
          </div>
          <button
            onClick={() => onUpdate({ labelSizeOffset: Math.min(5, sizeOffset + 1) })}
            disabled={sizeOffset >= 5}
            style={{ ...buttonStyle, opacity: sizeOffset >= 5 ? 0.3 : 1, cursor: sizeOffset >= 5 ? 'not-allowed' : 'pointer' }}
          >
            +
          </button>
        </div>
      </div>

      {/* Rotation */}
      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>Rotation (degrees)</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={() => {
              const current = labelRotation ?? 0;
              const newVal = ((current - 90) % 360 + 360) % 360;
              setRotationInput(String(newVal));
              onUpdate({ labelRotation: newVal });
            }}
            style={buttonStyle}
            title="Rotate 90° left"
          >
            ↺
          </button>
          <input
            type="number"
            value={rotationInput}
            onChange={(e) => setRotationInput(e.target.value)}
            onBlur={handleRotationBlur}
            onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
            placeholder="Auto"
            style={{ ...inputStyle, flex: 1, textAlign: 'center' }}
          />
          <button
            onClick={() => {
              const current = labelRotation ?? 0;
              const newVal = (current + 90) % 360;
              setRotationInput(String(newVal));
              onUpdate({ labelRotation: newVal });
            }}
            style={buttonStyle}
            title="Rotate 90° right"
          >
            ↻
          </button>
        </div>
        <div style={{ marginTop: 6 }}>
          <button
            onClick={() => {
              setRotationInput('');
              onUpdate({ labelRotation: null });
            }}
            style={{
              ...buttonStyle,
              width: '100%',
              background: labelRotation === null ? 'rgba(243,112,33,0.2)' : 'rgba(255,255,255,0.05)',
              borderColor: labelRotation === null ? '#f37021' : 'rgba(255,255,255,0.1)',
              color: labelRotation === null ? '#f37021' : 'rgba(255,255,255,0.6)',
            }}
          >
            Auto
          </button>
        </div>
      </div>

      {/* Reset Button */}
      {showReset && isModified && (
        <button
          onClick={onReset}
          style={{
            width: '100%',
            padding: '6px 12px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 3,
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 9,
          }}
        >
          Reset
        </button>
      )}
    </div>
  );
}

export default function LabelSettingsPanel() {
  const selectedIds = useLayoutStore((s) => s.selectedIds);
  const heaters = useLayoutStore((s) => s.heaters);
  const doors = useLayoutStore((s) => s.doors);
  const dimensions = useLayoutStore((s) => s.dimensions);
  const walls = useLayoutStore((s) => s.walls);
  const updateEntityLabel = useLayoutStore((s) => s.updateEntityLabel);
  const resetEntityLabel = useLayoutStore((s) => s.resetEntityLabel);
  const updateWallSegmentLabel = useLayoutStore((s) => s.updateWallSegmentLabel);
  const resetWallSegmentLabel = useLayoutStore((s) => s.resetWallSegmentLabel);

  // Track which wall segment is expanded
  const [expandedSegment, setExpandedSegment] = useState(null);

  // Determine what type of entity is selected
  const selectedEntity = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    const id = selectedIds[0];

    const heater = heaters.find((h) => h.id === id);
    if (heater) {
      return {
        type: 'heater',
        entity: heater,
        defaultLabel: heater.model?.label || 'Heater',
      };
    }

    const door = doors.find((d) => d.id === id);
    if (door) {
      const widthFt = Math.round(door.widthPx / GRID);
      let defaultLabel;
      if (door.doorType === 'man') {
        defaultLabel = `${widthFt}' MAN DOOR`;
      } else if (door.heightFt) {
        defaultLabel = `${door.heightFt}' x ${widthFt}' OVERHEAD DOOR`;
      } else {
        defaultLabel = `${widthFt}' OVERHEAD DOOR`;
      }
      return {
        type: 'door',
        entity: door,
        defaultLabel,
      };
    }

    const dim = dimensions.find((d) => d.id === id);
    if (dim) {
      const dist = Math.hypot(dim.x2 - dim.x1, dim.y2 - dim.y1);
      const distFt = Math.round(dist / GRID * 10) / 10;
      return {
        type: 'dimension',
        entity: dim,
        defaultLabel: `${distFt}'`,
      };
    }

    const wall = walls.find((w) => w.id === id);
    if (wall) {
      return {
        type: 'wall',
        entity: wall,
      };
    }

    return null;
  }, [selectedIds, heaters, doors, dimensions, walls]);

  // Reset expanded segment when selection changes
  useEffect(() => {
    setExpandedSegment(null);
  }, [selectedIds[0]]);

  if (!selectedEntity) {
    return null;
  }

  const { type, entity, defaultLabel } = selectedEntity;

  // Wall segments need special handling
  if (type === 'wall') {
    const pts = entity.points;
    const segments = pts.map((p, i) => {
      const q = pts[(i + 1) % pts.length];
      const len = Math.hypot(q.x - p.x, q.y - p.y);
      const ft = Math.round(len / GRID);
      return { index: i, ft, defaultLabel: `${ft}'` };
    });

    return (
      <div style={{ padding: '10px 18px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontSize: 8, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
          WALL DIMENSION LABELS
        </div>

        {segments.map((seg) => {
          const segLabel = entity.segmentLabels?.[seg.index] || {};
          const isExpanded = expandedSegment === seg.index;
          const isModified = segLabel.labelText != null || (segLabel.labelSizeOffset || 0) !== 0 ||
                            segLabel.labelRotation != null || segLabel.labelVisible === false;

          return (
            <div key={seg.index} style={{ marginBottom: 8 }}>
              <button
                onClick={() => setExpandedSegment(isExpanded ? null : seg.index)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: isExpanded ? 'rgba(243,112,33,0.15)' : 'rgba(255,255,255,0.03)',
                  border: isExpanded ? '1px solid rgba(243,112,33,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 4,
                  color: 'rgba(255,255,255,0.8)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 10,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>
                  Segment {seg.index + 1}: {segLabel.labelText || seg.defaultLabel}
                  {isModified && <span style={{ color: '#f37021', marginLeft: 6 }}>*</span>}
                </span>
                <span style={{ opacity: 0.5 }}>{isExpanded ? '▼' : '▶'}</span>
              </button>

              {isExpanded && (
                <div style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '0 0 4px 4px', marginTop: -1 }}>
                  <LabelEditor
                    labelText={segLabel.labelText}
                    labelSizeOffset={segLabel.labelSizeOffset}
                    labelRotation={segLabel.labelRotation}
                    labelVisible={segLabel.labelVisible}
                    defaultLabel={seg.defaultLabel}
                    onUpdate={(updates) => updateWallSegmentLabel(entity.id, seg.index, updates)}
                    onReset={() => resetWallSegmentLabel(entity.id, seg.index)}
                  />
                </div>
              )}
            </div>
          );
        })}

        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 10 }}>
          Wall with {segments.length} segments
        </div>
      </div>
    );
  }

  // Standard entity (heater, door, dimension)
  return (
    <div style={{ padding: '10px 18px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ fontSize: 8, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
        LABEL SETTINGS
      </div>

      <LabelEditor
        labelText={entity.labelText}
        labelSizeOffset={entity.labelSizeOffset}
        labelRotation={entity.labelRotation}
        labelVisible={entity.labelVisible}
        defaultLabel={defaultLabel}
        onUpdate={(updates) => updateEntityLabel(type, entity.id, updates)}
        onReset={() => resetEntityLabel(type, entity.id)}
      />

      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 10 }}>
        {type === 'heater' && entity.model?.label}
        {type === 'door' && (entity.doorType === 'man' ? 'Man Door' : 'Overhead Door')}
        {type === 'dimension' && 'Manual Dimension'}
      </div>
    </div>
  );
}
