import { useState, useEffect } from 'react';
import useLayoutStore from '../../store/useLayoutStore';
import { GRID } from '../../utils/constants';

export default function PositionPanel() {
  const selectedIds = useLayoutStore((s) => s.selectedIds);
  const heaters = useLayoutStore((s) => s.heaters);
  const updateHeaterPosition = useLayoutStore((s) => s.updateHeaterPosition);
  const updateHeater = useLayoutStore((s) => s.updateHeater);
  const wallOffsetMode = useLayoutStore((s) => s.wallOffsetMode);
  const setWallOffsetMode = useLayoutStore((s) => s.setWallOffsetMode);
  const clearWallOffsetMode = useLayoutStore((s) => s.clearWallOffsetMode);

  // Get selected heater (only show for single selection)
  const selectedHeater = selectedIds.length === 1
    ? heaters.find((h) => h.id === selectedIds[0])
    : null;

  const [xFt, setXFt] = useState('');
  const [yFt, setYFt] = useState('');
  const [offsetFt, setOffsetFt] = useState('10');

  // Update inputs when selection changes
  useEffect(() => {
    if (selectedHeater) {
      setXFt(String(Math.round(selectedHeater.x / GRID * 10) / 10));
      setYFt(String(Math.round(selectedHeater.y / GRID * 10) / 10));
    }
  }, [selectedHeater?.id, selectedHeater?.x, selectedHeater?.y]);

  // Clear offset mode when selection changes
  useEffect(() => {
    if (wallOffsetMode && (!selectedHeater || wallOffsetMode.heaterId !== selectedHeater.id)) {
      clearWallOffsetMode();
    }
  }, [selectedHeater?.id, wallOffsetMode, clearWallOffsetMode]);

  if (!selectedHeater) {
    return null;
  }

  const handlePositionChange = () => {
    const newX = parseFloat(xFt) * GRID;
    const newY = parseFloat(yFt) * GRID;
    if (!isNaN(newX) && !isNaN(newY)) {
      updateHeaterPosition(selectedHeater.id, newX, newY);
    }
  };

  const startWallOffsetMode = () => {
    const offset = parseFloat(offsetFt);
    if (isNaN(offset) || offset < 0) return;

    setWallOffsetMode({
      heaterId: selectedHeater.id,
      offsetFt: offset,
    });
  };

  const isInOffsetMode = wallOffsetMode?.heaterId === selectedHeater.id;

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

  return (
    <div
      style={{
        padding: '10px 18px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div style={{ fontSize: 8, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
        POSITION
      </div>

      {/* Direct coordinate input */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={labelStyle}>X (ft)</div>
          <input
            type="number"
            value={xFt}
            onChange={(e) => setXFt(e.target.value)}
            onBlur={handlePositionChange}
            onKeyDown={(e) => e.key === 'Enter' && handlePositionChange()}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={labelStyle}>Y (ft)</div>
          <input
            type="number"
            value={yFt}
            onChange={(e) => setYFt(e.target.value)}
            onBlur={handlePositionChange}
            onKeyDown={(e) => e.key === 'Enter' && handlePositionChange()}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Wall offset section */}
      <div style={{ fontSize: 8, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
        OFFSET FROM WALL
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
        <input
          type="number"
          value={offsetFt}
          onChange={(e) => setOffsetFt(e.target.value)}
          style={{ ...inputStyle, width: 60 }}
          min="0"
          step="0.5"
        />
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>ft</span>
        <button
          onClick={isInOffsetMode ? clearWallOffsetMode : startWallOffsetMode}
          style={{
            flex: 1,
            padding: '6px 8px',
            background: isInOffsetMode ? '#f37021' : 'rgba(255,255,255,0.05)',
            border: isInOffsetMode ? '1px solid #f37021' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: 3,
            color: isInOffsetMode ? 'white' : 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 9,
          }}
        >
          {isInOffsetMode ? 'CANCEL' : 'CLICK WALL'}
        </button>
      </div>

      {isInOffsetMode && (
        <div style={{
          fontSize: 9,
          color: '#f37021',
          padding: '8px',
          background: 'rgba(243,112,33,0.1)',
          borderRadius: 4,
          marginBottom: 8,
        }}>
          Click on a wall to position the heater {offsetFt}ft away from it
        </div>
      )}

      {/* Rotation */}
      <div style={{ fontSize: 8, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', margin: '12px 0 6px' }}>
        ROTATION
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => updateHeater(selectedHeater.id, { angleDeg: (selectedHeater.angleDeg - 90 + 360) % 360 })}
          style={{
            padding: '6px 12px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 3,
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 11,
          }}
          title="Rotate 90° left"
        >
          ↺
        </button>
        <input
          type="number"
          min={0}
          max={360}
          value={selectedHeater.angleDeg}
          onChange={(e) => updateHeater(selectedHeater.id, { angleDeg: ((Number(e.target.value) % 360) + 360) % 360 })}
          style={{ ...inputStyle, flex: 1, textAlign: 'center' }}
        />
        <button
          onClick={() => updateHeater(selectedHeater.id, { angleDeg: (selectedHeater.angleDeg + 90) % 360 })}
          style={{
            padding: '6px 12px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 3,
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 11,
          }}
          title="Rotate 90° right"
        >
          ↻
        </button>
      </div>

      {/* Flip Controls */}
      <div style={{ fontSize: 8, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', margin: '10px 0 6px' }}>
        FLIP
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => updateHeater(selectedHeater.id, { flipH: !selectedHeater.flipH })}
          style={{
            flex: 1,
            padding: '6px 0',
            background: selectedHeater.flipH ? '#f37021' : 'rgba(255,255,255,0.05)',
            border: 'none',
            borderRadius: 3,
            color: selectedHeater.flipH ? 'white' : 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 9,
          }}
        >
          {'\u2194'} Horizontal
        </button>
        <button
          onClick={() => updateHeater(selectedHeater.id, { flipV: !selectedHeater.flipV })}
          style={{
            flex: 1,
            padding: '6px 0',
            background: selectedHeater.flipV ? '#f37021' : 'rgba(255,255,255,0.05)',
            border: 'none',
            borderRadius: 3,
            color: selectedHeater.flipV ? 'white' : 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 9,
          }}
        >
          {'\u2195'} Vertical
        </button>
      </div>

      {/* Heat Throw Angle */}
      <div style={{ fontSize: 8, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', margin: '10px 0 6px' }}>
        HEAT THROW
      </div>
      {(() => {
        const heatThrowAngle = selectedHeater.heatThrowAngle || 0;
        const steps = [-45, -30, -15, 0, 15, 30, 45];
        const currentIndex = steps.indexOf(heatThrowAngle);
        const atMin = currentIndex === 0;
        const atMax = currentIndex === steps.length - 1;

        const goLeft = () => {
          if (!atMin) {
            updateHeater(selectedHeater.id, { heatThrowAngle: steps[currentIndex - 1] });
          }
        };

        const goRight = () => {
          if (!atMax) {
            updateHeater(selectedHeater.id, { heatThrowAngle: steps[currentIndex + 1] });
          }
        };

        const getLabel = () => {
          if (heatThrowAngle === 0) return 'Flat';
          const direction = heatThrowAngle < 0 ? 'Left' : 'Right';
          return `${direction} ${Math.abs(heatThrowAngle)}°`;
        };

        return (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={goLeft}
              disabled={atMin}
              style={{
                padding: '6px 10px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 3,
                color: atMin ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)',
                cursor: atMin ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                fontSize: 11,
              }}
              title="Decrease angle"
            >
              ◀
            </button>
            <div
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 10,
                color: heatThrowAngle !== 0 ? '#f37021' : 'rgba(255,255,255,0.5)',
                fontWeight: heatThrowAngle !== 0 ? 500 : 400,
              }}
            >
              {getLabel()}
            </div>
            <button
              onClick={goRight}
              disabled={atMax}
              style={{
                padding: '6px 10px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 3,
                color: atMax ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)',
                cursor: atMax ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                fontSize: 11,
              }}
              title="Increase angle"
            >
              ▶
            </button>
          </div>
        );
      })()}

      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 10 }}>
        {selectedHeater.model?.label}
      </div>
    </div>
  );
}
