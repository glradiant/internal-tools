import { useState, useRef, useEffect, useCallback } from 'react';
import { GRID } from '../../utils/constants';

export default function WallInputOverlay({ anchorPoint, cursorPoint, screenPos, onConfirm, onLocksChange }) {
  const [lengthInput, setLengthInput] = useState('');
  const [angleInput, setAngleInput] = useState('');
  const [editingLength, setEditingLength] = useState(false);
  const [editingAngle, setEditingAngle] = useState(false);
  const [lockedLength, setLockedLength] = useState(null);
  const [lockedAngle, setLockedAngle] = useState(null);
  const lengthRef = useRef(null);
  const angleRef = useRef(null);

  // Compute live values
  const dx = cursorPoint.x - anchorPoint.x;
  const dy = cursorPoint.y - anchorPoint.y;
  const liveDistFt = Math.round(Math.hypot(dx, dy) / GRID);
  const liveAngleDeg = Math.round(((Math.atan2(-dy, dx) * 180) / Math.PI + 360) % 360);

  // Reset and auto-focus when anchor changes (new point placed)
  const prevAnchorRef = useRef(null);
  useEffect(() => {
    const isNewAnchor = !prevAnchorRef.current
      || prevAnchorRef.current.x !== anchorPoint.x
      || prevAnchorRef.current.y !== anchorPoint.y;

    if (isNewAnchor) {
      setLengthInput('');
      setAngleInput('');
      setEditingLength(false);
      setEditingAngle(false);
      setLockedLength(null);
      setLockedAngle(null);
      onLocksChange({ length: null, angle: null });
      prevAnchorRef.current = anchorPoint;
      requestAnimationFrame(() => {
        lengthRef.current?.focus();
      });
    }
  }, [anchorPoint, onLocksChange]);

  // Focus on initial mount
  useEffect(() => {
    requestAnimationFrame(() => {
      lengthRef.current?.focus();
    });
  }, []);

  const updateLocks = useCallback((newLength, newAngle) => {
    setLockedLength(newLength);
    setLockedAngle(newAngle);
    onLocksChange({ length: newLength, angle: newAngle });
  }, [onLocksChange]);

  const handleLengthChange = (e) => {
    const val = e.target.value;
    setEditingLength(true);
    setLengthInput(val);
    const num = parseFloat(val);
    if (val === '' || isNaN(num)) {
      updateLocks(null, lockedAngle);
    } else {
      updateLocks(num, lockedAngle);
    }
  };

  const handleAngleChange = (e) => {
    const val = e.target.value;
    setEditingAngle(true);
    setAngleInput(val);
    const num = parseFloat(val);
    if (val === '' || isNaN(num)) {
      updateLocks(lockedLength, null);
    } else {
      updateLocks(lockedLength, num);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      // Compute the constrained point from current locks, not raw cursorPoint
      const len = lockedLength !== null ? lockedLength : liveDistFt;
      const ang = lockedAngle !== null ? lockedAngle : liveAngleDeg;
      const radians = (ang * Math.PI) / 180;
      const dist = len * GRID;
      const constrainedPoint = {
        x: Math.round(anchorPoint.x + dist * Math.cos(radians)),
        y: Math.round(anchorPoint.y - dist * Math.sin(radians)),
      };
      onConfirm(constrainedPoint);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      if (document.activeElement === lengthRef.current) {
        angleRef.current?.focus();
      } else {
        lengthRef.current?.focus();
      }
      return;
    }
    if (e.key === 'Escape') {
      // Don't stop propagation - let canvas handle Escape to exit draw mode
      setLengthInput('');
      setAngleInput('');
      setEditingLength(false);
      setEditingAngle(false);
      updateLocks(null, null);
      document.activeElement?.blur();
      return;
    }
    // Stop key events from propagating while typing in inputs
    e.stopPropagation();
  };

  // Display values: show user input if editing, otherwise live value
  const displayLength = editingLength ? lengthInput : liveDistFt;
  const displayAngle = editingAngle ? angleInput : liveAngleDeg;

  return (
    // Outer wrapper is pointer-events:none so mouse passes through to SVG
    <div
      style={{
        position: 'absolute',
        left: screenPos.x + 32,
        top: screenPos.y - 60,
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      {/* Inner box - pointer-events:none except for inputs */}
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
            <label style={{ fontSize: 9, color: '#666', width: 52 }}>Length</label>
            <input
              ref={lengthRef}
              type="text"
              value={displayLength}
              onChange={handleLengthChange}
              onFocus={(e) => {
                // Don't set editingLength here - only set it when user types
                // This allows live values to continue updating while focused
                requestAnimationFrame(() => e.target.select());
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 50,
                padding: '2px 4px',
                border: `1px solid ${lockedLength !== null ? '#f37021' : '#ddd'}`,
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
            <label style={{ fontSize: 9, color: '#666', width: 52 }}>Angle</label>
            <input
              ref={angleRef}
              type="text"
              value={displayAngle}
              onChange={handleAngleChange}
              onFocus={(e) => {
                // Don't set editingAngle here - only set it when user types
                // This allows live values to continue updating while focused
                requestAnimationFrame(() => e.target.select());
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 50,
                padding: '2px 4px',
                border: `1px solid ${lockedAngle !== null ? '#f37021' : '#ddd'}`,
                borderRadius: 3,
                fontFamily: 'inherit',
                fontSize: 11,
                textAlign: 'right',
                outline: 'none',
                pointerEvents: 'auto',
              }}
            />
            <span style={{ fontSize: 9, color: '#999' }}>deg</span>
          </div>
        </div>
        <div style={{ fontSize: 8, color: '#aaa', marginTop: 4, lineHeight: 1.4 }}>
          Tab to switch &middot; Enter to place
        </div>
      </div>
    </div>
  );
}
