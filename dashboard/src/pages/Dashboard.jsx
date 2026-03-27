import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatName } from '../utils/formatName';

export default function Dashboard({ session }) {
  const [showSettings, setShowSettings] = useState(false);
  const [firstName, setFirstName] = useState(session.user.user_metadata?.first_name || '');
  const [lastName, setLastName] = useState(session.user.user_metadata?.last_name || '');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleSaveName = async () => {
    setSaving(true);
    setSaveMessage(null);

    const formattedFirst = formatName(firstName);
    const formattedLast = formatName(lastName);

    const { error } = await supabase.auth.updateUser({
      data: { first_name: formattedFirst, last_name: formattedLast },
    });

    if (error) {
      setSaveMessage({ type: 'error', text: error.message });
      setSaving(false);
    } else {
      setFirstName(formattedFirst);
      setLastName(formattedLast);
      setSaving(false);
      setShowSettings(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f0f1f4', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{
        background: '#fff',
        borderBottom: '3px solid #f37021',
        padding: '16px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img
            src="https://www.glradiant.com/wp-content/uploads/2026/01/GLR-Logo-Transparent-scaled.png"
            alt="Great Lakes Radiant"
            style={{ height: 32 }}
          />
          <div style={{ width: 3, height: 24, background: '#f37021', borderRadius: 2 }} />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
            Internal Tools
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#666' }}>
            {session.user.user_metadata?.full_name || session.user.email}
          </span>
          <button
            onClick={() => setShowSettings(true)}
            style={{
              padding: '8px 12px',
              background: 'transparent',
              border: '1px solid #ddd',
              borderRadius: 6,
              color: '#666',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            Settings
          </button>
          <button
            onClick={handleSignOut}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid #ddd',
              borderRadius: 6,
              color: '#666',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px 64px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a', marginBottom: 12 }}>
            Welcome to GLR Internal Tools
          </h2>
          <p style={{ fontSize: 16, color: '#666', maxWidth: 500, margin: '0 auto', lineHeight: 1.6 }}>
            A collection of utilities built to help you work more efficiently.
          </p>
        </div>

        {/* Tools Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 24,
        }}>
          {/* Email Signature Generator */}
          <a
            href="/signatures"
            style={{
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.03)',
              overflow: 'hidden',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              textDecoration: 'none',
              color: 'inherit',
              display: 'block',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.03)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.03)';
            }}
          >
            <div style={{ height: 4, background: '#f37021' }} />
            <div style={{ padding: '28px 28px 32px' }}>
              <div style={{
                width: 56,
                height: 56,
                background: 'linear-gradient(135deg, #fff5f0 0%, #ffe8dc 100%)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="#f37021">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
                Email Signature Generator
              </h3>
              <p style={{ fontSize: 14, color: '#666', lineHeight: 1.55, marginBottom: 20 }}>
                Create branded email signatures for Outlook and NetSuite with your contact info, complete with live preview and one-click copy.
              </p>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: '#f37021' }}>
                Open Tool
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </span>
            </div>
          </a>

          {/* Heater Layout Tool */}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              const { access_token, refresh_token } = session;
              window.open(`https://layout.glradiant.com/?access_token=${access_token}&refresh_token=${refresh_token}`, '_blank');
            }}
            style={{
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.03)',
              overflow: 'hidden',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              textDecoration: 'none',
              color: 'inherit',
              display: 'block',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.03)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.03)';
            }}
          >
            <div style={{ height: 4, background: '#f37021' }} />
            <div style={{ padding: '28px 28px 32px' }}>
              <div style={{
                width: 56,
                height: 56,
                background: 'linear-gradient(135deg, #fff5f0 0%, #ffe8dc 100%)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="#f37021">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                </svg>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
                Heater Layout Tool
              </h3>
              <p style={{ fontSize: 14, color: '#666', lineHeight: 1.55, marginBottom: 20 }}>
                Design and visualize heater placement layouts for buildings. Draw walls, place heaters, and export professional layout drawings.
              </p>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: '#f37021' }}>
                Open Tool
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </span>
            </div>
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '32px 24px', fontSize: 12, color: '#aaa' }}>
        Great Lakes Radiant · <a href="https://www.glradiant.com" target="_blank" rel="noopener noreferrer" style={{ color: '#f37021', textDecoration: 'none' }}>glradiant.com</a>
      </footer>

      {/* Settings Modal */}
      {showSettings && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
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
              borderRadius: 12,
              padding: 32,
              width: 400,
              maxWidth: '90vw',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 600, color: '#1a1a1a' }}>
              Settings
            </h2>

            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 6, letterSpacing: 1, fontWeight: 500 }}>
                  FIRST NAME
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: '#f5f7fa',
                    border: '1px solid #e0e4ea',
                    borderRadius: 6,
                    color: '#1a1a1a',
                    fontSize: 14,
                    fontFamily: 'inherit',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 6, letterSpacing: 1, fontWeight: 500 }}>
                  LAST NAME
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: '#f5f7fa',
                    border: '1px solid #e0e4ea',
                    borderRadius: 6,
                    color: '#1a1a1a',
                    fontSize: 14,
                    fontFamily: 'inherit',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#999', marginBottom: 20 }}>
              This will be used as the default "Prepared by" name in layouts.
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
                  background: '#f0f1f4',
                  border: 'none',
                  borderRadius: 6,
                  color: '#666',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveName}
                disabled={saving}
                style={{
                  padding: '10px 20px',
                  background: '#f37021',
                  border: 'none',
                  borderRadius: 6,
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: saving ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
