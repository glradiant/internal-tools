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
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      {/* Logo / Header */}
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <img src="https://www.glradiant.com/wp-content/uploads/2026/01/GLR-Logo-Transparent-scaled.png" alt="Great Lakes Radiant" style={{ height: 28, marginBottom: 8 }} />
        <div style={{ fontSize: 13, color: 'white', fontWeight: 600 }}>
          Heater Layout Tool
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
