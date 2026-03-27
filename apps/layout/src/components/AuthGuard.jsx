import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import LoginPage from '../pages/LoginPage';

export default function AuthGuard({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0F1E30',
          fontFamily: "'DM Sans', system-ui, sans-serif",
          color: 'white',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <img
            src="https://www.glradiant.com/wp-content/uploads/2026/01/GLR-Logo-Transparent-scaled.png"
            alt="Great Lakes Radiant"
            style={{ height: 40, marginBottom: 16 }}
          />
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
            Loading...
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return children;
}
