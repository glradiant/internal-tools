import { useRef, useState } from 'react';
import useLayoutStore from '../../store/useLayoutStore';
import { getHeaterModel } from '../../utils/constants';

export default function SummaryPanel({ onExportPDF }) {
  const walls = useLayoutStore((s) => s.walls);
  const doors = useLayoutStore((s) => s.doors);
  const heaters = useLayoutStore((s) => s.heaters);
  const projectName = useLayoutStore((s) => s.projectName);
  const clearAll = useLayoutStore((s) => s.clearAll);
  const loadLayout = useLayoutStore((s) => s.loadLayout);
  const fileInputRef = useRef(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const totalKbtu = heaters.reduce((s, h) => s + h.model.kbtu, 0);
  const overheadDoors = doors.filter(d => d.doorType !== 'man').length;
  const manDoors = doors.filter(d => d.doorType === 'man').length;

  const handleSave = () => {
    const state = useLayoutStore.getState();
    // Strip svgContent from heater models to reduce file size
    const heatersForSave = state.heaters.map(h => ({
      ...h,
      model: {
        id: h.model.id,
        label: h.model.label,
        categoryId: h.model.categoryId,
        kbtu: h.model.kbtu,
        lengthFt: h.model.lengthFt,
        // Don't save svgContent, dimensions, svgPath - will re-hydrate on load
      }
    }));
    const data = {
      projectName: state.projectName,
      customerName: state.customerName,
      customerAddress: state.customerAddress,
      preparedBy: state.preparedBy,
      quoteNumber: state.quoteNumber,
      date: state.date,
      walls: state.walls,
      doors: state.doors,
      heaters: heatersForSave,
      dimensions: state.dimensions,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.projectName || 'layout'}.glr`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoad = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        // Re-hydrate heater models with SVG content from catalog
        if (data.heaters) {
          data.heaters = data.heaters.map(h => {
            const catalogModel = getHeaterModel(h.model?.id);
            return {
              ...h,
              model: catalogModel || h.model // Use catalog model if found, otherwise use saved
            };
          });
        }
        loadLayout(data);
      } catch {
        alert('Invalid layout file.');
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be loaded again
    e.target.value = '';
  };

  const stats = [
    ['Buildings', walls.length],
    ['Overhead Doors', overheadDoors],
    ['Man Doors', manDoors],
    ['Heaters', heaters.length],
    ['Total kBTU', totalKbtu],
  ];

  const btnStyle = {
    padding: '8px 12px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    borderRadius: 4,
    fontFamily: 'inherit',
    fontSize: 11,
  };

  return (
    <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ fontSize: 8, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
        SUMMARY
      </div>
      {stats.map(([label, val]) => (
        <div
          key={label}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 4,
            fontSize: 10,
          }}
        >
          <span style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</span>
          <span style={{ color: val > 0 ? '#f37021' : 'rgba(255,255,255,0.2)' }}>{val}</span>
        </div>
      ))}

      {/* Primary action - Download PDF */}
      <button
        onClick={onExportPDF}
        style={{
          width: '100%',
          padding: '8px 12px',
          marginTop: 10,
          background: '#f37021',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          borderRadius: 4,
          fontFamily: 'inherit',
          fontSize: 11,
          fontWeight: 500,
        }}
      >
        ↓ Download PDF
      </button>

      {/* Secondary actions - Export/Import .glr */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button onClick={handleSave} style={{ ...btnStyle, flex: 1 }}>
          ↓ Export .glr
        </button>
        <button onClick={() => fileInputRef.current?.click()} style={{ ...btnStyle, flex: 1 }}>
          ↑ Import .glr
        </button>
      </div>

      {/* Destructive action - Clear Canvas */}
      <button
        onClick={() => setShowClearConfirm(true)}
        style={{
          width: '100%',
          padding: '8px 12px',
          marginTop: 8,
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.4)',
          cursor: 'pointer',
          borderRadius: 4,
          fontFamily: 'inherit',
          fontSize: 11,
        }}
      >
        🗑 Clear Canvas
      </button>

      {/* Clear confirmation dialog */}
      {showClearConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowClearConfirm(false)}
        >
          <div
            style={{
              background: '#1B3557',
              borderRadius: 8,
              padding: 24,
              maxWidth: 320,
              border: '1px solid rgba(255,255,255,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ color: 'white', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
              Clear Canvas?
            </div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 20 }}>
              This will remove all walls, doors, heaters, and dimensions. This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowClearConfirm(false)}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                  borderRadius: 4,
                  fontFamily: 'inherit',
                  fontSize: 12,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearAll();
                  setShowClearConfirm(false);
                }}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: '1px solid #dc2626',
                  color: '#dc2626',
                  cursor: 'pointer',
                  borderRadius: 4,
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                Clear Canvas
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".glr,.json"
        onChange={handleLoad}
        style={{ display: 'none' }}
      />
    </div>
  );
}
