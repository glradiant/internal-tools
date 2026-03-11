import useLayoutStore from '../../store/useLayoutStore';

export default function DoorPositionPanel() {
  const selectedIds = useLayoutStore((s) => s.selectedIds);
  const doors = useLayoutStore((s) => s.doors);
  const updateDoor = useLayoutStore((s) => s.updateDoor);

  // Get selected door (only show for single door selection)
  const selectedDoor = selectedIds.length === 1
    ? doors.find((d) => d.id === selectedIds[0])
    : null;

  if (!selectedDoor || selectedDoor.doorType !== 'man') {
    return null;
  }

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
          onClick={() => updateDoor(selectedDoor.id, { hingeSide: 'left' })}
          style={{
            flex: 1,
            padding: '6px 0',
            background: selectedDoor.hingeSide === 'left' ? '#f37021' : 'rgba(255,255,255,0.05)',
            border: 'none',
            borderRadius: 3,
            color: selectedDoor.hingeSide === 'left' ? 'white' : 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 9,
          }}
        >
          Left
        </button>
        <button
          onClick={() => updateDoor(selectedDoor.id, { hingeSide: 'right' })}
          style={{
            flex: 1,
            padding: '6px 0',
            background: selectedDoor.hingeSide === 'right' ? '#f37021' : 'rgba(255,255,255,0.05)',
            border: 'none',
            borderRadius: 3,
            color: selectedDoor.hingeSide === 'right' ? 'white' : 'rgba(255,255,255,0.4)',
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
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        <button
          onClick={() => updateDoor(selectedDoor.id, { swingIn: true })}
          style={{
            flex: 1,
            padding: '6px 0',
            background: selectedDoor.swingIn ? '#f37021' : 'rgba(255,255,255,0.05)',
            border: 'none',
            borderRadius: 3,
            color: selectedDoor.swingIn ? 'white' : 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 9,
          }}
        >
          Inward
        </button>
        <button
          onClick={() => updateDoor(selectedDoor.id, { swingIn: false })}
          style={{
            flex: 1,
            padding: '6px 0',
            background: !selectedDoor.swingIn ? '#f37021' : 'rgba(255,255,255,0.05)',
            border: 'none',
            borderRadius: 3,
            color: !selectedDoor.swingIn ? 'white' : 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 9,
          }}
        >
          Outward
        </button>
      </div>

      {/* Flip Controls */}
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
        Flip
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => updateDoor(selectedDoor.id, { flipH: !selectedDoor.flipH })}
          style={{
            flex: 1,
            padding: '6px 0',
            background: selectedDoor.flipH ? '#f37021' : 'rgba(255,255,255,0.05)',
            border: 'none',
            borderRadius: 3,
            color: selectedDoor.flipH ? 'white' : 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 9,
          }}
        >
          Flip H
        </button>
        <button
          onClick={() => updateDoor(selectedDoor.id, { flipV: !selectedDoor.flipV })}
          style={{
            flex: 1,
            padding: '6px 0',
            background: selectedDoor.flipV ? '#f37021' : 'rgba(255,255,255,0.05)',
            border: 'none',
            borderRadius: 3,
            color: selectedDoor.flipV ? 'white' : 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 9,
          }}
        >
          Flip V
        </button>
      </div>
    </div>
  );
}
