import { supabase } from '../lib/supabase';

export default function Dashboard({ session }) {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: '#666' }}>
            {session.user.email}
          </span>
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
            A collection of utilities built to help the Great Lakes Radiant team work more efficiently.
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
            href="/layout"
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
    </div>
  );
}
