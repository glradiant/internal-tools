import useLayoutStore from '../../store/useLayoutStore';
import { GRID } from '../../utils/constants';

export default function StatusBar({ hoverPos }) {
  const activeTool = useLayoutStore((s) => s.activeTool);
  const heaters = useLayoutStore((s) => s.heaters);
  const totalKbtu = heaters.reduce((s, h) => s + h.model.kbtu, 0);

  const items = [
    ['MODE', activeTool.toUpperCase()],
    hoverPos ? ['POS', `${hoverPos.x / GRID}\u2032, ${hoverPos.y / GRID}\u2032`] : null,
    ['HEATERS', heaters.length],
    ['TOTAL', `${totalKbtu} kBTU`],
  ].filter(Boolean);

  return (
    <div
      style={{
        height: 28,
        background: '#1B3557',
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        gap: 20,
        flexShrink: 0,
        fontFamily: "'DM Mono', monospace",
      }}
    >
      {items.map(([k, v]) => (
        <span key={k} style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5 }}>
          {k}:{' '}
          <span style={{ color: 'rgba(255,255,255,0.65)' }}>{v}</span>
        </span>
      ))}
    </div>
  );
}
