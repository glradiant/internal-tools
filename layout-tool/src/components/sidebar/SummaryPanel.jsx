import { useRef } from 'react';
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
    padding: '6px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.3)',
    cursor: 'pointer',
    borderRadius: 3,
    fontFamily: 'inherit',
    fontSize: 9,
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
          <span style={{ color: val > 0 ? '#FF6B35' : 'rgba(255,255,255,0.2)' }}>{val}</span>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button onClick={clearAll} style={{ ...btnStyle, flex: 1 }}>
          CLEAR
        </button>
        <button
          onClick={onExportPDF}
          style={{
            flex: 2,
            padding: '6px',
            background: '#FF6B35',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            borderRadius: 3,
            fontFamily: 'inherit',
            fontSize: 9,
            letterSpacing: 1,
          }}
        >
          EXPORT PDF
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <button onClick={handleSave} style={{ ...btnStyle, flex: 1 }}>
          SAVE
        </button>
        <button onClick={() => fileInputRef.current?.click()} style={{ ...btnStyle, flex: 1 }}>
          LOAD
        </button>
      </div>

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
