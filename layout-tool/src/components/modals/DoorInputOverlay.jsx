import { useState, useRef, useEffect } from 'react';

export default function DoorInputOverlay({ liveWidthFt, screenPos, onConfirm, onWidthLock, onHeightChange }) {
  const [widthValue, setWidthValue] = useState('');
  const [heightValue, setHeightValue] = useState('');
  const [editingWidth, setEditingWidth] = useState(false);
  const widthRef = useRef(null);
  const heightRef = useRef(null);

  // Auto-focus on mount
  useEffect(() => {
    requestAnimationFrame(() => {
      widthRef.current?.focus();
    });
  }, []);

  const handleWidthChange = (e) => {
    const val = e.target.value;
    setEditingWidth(true);
    setWidthValue(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      onWidthLock(num);
    } else {
      onWidthLock(null);
    }
  };

  const handleHeightChange = (e) => {
    const val = e.target.value;
    setHeightValue(val);
    const num = parseFloat(val);
    if (onHeightChange) {
      onHeightChange(!isNaN(num) && num > 0 ? num : null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const width = editingWidth && widthValue !== '' ? parseFloat(widthValue) : liveWidthFt;
      const height = heightValue !== '' ? parseFloat(heightValue) : null;
      if (!isNaN(width) && width >= 2) {
        onConfirm(width, height && !isNaN(height) && height > 0 ? height : null);
      }
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      if (document.activeElement === widthRef.current) {
        heightRef.current?.focus();
      } else {
        widthRef.current?.focus();
      }
      return;
    }
    if (e.key === 'Escape') {
      // Don't stop propagation - let canvas handle Escape to exit door mode
      setWidthValue('');
      setHeightValue('');
      setEditingWidth(false);
      onWidthLock(null);
      document.activeElement?.blur();
      return;
    }
    e.stopPropagation();
  };

  const displayWidth = editingWidth ? widthValue : liveWidthFt;
  const lockedWidth = editingWidth && widthValue !== '' && !isNaN(parseFloat(widthValue));

  const inputStyle = (highlighted) => ({
    width: 40,
    padding: '2px 4px',
    border: `1px solid ${highlighted ? '#f37021' : '#ddd'}`,
    borderRadius: 3,
    fontFamily: 'inherit',
    fontSize: 11,
    textAlign: 'right',
    outline: 'none',
    pointerEvents: 'auto',
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: screenPos.x + 32,
        top: screenPos.y - 50,
        background: 'white',
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        borderRadius: 6,
        padding: '8px 10px',
        fontFamily: "'DM Mono', monospace",
        fontSize: 11,
        minWidth: 130,
        zIndex: 100,
        pointerEvents: 'none',
      }}
      onKeyDown={handleKeyDown}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 9, color: '#666', width: 42 }}>Width</label>
          <input
            ref={widthRef}
            type="text"
            value={displayWidth}
            onChange={handleWidthChange}
            onFocus={(e) => {
              setEditingWidth(true);
              setWidthValue(String(liveWidthFt));
              requestAnimationFrame(() => e.target.select());
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={inputStyle(lockedWidth)}
          />
          <span style={{ fontSize: 9, color: '#999' }}>ft</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 9, color: '#666', width: 42 }}>Height</label>
          <input
            ref={heightRef}
            type="text"
            value={heightValue}
            onChange={handleHeightChange}
            onFocus={(e) => e.target.select()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            placeholder="—"
            style={inputStyle(heightValue !== '' && !isNaN(parseFloat(heightValue)))}
          />
          <span style={{ fontSize: 9, color: '#999' }}>ft</span>
        </div>
      </div>
      <div style={{ fontSize: 8, color: '#aaa', marginTop: 4, lineHeight: 1.4 }}>
        Tab to switch &middot; Enter to place
      </div>
    </div>
  );
}
