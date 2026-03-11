import { useState, useRef, useEffect, useCallback } from 'react';
import { GRID } from '../../utils/constants';

export default function RectangleInputOverlay({ startPoint, cursorPoint, screenPos, onConfirm, onDimensionsChange }) {
  const [widthInput, setWidthInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [editingWidth, setEditingWidth] = useState(false);
  const [editingHeight, setEditingHeight] = useState(false);
  const [lockedWidth, setLockedWidth] = useState(null);
  const [lockedHeight, setLockedHeight] = useState(null);
  const widthRef = useRef(null);
  const heightRef = useRef(null);

  // Compute live values from cursor position
  const liveWidthFt = Math.abs(Math.round((cursorPoint.x - startPoint.x) / GRID));
  const liveHeightFt = Math.abs(Math.round((cursorPoint.y - startPoint.y) / GRID));

  // Reset when start point changes
  const prevStartRef = useRef(null);
  useEffect(() => {
    const isNewStart = !prevStartRef.current
      || prevStartRef.current.x !== startPoint.x
      || prevStartRef.current.y !== startPoint.y;

    if (isNewStart) {
      setWidthInput('');
      setHeightInput('');
      setEditingWidth(false);
      setEditingHeight(false);
      setLockedWidth(null);
      setLockedHeight(null);
      onDimensionsChange({ width: null, height: null });
      prevStartRef.current = startPoint;
      requestAnimationFrame(() => {
        widthRef.current?.focus();
      });
    }
  }, [startPoint, onDimensionsChange]);

  // Focus on initial mount
  useEffect(() => {
    requestAnimationFrame(() => {
      widthRef.current?.focus();
    });
  }, []);

  const updateLocks = useCallback((newWidth, newHeight) => {
    setLockedWidth(newWidth);
    setLockedHeight(newHeight);
    onDimensionsChange({ width: newWidth, height: newHeight });
  }, [onDimensionsChange]);

  const handleWidthChange = (e) => {
    const val = e.target.value;
    setEditingWidth(true);
    setWidthInput(val);
    const num = parseFloat(val);
    if (val === '' || isNaN(num)) {
      updateLocks(null, lockedHeight);
    } else {
      updateLocks(num, lockedHeight);
    }
  };

  const handleHeightChange = (e) => {
    const val = e.target.value;
    setEditingHeight(true);
    setHeightInput(val);
    const num = parseFloat(val);
    if (val === '' || isNaN(num)) {
      updateLocks(lockedWidth, null);
    } else {
      updateLocks(lockedWidth, num);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      // Use locked values or live values
      const w = lockedWidth !== null ? lockedWidth : liveWidthFt;
      const h = lockedHeight !== null ? lockedHeight : liveHeightFt;
      if (w > 0 && h > 0) {
        // Determine direction from cursor relative to start
        const dirX = cursorPoint.x >= startPoint.x ? 1 : -1;
        const dirY = cursorPoint.y >= startPoint.y ? 1 : -1;
        const endPoint = {
          x: startPoint.x + w * GRID * dirX,
          y: startPoint.y + h * GRID * dirY,
        };
        onConfirm(endPoint);
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
      setWidthInput('');
      setHeightInput('');
      setEditingWidth(false);
      setEditingHeight(false);
      updateLocks(null, null);
      document.activeElement?.blur();
      return;
    }
    e.stopPropagation();
  };

  const displayWidth = editingWidth ? widthInput : liveWidthFt;
  const displayHeight = editingHeight ? heightInput : liveHeightFt;

  return (
    <div
      style={{
        position: 'absolute',
        left: screenPos.x + 32,
        top: screenPos.y - 60,
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: 'white',
          boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
          borderRadius: 6,
          padding: '8px 10px',
          fontFamily: "'DM Mono', monospace",
          fontSize: 11,
          minWidth: 130,
          pointerEvents: 'none',
        }}
        onKeyDown={handleKeyDown}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 9, color: '#666', width: 52 }}>Width</label>
            <input
              ref={widthRef}
              type="text"
              value={displayWidth}
              onChange={handleWidthChange}
              onFocus={(e) => {
                requestAnimationFrame(() => e.target.select());
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 50,
                padding: '2px 4px',
                border: `1px solid ${lockedWidth !== null ? '#f37021' : '#ddd'}`,
                borderRadius: 3,
                fontFamily: 'inherit',
                fontSize: 11,
                textAlign: 'right',
                outline: 'none',
                pointerEvents: 'auto',
              }}
            />
            <span style={{ fontSize: 9, color: '#999' }}>ft</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 9, color: '#666', width: 52 }}>Height</label>
            <input
              ref={heightRef}
              type="text"
              value={displayHeight}
              onChange={handleHeightChange}
              onFocus={(e) => {
                requestAnimationFrame(() => e.target.select());
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 50,
                padding: '2px 4px',
                border: `1px solid ${lockedHeight !== null ? '#f37021' : '#ddd'}`,
                borderRadius: 3,
                fontFamily: 'inherit',
                fontSize: 11,
                textAlign: 'right',
                outline: 'none',
                pointerEvents: 'auto',
              }}
            />
            <span style={{ fontSize: 9, color: '#999' }}>ft</span>
          </div>
        </div>
        <div style={{ fontSize: 8, color: '#aaa', marginTop: 4, lineHeight: 1.4 }}>
          Tab to switch &middot; Enter to place
        </div>
      </div>
    </div>
  );
}
