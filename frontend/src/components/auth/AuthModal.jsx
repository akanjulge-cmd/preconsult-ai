import React, { useState } from 'react';
import { loginUser, registerPatient } from '../../services/api';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, initialMode = 'login' }) {
  const [tab, setTab] = useState(initialMode); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [dob, setDob] = useState('1990-05-15');
  const [sex, setSex] = useState('Female');
  const [phone, setPhone] = useState('+1 (555) 345-6789');
  const [preferredLang, setPreferredLang] = useState('en');
  const [accessMode, setAccessMode] = useState('standard');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [consentGiven, setConsentGiven] = useState(true);

  if (!isOpen) return null;

  async function handleLoginSubmit(e) {
    if (e) e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setError('Please enter both email/patient ID and password.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await loginUser(loginEmail.trim(), loginPassword.trim());
      setLoading(false);
      onAuthSuccess(data.user, data.access_token);
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Login failed. Please verify your credentials.');
    }
  }

  async function handleRegisterSubmit(e) {
    if (e) e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !regEmail.trim()) {
      setError('Please fill in your full name and email address.');
      return;
    }
    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!consentGiven) {
      setError('You must agree to clinical triage data processing to create an account.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const data = await registerPatient({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: regEmail.trim(),
        password: regPassword.trim(),
        date_of_birth: dob,
        sex,
        phone,
        preferred_language: preferredLang,
        accessibility_mode: accessMode,
        emergency_contact: emergencyContact.trim() || null,
      });
      setLoading(false);
      onAuthSuccess(data.user, data.access_token);
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Registration failed.');
    }
  }

  function handleDemoPatientLogin() {
    setLoginEmail('maria.demo@preconsult.ai');
    setLoginPassword('Demo@123');
    setError(null);
    setLoading(true);
    loginUser('maria.demo@preconsult.ai', 'Demo@123')
      .then((data) => {
        setLoading(false);
        onAuthSuccess(data.user, data.access_token);
        onClose();
      })
      .catch((err) => {
        setLoading(false);
        setError(err.message || 'Demo login failed');
      });
  }

  function handleDemoClinicianLogin() {
    setLoginEmail('dr.vance@preconsult.ai');
    setLoginPassword('Demo@123');
    setError(null);
    setLoading(true);
    loginUser('dr.vance@preconsult.ai', 'Demo@123')
      .then((data) => {
        setLoading(false);
        onAuthSuccess(data.user, data.access_token);
        onClose();
      })
      .catch((err) => {
        setLoading(false);
        setError(err.message || 'Demo clinician login failed');
      });
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.75rem',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: '#f1f5f9',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Close modal"
        >
          ✕
        </button>

        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'linear-gradient(135deg, #0284c7, #0d9488)',
              padding: '0.5rem 1rem',
              borderRadius: '12px',
              color: '#ffffff',
              marginBottom: '0.5rem',
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>🩺</span>
            <span style={{ fontWeight: 900, letterSpacing: '0.5px', fontSize: '1.1rem' }}>PRECONSULT</span>
            <span
              style={{
                background: 'rgba(255,255,255,0.25)',
                padding: '0.15rem 0.45rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 800,
              }}
            >
              AI
            </span>
          </div>
          <h2 id="auth-modal-title" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
            {tab === 'login' ? 'Patient & Clinical Portal' : 'Patient Registration'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
            Your voice. Your symptoms. A clearer clinical picture.
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: '#f1f5f9',
            borderRadius: '10px',
            padding: '4px',
            marginBottom: '1.25rem',
          }}
        >
          <button
            type="button"
            onClick={() => { setTab('login'); setError(null); }}
            style={{
              padding: '0.55rem',
              borderRadius: '8px',
              border: 'none',
              background: tab === 'login' ? '#ffffff' : 'transparent',
              color: tab === 'login' ? '#0284c7' : '#64748b',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: tab === 'login' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            🔑 Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setError(null); }}
            style={{
              padding: '0.55rem',
              borderRadius: '8px',
              border: 'none',
              background: tab === 'register' ? '#ffffff' : 'transparent',
              color: tab === 'register' ? '#0284c7' : '#64748b',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: tab === 'register' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            📝 Create Account
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div
            style={{
              padding: '0.75rem 1rem',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#dc2626',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '1rem',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* TAB 1: SIGN IN FORM */}
        {tab === 'login' && (
          <form onSubmit={handleLoginSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                Email or Patient Identifier
              </label>
              <input
                type="text"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="e.g. maria.demo@preconsult.ai"
                required
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                Password
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.95rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 6px -1px rgba(2, 132, 199, 0.25)',
                marginBottom: '1rem',
              }}
            >
              {loading ? 'Authenticating...' : 'Sign In to Portal'}
            </button>

            {/* Quick Demo Accounts for Hackathon Judges */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '0.5rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center', marginBottom: '0.75rem' }}>
                ⚡ Hackathon Judge One-Click Access
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleDemoPatientLogin}
                  disabled={loading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '8px',
                    border: '1.5px solid #bfdbfe',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>👩‍💼 <strong>Continue as Demo Patient</strong> (Maria Gonzalez)</span>
                  <span style={{ fontSize: '0.75rem', background: '#dbeafe', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>One-Click</span>
                </button>

                <button
                  type="button"
                  onClick={handleDemoClinicianLogin}
                  disabled={loading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '8px',
                    border: '1.5px solid #bbf7d0',
                    background: '#f0fdf4',
                    color: '#15803d',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>🩺 <strong>Continue as Demo Clinician</strong> (Dr. Sarah Vance, MD)</span>
                  <span style={{ fontSize: '0.75rem', background: '#dcfce7', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>Attending</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: REGISTRATION FORM */}
        {tab === 'register' && (
          <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  First Name *
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Maria"
                  required
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  Last Name *
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Gonzalez"
                  required
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                Email Address *
              </label>
              <input
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="patient@example.com"
                required
                style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  Sex
                </label>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Other">Other / Prefer not to state</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  Preferred Language
                </label>
                <select
                  value={preferredLang}
                  onChange={(e) => setPreferredLang(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                >
                  <option value="en">English (US)</option>
                  <option value="te">తెలుగు (Telugu)</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  Accessibility Mode
                </label>
                <select
                  value={accessMode}
                  onChange={(e) => setAccessMode(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                >
                  <option value="standard">Standard Touch</option>
                  <option value="non_speaking">Non-Speaking (AAC)</option>
                  <option value="tremor">Motor / Tremor Assistance</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  Password *
                </label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Min. 6 chars"
                  required
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  Confirm Password *
                </label>
                <input
                  type="password"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="Re-type password"
                  required
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Consent Agreement */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginTop: '0.25rem' }}>
              <input
                type="checkbox"
                id="consentCheck"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                style={{ marginTop: '0.2rem', cursor: 'pointer' }}
              />
              <label htmlFor="consentCheck" style={{ fontSize: '0.78rem', color: '#475569', cursor: 'pointer' }}>
                I consent to the secure collection, translation, and triage of my symptoms for pre-consultation review.
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #0d9488, #0f766e)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.95rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: '0.5rem',
              }}
            >
              {loading ? 'Creating Account...' : '✓ Create Patient Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
