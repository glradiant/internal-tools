import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import NewLayoutModal from '../components/NewLayoutModal';
import LayoutCard from '../components/LayoutCard';

export default function HomePage() {
  const navigate = useNavigate();
  const [layouts, setLayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Fetch layouts on mount
  useEffect(() => {
    fetchLayouts();
  }, []);

  async function fetchLayouts() {
    try {
      const { data, error } = await supabase
        .from('layouts')
        .select('id, project_name, customer_name, date, updated_at, thumbnail_url')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching layouts:', error);
      } else {
        setLayouts(data || []);
      }
    } catch (err) {
      console.error('Error fetching layouts:', err);
    }
    setLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  async function handleDelete(id) {
    try {
      const { error } = await supabase.from('layouts').delete().eq('id', id);
      if (error) {
        console.error('Error deleting layout:', error);
      } else {
        setLayouts((prev) => prev.filter((l) => l.id !== id));
      }
    } catch (err) {
      console.error('Error deleting layout:', err);
    }
    setDeleteConfirm(null);
  }

  function handleLayoutCreated(newLayout) {
    navigate(`/layout/${newLayout.id}`);
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F7F9FC',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: '#1B3557',
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src="https://www.glradiant.com/wp-content/uploads/2026/01/GLR-Logo-Transparent-scaled.png" alt="Great Lakes Radiant" style={{ height: 32 }} />
          <div style={{ width: 3, height: 24, background: '#f37021', borderRadius: 2 }} />
          <div style={{ fontSize: 14, color: 'white', fontWeight: 600 }}>
            Heater Layout Tool
          </div>
        </div>
        <button
          onClick={handleSignOut}
          style={{
            padding: '8px 16px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 4,
            color: 'rgba(255,255,255,0.7)',
            fontSize: 10,
            letterSpacing: 1,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          SIGN OUT
        </button>
      </header>

      {/* Main content */}
      <main style={{ padding: '32px 48px', maxWidth: 1400, margin: '0 auto' }}>
        {/* Title row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 32,
          }}
        >
          <h1
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: '#1B3557',
              margin: 0,
            }}
          >
            Recent Layouts
          </h1>
          <button
            onClick={() => setShowNewModal(true)}
            style={{
              padding: '10px 20px',
              background: '#f37021',
              border: 'none',
              borderRadius: 4,
              color: 'white',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 16 }}>+</span>
            NEW LAYOUT
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div
            style={{
              textAlign: 'center',
              padding: 48,
              color: '#8AAABF',
              fontSize: 12,
            }}
          >
            Loading layouts...
          </div>
        )}

        {/* Empty state */}
        {!loading && layouts.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: 64,
              background: 'white',
              borderRadius: 8,
              border: '1px solid #E5E9EF',
            }}
          >
            <div style={{ fontSize: 14, color: '#1B3557', marginBottom: 8 }}>
              No layouts yet
            </div>
            <div style={{ fontSize: 12, color: '#8AAABF' }}>
              Click "New Layout" to create your first layout
            </div>
          </div>
        )}

        {/* Layout grid */}
        {!loading && layouts.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 24,
            }}
          >
            {layouts.map((layout) => (
              <LayoutCard
                key={layout.id}
                layout={layout}
                onClick={() => navigate(`/layout/${layout.id}`)}
                onDelete={() => setDeleteConfirm(layout.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* New Layout Modal */}
      {showNewModal && (
        <NewLayoutModal
          onClose={() => setShowNewModal(false)}
          onCreated={handleLayoutCreated}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,30,48,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 8,
              padding: 32,
              maxWidth: 400,
              boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#1B3557' }}>
              Delete Layout?
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#666' }}>
              This action cannot be undone. The layout will be permanently deleted.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: '8px 16px',
                  background: '#E5E9EF',
                  border: 'none',
                  borderRadius: 4,
                  color: '#1B3557',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                CANCEL
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                style={{
                  padding: '8px 16px',
                  background: '#f37021',
                  border: 'none',
                  borderRadius: 4,
                  color: 'white',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
