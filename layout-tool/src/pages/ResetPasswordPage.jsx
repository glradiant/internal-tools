import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [ready, setReady] = useState(false);

  // Check if we have a valid session from the reset link
  useEffect(() => {
    // Supabase automatically handles the token in the URL hash
    // and establishes a session. We just need to check if we have one.
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

    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    });

    if (updateError) {
      console.error('Password update error:', updateError);
      setError(updateError.message);
    } else {
      setMessage('Password updated successfully! Redirecting...');
      setTimeout(() => {
        navigate('/');
      }, 2000);
    }

    setLoading(false);
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 4,
    color: 'white',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block',
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 6,
    letterSpacing: 1,
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0F1E30',
        fontFamily: "'DM Mono', 'Courier New', monospace",
      }}
    >
      <div
        style={{
          background: '#1B3557',
          borderRadius: 8,
          padding: 40,
          width: 340,
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        }}
      >
        {/* Logo / Title */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: 'white',
              letterSpacing: 2,
            }}
          >
            GLR
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: 1,
              marginTop: 4,
            }}
          >
            RESET PASSWORD
          </div>
        </div>

        {!ready && !error && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
            Verifying reset link...
          </div>
        )}

        {error && !ready && (
          <div>
            <div
              style={{
                marginBottom: 24,
                padding: '10px 12px',
                background: 'rgba(255,107,53,0.2)',
                border: '1px solid rgba(255,107,53,0.4)',
                borderRadius: 4,
                color: '#FF6B35',
                fontSize: 12,
              }}
            >
              {error}
            </div>
            <button
              onClick={() => navigate('/')}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: '#C74A1A',
                border: 'none',
                borderRadius: 4,
                color: 'white',
                fontSize: 12,
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
              <div
                style={{
                  marginBottom: 16,
                  padding: '10px 12px',
                  background: 'rgba(255,107,53,0.2)',
                  border: '1px solid rgba(255,107,53,0.4)',
                  borderRadius: 4,
                  color: '#FF6B35',
                  fontSize: 12,
                }}
              >
                {error}
              </div>
            )}

            {message && (
              <div
                style={{
                  marginBottom: 16,
                  padding: '10px 12px',
                  background: 'rgba(138,170,191,0.2)',
                  border: '1px solid rgba(138,170,191,0.4)',
                  borderRadius: 4,
                  color: '#8AAABF',
                  fontSize: 12,
                }}
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: '#C74A1A',
                border: 'none',
                borderRadius: 4,
                color: 'white',
                fontSize: 12,
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
