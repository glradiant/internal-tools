import useLayoutStore from '../../store/useLayoutStore';
import { TOOLS } from '../../utils/constants';

export default function ToolPanel() {
  const activeTool = useLayoutStore((s) => s.activeTool);
  const setActiveTool = useLayoutStore((s) => s.setActiveTool);

  return (
    <div style={{ padding: '12px 18px 8px' }}>
      <div style={{ fontSize: 8, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
        TOOLS
      </div>
      {TOOLS.map((t) => {
        const isActive = activeTool === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setActiveTool(t.id)}
            style={{
              width: '100%',
              marginBottom: 4,
              padding: '8px 10px',
              background: isActive ? 'rgba(243,112,33,0.15)' : 'rgba(255,255,255,0.03)',
              border: isActive
                ? '1px solid rgba(243,112,33,0.6)'
                : '1px solid rgba(255,255,255,0.07)',
              borderRadius: 4,
              color: isActive ? '#f37021' : 'rgba(255,255,255,0.55)',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              fontSize: 11,
              letterSpacing: 0.5,
              transition: 'all 0.15s',
            }}
          >
            <span style={{ marginRight: 8 }}>{t.icon}</span>
            {t.label}
            {isActive && (
              <div style={{ fontSize: 8, opacity: 0.6, marginTop: 3, lineHeight: 1.4 }}>
                {t.hint}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
