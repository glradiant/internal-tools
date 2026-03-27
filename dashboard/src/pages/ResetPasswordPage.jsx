import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
      } else {
        setError('Invalid or expired reset link. Please request a new one.');
      }
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage('Password updated successfully! Redirecting...');
      setTimeout(() => { window.location.href = '/'; }, 2000);
    }

    setLoading(false);
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    background: '#f5f7fa',
    border: '1px solid #e0e4ea',
    borderRadius: 6,
    color: '#1B3557',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block',
    fontSize: 11,
    color: '#8AAABF',
    marginBottom: 6,
    letterSpacing: 1,
    fontWeight: 500,
  };

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0F1E30',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <div style={{
        background: 'white',
        borderRadius: 12,
        padding: 40,
        width: 360,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img
            src="https://www.glradiant.com/wp-content/uploads/2026/01/GLR-Logo-Transparent-scaled.png"
            alt="Great Lakes Radiant"
            style={{ height: 48, marginBottom: 12, display: 'block', marginLeft: 'auto', marginRight: 'auto' }}
          />
          <div style={{ fontSize: 14, color: '#1B3557', fontWeight: 500 }}>
            Reset Password
          </div>
        </div>

        {!ready && !error && (
          <div style={{ textAlign: 'center', color: '#8AAABF', fontSize: 13 }}>
            Verifying reset link...
          </div>
        )}

        {error && !ready && (
          <div>
            <div style={{
              marginBottom: 24,
              padding: '10px 12px',
              background: 'rgba(255,107,53,0.08)',
              border: '1px solid rgba(255,107,53,0.3)',
              borderRadius: 6,
              color: '#f37021',
              fontSize: 13,
            }}>
              {error}
            </div>
            <button
              onClick={() => window.location.href = '/'}
              style={{
                width: '100%',
                padding: '13px 16px',
                background: '#f37021',
                border: 'none',
                borderRadius: 6,
                color: 'white',
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 1,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              BACK TO LOGIN
            </button>
          </div>
        )}

        {ready && (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>NEW PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoFocus
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>CONFIRM PASSWORD</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{
                marginBottom: 16,
                padding: '10px 12px',
                background: 'rgba(255,107,53,0.08)',
                border: '1px solid rgba(255,107,53,0.3)',
                borderRadius: 6,
                color: '#f37021',
                fontSize: 13,
              }}>
                {error}
              </div>
            )}

            {message && (
              <div style={{
                marginBottom: 16,
                padding: '10px 12px',
                background: 'rgba(138,170,191,0.1)',
                border: '1px solid rgba(138,170,191,0.4)',
                borderRadius: 6,
                color: '#1B3557',
                fontSize: 13,
              }}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px 16px',
                background: '#f37021',
                border: 'none',
                borderRadius: 6,
                color: 'white',
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 1,
                cursor: loading ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'UPDATING...' : 'UPDATE PASSWORD'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
