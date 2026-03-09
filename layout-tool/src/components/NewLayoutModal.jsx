import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'glr_last_prepared_by';

export default function NewLayoutModal({ onClose, onCreated }) {
  const [customerName, setCustomerName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [preparedBy, setPreparedBy] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Pre-fill preparedBy from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setPreparedBy(saved);
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Save preparedBy for next time
      if (preparedBy) {
        localStorage.setItem(STORAGE_KEY, preparedBy);
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Create the layout
      const { data, error: insertError } = await supabase
        .from('layouts')
        .insert({
          user_id: user.id,
          project_name: projectName || 'New Layout',
          customer_name: customerName,
          prepared_by: preparedBy,
          date: date,
          layout_json: {
            projectName: projectName || 'New Layout',
            customerName: customerName,
            customerAddress: '',
            preparedBy: preparedBy,
            quoteNumber: '',
            date: date,
            walls: [],
            doors: [],
            heaters: [],
            dimensions: [],
          },
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating layout:', insertError);
        setError(insertError.message);
        setLoading(false);
        return;
      }

      onCreated(data);
    } catch (err) {
      console.error('Error creating layout:', err);
      setError('Failed to create layout');
      setLoading(false);
    }
  }

  const inputStyle = {
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
  };

  const labelStyle = {
    display: 'block',
    fontSize: 10,
    color: '#8AAABF',
    marginBottom: 6,
    letterSpacing: 1,
  };

  return (
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
      onClick={onClose}
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
        <h2
          style={{
            margin: '0 0 24px',
            fontSize: 18,
            fontWeight: 600,
            color: '#1B3557',
          }}
        >
          New Layout
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>CUSTOMER NAME *</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
              autoFocus
              style={inputStyle}
              placeholder="Enter customer name"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>PROJECT NAME</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              style={inputStyle}
              placeholder="New Layout"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>PREPARED BY</label>
            <input
              type="text"
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
              style={inputStyle}
              placeholder="Your name"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>DATE</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={inputStyle}
            />
          </div>

          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: '10px 12px',
                background: 'rgba(199,74,26,0.1)',
                border: '1px solid rgba(199,74,26,0.3)',
                borderRadius: 4,
                color: '#C74A1A',
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
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
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 20px',
                background: '#C74A1A',
                border: 'none',
                borderRadius: 4,
                color: 'white',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 1,
                cursor: loading ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'CREATING...' : 'CREATE'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
