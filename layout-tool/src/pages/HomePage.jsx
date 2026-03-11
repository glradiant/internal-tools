import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatName } from '../utils/formatName';
import NewLayoutModal from '../components/NewLayoutModal';
import LayoutCard from '../components/LayoutCard';

export default function HomePage() {
  const navigate = useNavigate();
  const [layouts, setLayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('updated_at'); // 'updated_at' | 'customer_name' | 'date'
  const [sortAsc, setSortAsc] = useState(false);

  // Filter and sort layouts
  const filteredLayouts = useMemo(() => {
    let result = [...layouts];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
        (l.customer_name || '').toLowerCase().includes(q) ||
        (l.project_name || '').toLowerCase().includes(q) ||
        (l.quote_number || '').toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal, bVal;
      if (sortBy === 'updated_at') {
        aVal = new Date(a.updated_at || 0).getTime();
        bVal = new Date(b.updated_at || 0).getTime();
      } else if (sortBy === 'customer_name') {
        aVal = (a.customer_name || '').toLowerCase();
        bVal = (b.customer_name || '').toLowerCase();
      } else if (sortBy === 'date') {
        aVal = a.date || '';
        bVal = b.date || '';
      }
      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });

    return result;
  }, [layouts, searchQuery, sortBy, sortAsc]);

  // Fetch layouts and user data on mount
  useEffect(() => {
    fetchLayouts();
    loadUserName();
  }, []);

  async function loadUserName() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.user_metadata) {
      setFirstName(user.user_metadata.first_name || '');
      setLastName(user.user_metadata.last_name || '');
    }
  }

  async function handleSaveName() {
    setSaving(true);
    setSaveMessage(null);

    const formattedFirst = formatName(firstName);
    const formattedLast = formatName(lastName);
    const fullName = `${formattedFirst} ${formattedLast}`.trim();

    const { error } = await supabase.auth.updateUser({
      data: { first_name: formattedFirst, last_name: formattedLast },
    });

    if (error) {
      setSaveMessage({ type: 'error', text: error.message });
      setSaving(false);
    } else {
      setFirstName(formattedFirst);
      setLastName(formattedLast);
      // Also update localStorage so it's used for new layouts
      localStorage.setItem('glr_last_prepared_by', fullName);
      setSaving(false);
      setShowSettings(false);
    }
  }

  async function fetchLayouts() {
    try {
      const { data, error } = await supabase
        .from('layouts')
        .select('id, project_name, customer_name, quote_number, date, updated_at, thumbnail_url')
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

  async function handleDuplicate(id) {
    try {
      // Fetch the full layout data
      const { data: original, error: fetchError } = await supabase
        .from('layouts')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('Error fetching layout:', fetchError);
        return;
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Create a copy with modified name
      const newProjectName = `${original.project_name || 'Layout'} (Copy)`;
      const layoutJson = original.layout_json || {};
      layoutJson.projectName = newProjectName;

      const { data: newLayout, error: insertError } = await supabase
        .from('layouts')
        .insert({
          user_id: user.id,
          project_name: newProjectName,
          customer_name: original.customer_name,
          customer_address: original.customer_address,
          prepared_by: original.prepared_by,
          quote_number: original.quote_number,
          date: new Date().toISOString().slice(0, 10),
          layout_json: layoutJson,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error duplicating layout:', insertError);
        return;
      }

      // Navigate to the new layout
      navigate(`/layout/${newLayout.id}`);
    } catch (err) {
      console.error('Error duplicating layout:', err);
    }
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {(firstName || lastName) && (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
              {`${firstName} ${lastName}`.trim()}
            </span>
          )}
          <button
            onClick={() => setShowSettings(true)}
            style={{
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 4,
              color: 'rgba(255,255,255,0.7)',
              fontSize: 10,
              letterSpacing: 1,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            SETTINGS
          </button>
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
        </div>
      </header>

      {/* Main content */}
      <main style={{ padding: '32px 48px', maxWidth: 1400, margin: '0 auto' }}>
        {/* Title row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 24,
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
            Layouts
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

        {/* Search and Sort */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
            <input
              type="text"
              placeholder="Search layouts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 36px',
                background: 'white',
                border: '1px solid #E5E9EF',
                borderRadius: 4,
                color: '#1B3557',
                fontSize: 13,
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <svg
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1B3557" strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '10px 12px',
              background: 'white',
              border: '1px solid #E5E9EF',
              borderRadius: 4,
              color: '#1B3557',
              fontSize: 12,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            <option value="updated_at">Last Modified</option>
            <option value="customer_name">Customer Name</option>
            <option value="date">Date</option>
          </select>
          <button
            onClick={() => setSortAsc(!sortAsc)}
            style={{
              padding: '10px 12px',
              background: 'white',
              border: '1px solid #E5E9EF',
              borderRadius: 4,
              color: '#1B3557',
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title={sortAsc ? 'Ascending' : 'Descending'}
          >
            {sortAsc ? '↑' : '↓'}
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

        {/* Empty state - no layouts at all */}
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

        {/* No search results */}
        {!loading && layouts.length > 0 && filteredLayouts.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: 48,
              color: '#8AAABF',
              fontSize: 13,
            }}
          >
            No layouts match your search
          </div>
        )}

        {/* Layout grid */}
        {!loading && filteredLayouts.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 24,
            }}
          >
            {filteredLayouts.map((layout) => (
              <LayoutCard
                key={layout.id}
                layout={layout}
                onClick={() => navigate(`/layout/${layout.id}`)}
                onDelete={() => setDeleteConfirm(layout.id)}
                onDuplicate={() => handleDuplicate(layout.id)}
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

      {/* Settings Modal */}
      {showSettings && (
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
          onClick={() => setShowSettings(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 8,
              padding: 32,
              width: 400,
              maxWidth: '90vw',
              boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 600, color: '#1B3557' }}>
              Settings
            </h2>

            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 10, color: '#8AAABF', marginBottom: 6, letterSpacing: 1 }}>
                  FIRST NAME
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#F7F9FC',
                    border: '1px solid #E5E9EF',
                    borderRadius: 4,
                    color: '#1B3557',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 10, color: '#8AAABF', marginBottom: 6, letterSpacing: 1 }}>
                  LAST NAME
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#F7F9FC',
                    border: '1px solid #E5E9EF',
                    borderRadius: 4,
                    color: '#1B3557',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
            <div style={{ fontSize: 10, color: '#8AAABF', marginBottom: 20 }}>
              This will be used as the default "Prepared by" name in new layouts.
            </div>

            {saveMessage && (
              <div
                style={{
                  marginBottom: 16,
                  padding: '10px 12px',
                  background: saveMessage.type === 'error' ? 'rgba(243,112,33,0.1)' : 'rgba(34,197,94,0.1)',
                  border: `1px solid ${saveMessage.type === 'error' ? 'rgba(243,112,33,0.3)' : 'rgba(34,197,94,0.3)'}`,
                  borderRadius: 4,
                  color: saveMessage.type === 'error' ? '#f37021' : '#22c55e',
                  fontSize: 12,
                }}
              >
                {saveMessage.text}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  padding: '10px 20px',
                  background: '#E5E9EF',
                  border: 'none',
                  borderRadius: 4,
                  color: '#1B3557',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 1,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                CANCEL
              </button>
              <button
                onClick={handleSaveName}
                disabled={saving}
                style={{
                  padding: '10px 20px',
                  background: '#f37021',
                  border: 'none',
                  borderRadius: 4,
                  color: 'white',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 1,
                  cursor: saving ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'SAVING...' : 'SAVE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
