import useLayoutStore from '../../store/useLayoutStore';
import ProjectFields from './ProjectFields';
import ToolPanel from './ToolPanel';
import HeaterModelPicker from './HeaterModelPicker';
import ManDoorSettings from './ManDoorSettings';
import PositionPanel from './PositionPanel';
import DistributionPanel from './DistributionPanel';
import SummaryPanel from './SummaryPanel';

export default function Sidebar({ onExportPDF }) {
  const activeTool = useLayoutStore((s) => s.activeTool);
  const selectedIds = useLayoutStore((s) => s.selectedIds);
  const heaters = useLayoutStore((s) => s.heaters);

  // Check if multiple heaters are selected
  const selectedHeaterCount = heaters.filter((h) => selectedIds.includes(h.id)).length;

  return (
    <div
      style={{
        width: 230,
        background: '#0F1E30',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        flexShrink: 0,
        fontFamily: "'DM Mono', monospace",
      }}
    >
      {/* Logo / Header */}
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: '#FF6B35', marginBottom: 4 }}>
          GREAT LAKES RADIANT
        </div>
        <div style={{ fontSize: 15, color: 'white', fontWeight: 700, letterSpacing: 1 }}>
          LAYOUT TOOL
        </div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
          v1.0
        </div>
      </div>

      <ProjectFields />
      <ToolPanel />
      {activeTool === 'heater' && <HeaterModelPicker />}
      {activeTool === 'man-door' && <ManDoorSettings />}
      {selectedHeaterCount === 1 && <PositionPanel />}
      {selectedHeaterCount >= 2 && <DistributionPanel />}
      <div style={{ marginTop: 'auto' }}>
        <SummaryPanel onExportPDF={onExportPDF} />
      </div>
    </div>
  );
}
