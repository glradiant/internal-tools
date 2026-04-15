import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import ShipmentsPage from './pages/ShipmentsPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);
  const [page, setPage] = useState(() => {
    // Simple hash-based routing: #/shipments
    const hash = window.location.hash.replace('#', '');
    if (hash.startsWith('/shipments')) return 'shipments';
    return 'home';
  });

  useEffect(() => {
    // Check if this is a password recovery link (Supabase puts type=recovery in the hash)
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Listen for hash changes
    const onHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash.startsWith('/shipments')) setPage('shipments');
      else setPage('home');
    };
    window.addEventListener('hashchange', onHash);

    return () => { subscription.unsubscribe(); window.removeEventListener('hashchange', onHash); };
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        height: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0F1E30',
        color: 'white',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>
        Loading...
      </div>
    );
  }

  if (isRecovery) return <ResetPasswordPage />;

  if (!session) return <LoginPage />;

  if (page === 'shipments') return <Dashboard session={session} activePage="shipments" />;
  return <Dashboard session={session} activePage="home" />;
}
