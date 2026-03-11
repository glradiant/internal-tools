import useLayoutStore from '../../store/useLayoutStore';

export default function ManDoorSettings() {
  const toggleManDoorFlipH = useLayoutStore((s) => s.toggleManDoorFlipH);
  const toggleManDoorFlipV = useLayoutStore((s) => s.toggleManDoorFlipV);

  const buttonStyle = {
    flex: 1,
    padding: '6px 0',
    background: 'rgba(255,255,255,0.05)',
    border: 'none',
    borderRadius: 3,
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 9,
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
        DOOR SETTINGS
      </div>

      {/* Flip Controls */}
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
        Orientation
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={toggleManDoorFlipH} style={buttonStyle}>
          {'\u2194'} Flip H
        </button>
        <button onClick={toggleManDoorFlipV} style={buttonStyle}>
          {'\u2195'} Flip V
        </button>
      </div>

      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 10 }}>
        Click on a wall to place a 3' man door
      </div>
    </div>
  );
}
