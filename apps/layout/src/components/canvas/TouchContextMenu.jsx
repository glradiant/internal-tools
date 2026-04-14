import { useEffect, useRef } from 'react';

export default function TouchContextMenu({ x, y, items, onClose }) {
  const menuRef = useRef(null);

  // Close on tap outside
  useEffect(() => {
    const handlePointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    // Use setTimeout to avoid the same pointerdown that triggered the menu from closing it
    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', handlePointerDown);
    }, 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const menuStyle = {
    position: 'absolute',
    left: x,
    top: y,
    zIndex: 100,
    background: '#1B3557',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 6,
    padding: '4px 0',
    minWidth: 160,
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  };

  return (
    <div ref={menuRef} style={menuStyle}>
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
        ) : (
          <button
            key={i}
            onClick={() => {
              item.action();
              onClose();
            }}
            disabled={item.disabled}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              color: item.disabled ? 'rgba(255,255,255,0.25)' : item.destructive ? '#ef4444' : 'rgba(255,255,255,0.8)',
              fontSize: 13,
              textAlign: 'left',
              cursor: item.disabled ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {item.icon && <span style={{ marginRight: 8 }}>{item.icon}</span>}
            {item.label}
          </button>
        )
      )}
    </div>
  );
}
