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
          fontFamily: "'DM Mono', 'Courier New', monospace",
          color: 'white',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 2,
              marginBottom: 16,
            }}
          >
            GLR
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
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
