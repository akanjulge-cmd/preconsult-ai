import React, { useState, useEffect, useCallback } from 'react';
import AccessibilityBar from './components/common/AccessibilityBar';
import IntakeWizard from './components/intake/IntakeWizard';
import ClinicianDashboard from './components/doctor/ClinicianDashboard';
import DocumentScanner from './components/documents/DocumentScanner';
import SystemDiagnostics from './components/common/SystemDiagnostics';
import AuthModal from './components/auth/AuthModal';
import PatientDashboard from './components/patient/PatientDashboard';
import {
  checkHealth,
  createSession,
  loginUser,
  getCurrentUser,
  clearAuthToken,
  BACKEND_URL,
  IS_DEMO_MODE,
} from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('patient'); // 'patient' | 'patient_dashboard' | 'scanner' | 'doctor' | 'status'
  const [theme, setTheme] = useState('standard');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [textScale, setTextScale] = useState('standard');
  const [motorMode, setMotorMode] = useState('standard');
  const [audioEnabled, setAudioEnabled] = useState(false);

  // Authentication State
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [clinicianGuardOpen, setClinicianGuardOpen] = useState(false);

  const [health, setHealth] = useState({ status: 'connecting', detail: null, error: null });
  const [healthAttempt, setHealthAttempt] = useState({ current: 1, max: 5 });
  const [activeSession, setActiveSession] = useState(null);
  const [submittedIntake, setSubmittedIntake] = useState(null);

  const [language, setLanguage] = useState('en'); // 'en' | 'te' | 'hi'
  const [showA11y, setShowA11y] = useState(false);

  // Apply accessibility attributes to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-reduced-motion', reducedMotion ? 'true' : 'false');
    document.documentElement.setAttribute('data-text-scale', textScale);
    document.documentElement.setAttribute('data-motor-mode', motorMode);
  }, [theme, reducedMotion, textScale, motorMode]);

  // Restore authenticated session on mount
  useEffect(() => {
    async function restoreAuth() {
      try {
        const user = await getCurrentUser();
        if (user) {
          setCurrentUser(user);
          if (user.profile?.preferred_language) {
            setLanguage(user.profile.preferred_language);
          }
          if (user.profile?.accessibility_mode) {
            setMotorMode(user.profile.accessibility_mode);
          }
        }
      } catch (err) {
        console.warn('Session restoration failed:', err);
      }
    }
    restoreAuth();
  }, []);

  // Check backend health and auto-create default session
  const init = useCallback(async () => {
    setHealth({ status: 'connecting', detail: null, error: null });
    try {
      const data = await checkHealth(5, 2000, (curr, max) => {
        setHealthAttempt({ current: curr, max });
      });
      setHealth({ status: 'healthy', detail: data, error: null });
      // Create initial session for patient
      const sess = await createSession({
        preferredLanguage: language,
        accessibilityMode: 'standard',
        patientIdentifier: currentUser?.id || 'PAT-ANON',
      });
      setActiveSession(sess);
    } catch (err) {
      setHealth({ status: 'error', detail: null, error: err.message || 'Connection failed' });
      if (IS_DEMO_MODE) {
        setActiveSession({
          session_id: 'SES-DEMO-01',
          created_at: new Date().toISOString(),
          status: 'active',
          preferred_language: language,
          accessibility_mode: 'standard',
          is_demo: true,
        });
      } else {
        setActiveSession(null);
      }
    }
  }, [language, currentUser]);

  useEffect(() => {
    init();
  }, [init]);

  function handleAuthSuccess(user, token) {
    setCurrentUser(user);
    if (user.profile?.preferred_language) {
      setLanguage(user.profile.preferred_language);
    }
    if (user.profile?.accessibility_mode) {
      setMotorMode(user.profile.accessibility_mode);
    }
    if (user.role === 'patient') {
      setActiveTab('patient_dashboard');
    } else if (user.role === 'clinician') {
      setActiveTab('doctor');
    }
  }

  function handleLogout() {
    clearAuthToken();
    setCurrentUser(null);
    setUserMenuOpen(false);
    setActiveTab('patient');
    setSubmittedIntake(null);
    setShowAuthModal(true);
    setAuthModalMode('login');
  }

  function handleQuickDemoPatient() {
    loginUser('maria.demo@preconsult.ai', 'Demo@123')
      .then((data) => {
        handleAuthSuccess(data.user, data.access_token);
      })
      .catch((err) => {
        setHealth({ status: 'error', detail: null, error: err.message });
      });
  }

  function handleQuickDemoClinician() {
    loginUser('dr.vance@preconsult.ai', 'Demo@123')
      .then((data) => {
        handleAuthSuccess(data.user, data.access_token);
        setClinicianGuardOpen(false);
        setActiveTab('doctor');
      })
      .catch((err) => {
        setHealth({ status: 'error', detail: null, error: err.message });
      });
  }

  function handleTabClick(targetTab) {
    if (targetTab === 'doctor') {
      // Role Guard: Check if user is logged in as a non-clinician patient
      if (currentUser && currentUser.role !== 'clinician') {
        setClinicianGuardOpen(true);
        return;
      }
    }
    setActiveTab(targetTab);
  }

  function handleIntakeFinished(intakeData) {
    setSubmittedIntake(intakeData);
  }

  function handleUpdateRecord(updatedRecord) {
    setSubmittedIntake((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        finalizedRecord: updatedRecord,
      };
    });
  }

  return (
    <div className="app-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header — Reference 3 Healthcare Tablet Inspired */}
      <header className="app-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '1rem 1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Brand Logo & Subtitle */}
          <div className="logo-group" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('patient')}>
            <div className="logo-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'linear-gradient(135deg, #0284c7, #0d9488)', padding: '0.5rem 0.9rem', borderRadius: '12px' }}>
              <span style={{ fontSize: '1.25rem' }}>🩺</span>
              <span style={{ fontWeight: 900, letterSpacing: '0.5px' }}>PRECONSULT</span>
              <span style={{ background: 'rgba(255,255,255,0.25)', padding: '0.15rem 0.4rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>AI</span>
            </div>
            <div>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                Your voice. Your symptoms. A clearer clinical picture.
              </p>
            </div>
          </div>

          {/* Top Right Controls: Auth, Accessibility, Language */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            {/* User Account / Login State */}
            {currentUser ? (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '10px',
                    border: '1.5px solid #0284c7',
                    background: '#f0f9ff',
                    color: '#0284c7',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                  aria-expanded={userMenuOpen}
                >
                  <span>{currentUser.role === 'clinician' ? '👨‍⚕️' : '👤'}</span>
                  <span>{currentUser.name}</span>
                  <span style={{ background: currentUser.role === 'clinician' ? '#dcfce7' : '#e0f2fe', color: currentUser.role === 'clinician' ? '#15803d' : '#0369a1', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                    {currentUser.role.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '0.7rem' }}>▾</span>
                </button>

                {userMenuOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '110%',
                      background: '#ffffff',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                      width: '210px',
                      zIndex: 1000,
                      overflow: 'hidden',
                    }}
                  >
                    {currentUser.role === 'patient' && (
                      <button
                        onClick={() => { setActiveTab('patient_dashboard'); setUserMenuOpen(false); }}
                        style={{ width: '100%', padding: '0.65rem 1rem', border: 'none', background: 'transparent', textAlign: 'left', fontWeight: 700, fontSize: '0.85rem', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                      >
                        📥 My Dashboard
                      </button>
                    )}
                    <button
                      onClick={handleLogout}
                      style={{ width: '100%', padding: '0.65rem 1rem', border: 'none', borderTop: '1px solid #f1f5f9', background: '#fff1f2', textAlign: 'left', fontWeight: 800, fontSize: '0.85rem', color: '#e11d48', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      🚪 Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  onClick={() => { setShowAuthModal(true); setAuthModalMode('login'); }}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '8px',
                    border: '1.5px solid #0284c7',
                    background: '#ffffff',
                    color: '#0284c7',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  🔑 Sign In
                </button>
                <button
                  onClick={handleQuickDemoPatient}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #0284c7, #0d9488)',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(2,132,199,0.2)',
                  }}
                  title="Instant One-Click Login as Demo Patient Maria Gonzalez"
                >
                  ⚡ Demo Patient
                </button>
              </div>
            )}

            {/* Language Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#ffffff', border: '1.5px solid var(--border-color)', borderRadius: '10px', padding: '0.2rem 0.6rem' }}>
              <span style={{ fontSize: '0.95rem' }}>🌐</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  outline: 'none',
                  padding: '0.25rem 0.2rem',
                }}
                aria-label="Select Patient Language"
              >
                <option value="en">English (US)</option>
                <option value="te">తెలుగు (Telugu)</option>
                <option value="hi">हिन्दी (Hindi)</option>
              </select>
            </div>

            {/* Accessibility Drawer Toggle */}
            <button
              onClick={() => setShowA11y(!showA11y)}
              style={{
                minHeight: '36px',
                minWidth: 'auto',
                padding: '0.4rem 0.85rem',
                fontSize: '0.82rem',
                background: showA11y ? '#e0f2fe' : '#ffffff',
                borderColor: showA11y ? '#38bdf8' : 'var(--border-color)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
              title="Toggle Accessibility Settings"
            >
              ♿ Accessibility
            </button>
          </div>
        </div>

        {/* Segmented Navigation Tabs */}
        <nav className="nav-links" style={{ width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {currentUser?.role === 'patient' && (
            <button
              className={`nav-btn ${activeTab === 'patient_dashboard' ? 'active' : ''}`}
              onClick={() => handleTabClick('patient_dashboard')}
              style={{ borderRadius: '10px', fontSize: '0.9rem', fontWeight: 800 }}
            >
              📊 Patient Portal
            </button>
          )}
          <button
            className={`nav-btn ${activeTab === 'patient' ? 'active' : ''}`}
            onClick={() => handleTabClick('patient')}
            style={{ borderRadius: '10px', fontSize: '0.9rem', fontWeight: 800 }}
          >
            🧏 1. Patient Intake & 3D Body
          </button>
          <button
            className={`nav-btn ${activeTab === 'scanner' ? 'active' : ''}`}
            onClick={() => handleTabClick('scanner')}
            style={{ borderRadius: '10px', fontSize: '0.9rem', fontWeight: 800 }}
          >
            📷 2. Rx & Lab Scanner
          </button>
          <button
            className={`nav-btn ${activeTab === 'doctor' ? 'active' : ''}`}
            onClick={() => handleTabClick('doctor')}
            style={{ borderRadius: '10px', fontSize: '0.9rem', fontWeight: 800 }}
          >
            🩺 3. Clinician Command Center
          </button>
          <button
            className={`nav-btn ${activeTab === 'status' ? 'active' : ''}`}
            onClick={() => handleTabClick('status')}
            style={{ borderRadius: '10px', fontSize: '0.85rem', marginLeft: 'auto' }}
          >
            ⚙️ System Diagnostics
          </button>
        </nav>
      </header>

      {/* Persistent Accessibility Preferences Bar (when toggled or active) */}
      {showA11y && (
        <AccessibilityBar
          theme={theme}
          setTheme={setTheme}
          reducedMotion={reducedMotion}
          setReducedMotion={setReducedMotion}
          textScale={textScale}
          setTextScale={setTextScale}
          motorMode={motorMode}
          setMotorMode={setMotorMode}
          audioEnabled={audioEnabled}
          setAudioEnabled={setAudioEnabled}
        />
      )}

      {/* Backend Status Banner (Live Real-Time Indicator) */}
      <div className={`status-banner ${health.status}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <strong>System Status: </strong>
          {health.status === 'healthy' && (
            <span style={{ color: '#15803d', fontWeight: 700 }}>
              Connected (FastAPI v{health.detail?.version || '1.0.0'} &bull; Database: {health.detail?.database === 'connected' ? 'PostgreSQL (Connected)' : (health.detail?.database || 'Connected')} &bull; AI Mode: {health.detail?.ai_mode || 'Active'})
            </span>
          )}
          {health.status === 'connecting' && (
            <span style={{ color: '#0284c7', fontWeight: 600 }}>
              Connecting to Backend... (Warming up cloud service, attempt {healthAttempt.current}/{healthAttempt.max})
            </span>
          )}
          {health.status === 'error' && (
            <span style={{ color: '#dc2626', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              Backend Unavailable ({health.error || 'Connection Timeout'})
              <button
                onClick={init}
                style={{
                  minHeight: '28px',
                  minWidth: 'auto',
                  padding: '0.2rem 0.6rem',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                🔄 Retry Connection
              </button>
            </span>
          )}
        </div>
        {activeSession && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Session: <strong>{activeSession.session_id}</strong>
          </span>
        )}
      </div>

      {/* ROLE GUARD MODAL: Shown when non-clinician tries to access doctor tab */}
      {clinicianGuardOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setClinicianGuardOpen(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '1.75rem',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '2.5rem' }}>🔒</span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '0.5rem 0' }}>
                Clinician Authorization Required
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0 }}>
                You are currently signed in as <strong>{currentUser?.name}</strong> (Patient). Access to the Attending Physician Command Suite is restricted to licensed medical personnel.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={handleQuickDemoClinician}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #15803d, #16a34a)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                🩺 Switch to Demo Clinician (Dr. Sarah Vance, MD)
              </button>
              <button
                onClick={() => setClinicianGuardOpen(false)}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                }}
              >
                Return to Patient Portal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTH MODAL (Login / Register) */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={handleAuthSuccess}
        initialMode={authModalMode}
      />

      {/* VIEW: Patient Home Dashboard (When logged in) */}
      {activeTab === 'patient_dashboard' && currentUser && (
        <PatientDashboard
          user={currentUser}
          onStartIntake={() => setActiveTab('patient')}
          onOpenScanner={() => setActiveTab('scanner')}
          onUpdateUser={(updated) => setCurrentUser(updated)}
        />
      )}

      {/* MAIN VIEW 1: Patient-Facing Intake Experience */}
      <div style={{ display: activeTab === 'patient' ? 'block' : 'none' }}>
        <IntakeWizard
          activeSession={activeSession}
          currentUser={currentUser}
          language={language}
          setLanguage={setLanguage}
          theme={theme}
          setTheme={setTheme}
          reducedMotion={reducedMotion}
          setReducedMotion={setReducedMotion}
          textScale={textScale}
          setTextScale={setTextScale}
          motorMode={motorMode}
          setMotorMode={setMotorMode}
          audioEnabled={audioEnabled}
          setAudioEnabled={setAudioEnabled}
          onFinishIntake={handleIntakeFinished}
          onNavigateToDoctor={() => handleTabClick('doctor')}
        />
      </div>

      {/* MAIN VIEW 2: Prescription & Lab Document Ingestion Scanner */}
      <div style={{ display: activeTab === 'scanner' ? 'block' : 'none' }}>
        <DocumentScanner
          activeSession={activeSession}
          currentUser={currentUser}
          onNavigateToDoctor={() => handleTabClick('doctor')}
          theme={theme}
        />
      </div>

      {/* MAIN VIEW 3: Doctor 60-Second Briefing Dashboard */}
      <div style={{ display: activeTab === 'doctor' ? 'block' : 'none' }}>
        <ClinicianDashboard
          activeSession={activeSession}
          submittedIntake={submittedIntake}
          currentUser={currentUser}
          theme={theme}
          onUpdateRecord={handleUpdateRecord}
          onNavigateToScanner={() => setActiveTab('scanner')}
          onNavigateToIntake={() => setActiveTab('patient')}
        />
      </div>

      {/* MAIN VIEW 4: System Status & Diagnostic Overview */}
      <div style={{ display: activeTab === 'status' ? 'block' : 'none' }}>
        <SystemDiagnostics activeSession={activeSession} />
      </div>

      {/* Footer */}
      <footer style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 'auto', padding: '1rem 0' }}>
        PreConsult AI &bull; Healthcare Accessibility Solution &bull; Voice when you can speak. Touch when you can't.
      </footer>
    </div>
  );
}
