import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatName } from '../utils/formatName';

export default function LoginPage() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.error('Login error:', authError);
      setError(authError.message);
    }

    setLoading(false);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    // Domain restriction
    if (!email.endsWith('@glradiant.com')) {
      setError('Only @glradiant.com email addresses can register.');
      setLoading(false);
      return;
    }

    // Name validation
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name.');
      setLoading(false);
      return;
    }

    // Password confirmation
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

    // Format the names properly
    const formattedFirst = formatName(firstName);
    const formattedLast = formatName(lastName);

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: formattedFirst,
          last_name: formattedLast,
        },
      },
    });

    if (authError) {
      console.error('Sign up error:', authError);
      setError(authError.message);
    } else {
      setMessage('Check your email to confirm your account.');
      setPassword('');
      setConfirmPassword('');
      setFirstName('');
      setLastName('');
    }

    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (resetError) {
      console.error('Reset password error:', resetError);
      setError(resetError.message);
    } else {
      setMessage('Check your email for a password reset link.');
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
    <div
      style={{
        display: 'flex',
        height: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#FFD200',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top black stripe like the For Dummies books */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 14, background: '#111' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 32, maxWidth: 760, width: '100%', padding: '0 32px' }}>
        {/* Mascot */}
        <div style={{ flexShrink: 0 }}>
          <img
            src="/cad-for-dummies.png"
            alt="CAD for Dummies"
            style={{ width: 220, filter: 'drop-shadow(4px 6px 12px rgba(0,0,0,0.25))' }}
          />
        </div>

        {/* Login card */}
        <div style={{ flex: 1 }}>
          {/* Title block */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#111', marginBottom: 4, textTransform: 'uppercase' }}>Great Lakes Radiant</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#111', lineHeight: 1.1, marginBottom: 6 }}>CAD for Dummies</div>
            <div style={{ fontSize: 13, color: '#333', fontStyle: 'italic' }}>Heater layout design, dummy-proof.</div>
          </div>

      <div
        style={{
          background: 'white',
          borderRadius: 12,
          padding: 32,
          boxShadow: '0 4px 0 #111, 0 8px 24px rgba(0,0,0,0.2)',
          border: '2px solid #111',
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: 24 }}>
          <img src="https://www.glradiant.com/wp-content/uploads/2026/01/GLR-Logo-Transparent-scaled.png" alt="Great Lakes Radiant" style={{ height: 36 }} />
        </div>

        {/* Sign In Form */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 24, textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => { setMode('forgot'); setError(null); setMessage(null); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#8AAABF',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textDecoration: 'underline',
                }}
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <div
                style={{
                  marginBottom: 16,
                  padding: '10px 12px',
                  background: 'rgba(255,107,53,0.2)',
                  border: '1px solid rgba(255,107,53,0.4)',
                  borderRadius: 4,
                  color: '#f37021',
                  fontSize: 12,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: '#f37021',
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
              {loading ? 'SIGNING IN...' : 'SIGN IN'}
            </button>

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <span style={{ fontSize: 11, color: '#8AAABF' }}>
                Don't have an account?{' '}
              </span>
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(null); setMessage(null); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f37021',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textDecoration: 'underline',
                }}
              >
                Create one
              </button>
            </div>
          </form>
        )}

        {/* Sign Up Form */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>FIRST NAME</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  placeholder="John"
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>LAST NAME</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  placeholder="Smith"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@glradiant.com"
                style={inputStyle}
              />
              <div style={{ fontSize: 9, color: '#a0b0c0', marginTop: 4 }}>
                Only @glradiant.com addresses allowed
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
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
                  color: '#f37021',
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
                background: '#f37021',
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
              {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
            </button>

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <span style={{ fontSize: 11, color: '#8AAABF' }}>
                Already have an account?{' '}
              </span>
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(null); setMessage(null); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f37021',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textDecoration: 'underline',
                }}
              >
                Sign in
              </button>
            </div>
          </form>
        )}

        {/* Forgot Password Form */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword}>
            <div style={{ marginBottom: 8, fontSize: 13, color: '#5A7A9A' }}>
              Reset Password
            </div>
            <div style={{ marginBottom: 24, fontSize: 11, color: '#8AAABF' }}>
              Enter your email and we'll send you a reset link.
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                  color: '#f37021',
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
                background: '#f37021',
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
              {loading ? 'SENDING...' : 'SEND RESET LINK'}
            </button>

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(null); setMessage(null); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f37021',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textDecoration: 'underline',
                }}
              >
                Back to sign in
              </button>
            </div>
          </form>
        )}
      </div>
        </div>
      </div>
    </div>
  );
}
