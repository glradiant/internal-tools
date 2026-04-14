import { useRef, useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/sidebar/Sidebar';
import Toolbar from '../components/toolbar/Toolbar';
import StatusBar from '../components/toolbar/StatusBar';
import DrawingCanvas from '../components/canvas/DrawingCanvas';
import HeaterBuilderModal from '../components/modals/HeaterBuilderModal';
import { exportPDF } from '../utils/export';
import { supabase } from '../lib/supabase';
import useLayoutStore from '../store/useLayoutStore';
import useAutosave from '../hooks/useAutosave';

const DEFAULT_SIDEBAR_WIDTH = 280;

// Detect touch-primary device (iPad, phone) vs mouse-primary (desktop)
const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches;

export default function LayoutCanvas() {
  const { id } = useParams();
  const navigate = useNavigate();
  const svgRef = useRef(null);
  const [hoverPos, setHoverPos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [showBuilder, setShowBuilder] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(!isTouchDevice());
  const [isTouch] = useState(isTouchDevice);

  const loadLayout = useLayoutStore((s) => s.loadLayout);
  const clearAll = useLayoutStore((s) => s.clearAll);
  const addCustomHeater = useLayoutStore((s) => s.addCustomHeater);
  const setSelectedModel = useLayoutStore((s) => s.setSelectedModel);

  // Load layout from database on mount
  useEffect(() => {
    async function fetchLayout() {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('layouts')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) {
          console.error('Error fetching layout:', fetchError);
          setError('Failed to load layout');
          setLoading(false);
          return;
        }

        if (data) {
          // Load the layout JSON into the store
          const layoutData = data.layout_json || {};
          loadLayout({
            projectName: data.project_name || layoutData.projectName || 'New Layout',
            customerName: data.customer_name || layoutData.customerName || '',
            customerAddress: data.customer_address || layoutData.customerAddress || '',
            preparedBy: data.prepared_by || layoutData.preparedBy || '',
            quoteNumber: data.quote_number || layoutData.quoteNumber || '',
            revision: layoutData.revision || 'A',
            gasType: layoutData.gasType || '',
            date: data.date || layoutData.date || new Date().toISOString().slice(0, 10),
            walls: layoutData.walls || [],
            doors: layoutData.doors || [],
            heaters: layoutData.heaters || [],
            dimensions: layoutData.dimensions || [],
            customHeaters: layoutData.customHeaters || [],
          });
        }
      } catch (err) {
        console.error('Error loading layout:', err);
        setError('Failed to load layout');
      }

      setLoading(false);
    }

    fetchLayout();
  }, [id, loadLayout]);

  // Set up autosave
  const { saveStatus, flush } = useAutosave(id, svgRef);

  const handleExportPDF = useCallback(async () => {
    const svg = svgRef.current?.svgElement;
    if (!svg) return;
    await exportPDF(svg);
  }, []);

  const handleBack = useCallback(async () => {
    // Flush any pending saves before navigating
    await flush();
    navigate('/');
  }, [flush, navigate]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'DM Sans', system-ui, sans-serif",
          background: '#0F1E30',
          color: 'white',
        }}
      >
        Loading layout...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 16,
          fontFamily: "'DM Sans', system-ui, sans-serif",
          background: '#0F1E30',
          color: 'white',
        }}
      >
        <div style={{ color: '#f37021' }}>{error}</div>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '8px 16px',
            background: '#1B3557',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 4,
            color: 'white',
            cursor: 'pointer',
          }}
        >
          Back to Layouts
        </button>
      </div>
    );
  }

  // Auto-close sidebar when tool is selected on touch devices
  const handleToolSelected = useCallback(() => {
    if (isTouch) setSidebarOpen(false);
  }, [isTouch]);

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        height: '100dvh',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        background: '#0F1E30',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Sidebar: overlay on touch, inline on desktop */}
      {sidebarOpen && (
        <>
          {isTouch && (
            <div
              onClick={() => setSidebarOpen(false)}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                zIndex: 19,
              }}
            />
          )}
          <div style={isTouch ? {
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            zIndex: 20,
            width: DEFAULT_SIDEBAR_WIDTH,
          } : undefined}>
            <Sidebar
              onExportPDF={handleExportPDF}
              width={isTouch ? DEFAULT_SIDEBAR_WIDTH : sidebarWidth}
              onWidthChange={isTouch ? undefined : setSidebarWidth}
              onOpenBuilder={() => setShowBuilder(true)}
              onToolSelected={handleToolSelected}
              isTouch={isTouch}
            />
          </div>
        </>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F7F9FC' }}>
        <Toolbar
          onBack={handleBack}
          saveStatus={saveStatus}
          onRecenter={() => svgRef.current?.recenter()}
          isTouch={isTouch}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <DrawingCanvas ref={svgRef} onHoverPos={setHoverPos} />
        </div>
        {!isTouch && <StatusBar hoverPos={hoverPos} />}
      </div>

      {showBuilder && (
        <HeaterBuilderModal
          onClose={() => setShowBuilder(false)}
          onSave={(model) => {
            addCustomHeater(model);
            setSelectedModel(model.id);
            setShowBuilder(false);
          }}
        />
      )}
    </div>
  );
}
