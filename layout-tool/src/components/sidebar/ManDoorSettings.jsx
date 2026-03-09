import useLayoutStore from '../../store/useLayoutStore';

export default function ManDoorSettings() {
  const doorHingeSide = useLayoutStore((s) => s.doorHingeSide);
  const doorSwingIn = useLayoutStore((s) => s.doorSwingIn);
  const toggleDoorHingeSide = useLayoutStore((s) => s.toggleDoorHingeSide);
  const toggleDoorSwingIn = useLayoutStore((s) => s.toggleDoorSwingIn);

  return (
    <div
      style={{
        padding: '10px 18px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div style={{ fontSize: 8, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
        DOOR SETTINGS
      </div>

      {/* Hinge Side */}
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
        Hinge Side
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        <button
          onClick={() => doorHingeSide !== 'left' && toggleDoorHingeSide()}
          style={{
            flex: 1,
            padding: '6px 0',
            background: doorHingeSide === 'left' ? '#FF6B35' : 'rgba(255,255,255,0.05)',
            border: 'none',
            borderRadius: 3,
            color: doorHingeSide === 'left' ? 'white' : 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 9,
          }}
        >
          Left
        </button>
        <button
          onClick={() => doorHingeSide !== 'right' && toggleDoorHingeSide()}
          style={{
            flex: 1,
            padding: '6px 0',
            background: doorHingeSide === 'right' ? '#FF6B35' : 'rgba(255,255,255,0.05)',
            border: 'none',
            borderRadius: 3,
            color: doorHingeSide === 'right' ? 'white' : 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 9,
          }}
        >
          Right
        </button>
      </div>

      {/* Swing Direction */}
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
        Swing Direction
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => !doorSwingIn && toggleDoorSwingIn()}
          style={{
            flex: 1,
            padding: '6px 0',
            background: doorSwingIn ? '#FF6B35' : 'rgba(255,255,255,0.05)',
            border: 'none',
            borderRadius: 3,
            color: doorSwingIn ? 'white' : 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 9,
          }}
        >
          Inward
        </button>
        <button
          onClick={() => doorSwingIn && toggleDoorSwingIn()}
          style={{
            flex: 1,
            padding: '6px 0',
            background: !doorSwingIn ? '#FF6B35' : 'rgba(255,255,255,0.05)',
            border: 'none',
            borderRadius: 3,
            color: !doorSwingIn ? 'white' : 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 9,
          }}
        >
          Outward
        </button>
      </div>

      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 10 }}>
        Click on a wall to place a 3' man door
      </div>
    </div>
  );
}
