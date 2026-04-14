import { useRef, useCallback, useEffect } from 'react';
import useLayoutStore from '../../store/useLayoutStore';
import ProjectFields from './ProjectFields';
import ToolPanel from './ToolPanel';
import HeaterModelPicker from './HeaterModelPicker';
import ManDoorSettings from './ManDoorSettings';
import PositionPanel from './PositionPanel';
import DoorPositionPanel from './DoorPositionPanel';
import DistributionPanel from './DistributionPanel';
import LabelSettingsPanel from './LabelSettingsPanel';
import SummaryPanel from './SummaryPanel';

const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function Sidebar({ onExportPDF, width = 280, onWidthChange, onOpenBuilder }) {
  const activeTool = useLayoutStore((s) => s.activeTool);
  const selectedIds = useLayoutStore((s) => s.selectedIds);
  const heaters = useLayoutStore((s) => s.heaters);
  const doors = useLayoutStore((s) => s.doors);
  const dimensions = useLayoutStore((s) => s.dimensions);
  const isResizing = useRef(false);

  // Check if multiple heaters are selected
  const selectedHeaterCount = heaters.filter((h) => selectedIds.includes(h.id)).length;
  // Check if a door is selected
  const selectedDoor = selectedIds.length === 1
    ? doors.find((d) => d.id === selectedIds[0])
    : null;
  const walls = useLayoutStore((s) => s.walls);
  // Check if a single entity (heater, door, dimension, or wall) is selected for label settings
  const showLabelSettings = selectedIds.length === 1 && (
    heaters.some((h) => h.id === selectedIds[0]) ||
    doors.some((d) => d.id === selectedIds[0]) ||
    dimensions.some((d) => d.id === selectedIds[0]) ||
    walls.some((w) => w.id === selectedIds[0])
  );

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!isResizing.current || !onWidthChange) return;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, e.clientX));
      onWidthChange(newWidth);
    };

    const handlePointerUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [onWidthChange]);

  return (
    <div
      style={{
        width,
        background: '#0F1E30',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        flexShrink: 0,
        fontFamily: "'DM Sans', system-ui, sans-serif",
        position: 'relative',
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

      {/* Scrollable middle section */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <ProjectFields />
        <ToolPanel />
        {activeTool === 'heater' && <HeaterModelPicker onOpenBuilder={onOpenBuilder} />}
        {activeTool === 'man-door' && <ManDoorSettings />}
        {selectedHeaterCount === 1 && <PositionPanel />}
        {selectedHeaterCount >= 2 && <DistributionPanel />}
        {selectedDoor && <DoorPositionPanel />}
        {showLabelSettings && <LabelSettingsPanel />}
      </div>

      {/* Fixed bottom section */}
      <SummaryPanel onExportPDF={onExportPDF} />

      {/* Resize handle */}
      <div
        onPointerDown={handleResizeStart}
        style={{
          position: 'absolute',
          top: 0,
          right: -3,
          width: 6,
          height: '100%',
          cursor: 'ew-resize',
          background: 'transparent',
          zIndex: 10,
        }}
        title="Drag to resize sidebar"
      >
        {/* Visual indicator line */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 2,
            height: 40,
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 1,
          }}
        />
      </div>
    </div>
  );
}
