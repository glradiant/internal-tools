import { useState, useEffect, useMemo } from 'react';
import useLayoutStore from '../../store/useLayoutStore';
import { GRID } from '../../utils/constants';

export default function LabelSettingsPanel() {
  const selectedIds = useLayoutStore((s) => s.selectedIds);
  const heaters = useLayoutStore((s) => s.heaters);
  const doors = useLayoutStore((s) => s.doors);
  const dimensions = useLayoutStore((s) => s.dimensions);
  const updateEntityLabel = useLayoutStore((s) => s.updateEntityLabel);
  const resetEntityLabel = useLayoutStore((s) => s.resetEntityLabel);

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

    return null;
  }, [selectedIds, heaters, doors, dimensions]);

  // Local state for inputs
  const [customText, setCustomText] = useState('');
  const [rotationInput, setRotationInput] = useState('');

  // Sync local state with entity
  useEffect(() => {
    if (selectedEntity) {
      setCustomText(selectedEntity.entity.labelText || '');
      setRotationInput(
        selectedEntity.entity.labelRotation !== null && selectedEntity.entity.labelRotation !== undefined
          ? String(selectedEntity.entity.labelRotation)
          : ''
      );
    }
  }, [selectedEntity?.entity?.id, selectedEntity?.entity?.labelText, selectedEntity?.entity?.labelRotation]);

  if (!selectedEntity) {
    return null;
  }

  const { type, entity, defaultLabel } = selectedEntity;

  const handleTextChange = (e) => {
    setCustomText(e.target.value);
  };

  const handleTextBlur = () => {
    const newText = customText.trim() === '' ? null : customText;
    updateEntityLabel(type, entity.id, { labelText: newText });
  };

  const handleTextKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  const handleVisibilityToggle = () => {
    updateEntityLabel(type, entity.id, { labelVisible: !entity.labelVisible });
  };

  const handleSizeChange = (delta) => {
    const newOffset = Math.max(-5, Math.min(5, (entity.labelSizeOffset || 0) + delta));
    updateEntityLabel(type, entity.id, { labelSizeOffset: newOffset });
  };

  const handleRotationChange = (e) => {
    setRotationInput(e.target.value);
  };

  const handleRotationBlur = () => {
    if (rotationInput.trim() === '') {
      updateEntityLabel(type, entity.id, { labelRotation: null });
    } else {
      const val = parseFloat(rotationInput);
      if (!isNaN(val)) {
        updateEntityLabel(type, entity.id, { labelRotation: val });
      }
    }
  };

  const handleRotationKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  const handleAutoRotation = () => {
    setRotationInput('');
    updateEntityLabel(type, entity.id, { labelRotation: null });
  };

  const handleReset = () => {
    resetEntityLabel(type, entity.id);
    setCustomText('');
    setRotationInput('');
  };

  // Check if any property is modified from default
  const isModified =
    entity.labelText !== null ||
    (entity.labelSizeOffset || 0) !== 0 ||
    entity.labelRotation !== null ||
    entity.labelVisible === false;

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

  const sizeOffset = entity.labelSizeOffset || 0;

  return (
    <div
      style={{
        padding: '10px 18px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div style={{ fontSize: 8, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
        LABEL SETTINGS
      </div>

      {/* Visibility Toggle */}
      <div style={{ marginBottom: 12 }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            fontSize: 10,
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          <input
            type="checkbox"
            checked={entity.labelVisible !== false}
            onChange={handleVisibilityToggle}
            style={{ cursor: 'pointer' }}
          />
          Show label
        </label>
      </div>

      {/* Custom Text */}
      <div style={{ marginBottom: 12 }}>
        <div style={labelStyle}>Custom text</div>
        <input
          type="text"
          value={customText}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          onKeyDown={handleTextKeyDown}
          placeholder={defaultLabel}
          style={inputStyle}
        />
      </div>

      {/* Size Controls */}
      <div style={{ marginBottom: 12 }}>
        <div style={labelStyle}>Size</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={() => handleSizeChange(-1)}
            disabled={sizeOffset <= -5}
            style={{
              ...buttonStyle,
              opacity: sizeOffset <= -5 ? 0.3 : 1,
              cursor: sizeOffset <= -5 ? 'not-allowed' : 'pointer',
            }}
          >
            -
          </button>
          <div
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 10,
              color: sizeOffset === 0 ? 'rgba(255,255,255,0.5)' : 'white',
            }}
          >
            {sizeOffset === 0 ? 'Normal' : `${sizeOffset > 0 ? '+' : ''}${sizeOffset * 10}%`}
          </div>
          <button
            onClick={() => handleSizeChange(1)}
            disabled={sizeOffset >= 5}
            style={{
              ...buttonStyle,
              opacity: sizeOffset >= 5 ? 0.3 : 1,
              cursor: sizeOffset >= 5 ? 'not-allowed' : 'pointer',
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* Rotation */}
      <div style={{ marginBottom: 12 }}>
        <div style={labelStyle}>Rotation (degrees)</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="number"
            value={rotationInput}
            onChange={handleRotationChange}
            onBlur={handleRotationBlur}
            onKeyDown={handleRotationKeyDown}
            placeholder="Auto"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={handleAutoRotation}
            style={{
              ...buttonStyle,
              background: entity.labelRotation === null ? 'rgba(243,112,33,0.2)' : 'rgba(255,255,255,0.05)',
              borderColor: entity.labelRotation === null ? '#f37021' : 'rgba(255,255,255,0.1)',
              color: entity.labelRotation === null ? '#f37021' : 'rgba(255,255,255,0.6)',
            }}
          >
            Auto
          </button>
        </div>
      </div>

      {/* Reset Button */}
      {isModified && (
        <button
          onClick={handleReset}
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
            marginTop: 4,
          }}
        >
          Reset All Label Settings
        </button>
      )}

      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 10 }}>
        {type === 'heater' && entity.model?.label}
        {type === 'door' && (entity.doorType === 'man' ? 'Man Door' : 'Overhead Door')}
        {type === 'dimension' && 'Manual Dimension'}
      </div>
    </div>
  );
}
