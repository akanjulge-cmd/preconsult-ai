import React, { useState, useEffect, useCallback } from 'react';
import AccessibilityBar from './components/common/AccessibilityBar';
import IntakeWizard from './components/intake/IntakeWizard';
import ClinicianDashboard from './components/doctor/ClinicianDashboard';
import DocumentScanner from './components/documents/DocumentScanner';
import SystemDiagnostics from './components/common/SystemDiagnostics';
import { checkHealth, createSession, checkSafety, BACKEND_URL, IS_DEMO_MODE } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('patient'); // Default directly to 'patient' experience!
  const [theme, setTheme] = useState('standard');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [textScale, setTextScale] = useState('standard');
  const [motorMode, setMotorMode] = useState('standard');
  const [audioEnabled, setAudioEnabled] = useState(false);

  const [health, setHealth] = useState({ status: 'connecting', detail: null, error: null });
  const [activeSession, setActiveSession] = useState(null);
  const [submittedIntake, setSubmittedIntake] = useState(null);
  const [error, setError] = useState(null);

  const [language, setLanguage] = useState('en'); // 'en' | 'te' | 'hi'
  const [showA11y, setShowA11y] = useState(false);

  // Apply accessibility attributes to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-reduced-motion', reducedMotion ? 'true' : 'false');
    document.documentElement.setAttribute('data-text-scale', textScale);
    document.documentElement.setAttribute('data-motor-mode', motorMode);
  }, [theme, reducedMotion, textScale, motorMode]);

  // Check backend health and auto-create default session
  const init = useCallback(async () => {
    setHealth({ status: 'connecting', detail: null, error: null });
    try {
      const data = await checkHealth(3, 1500);
      setHealth({ status: 'healthy', detail: data, error: null });
      // Create initial session for patient
      const sess = await createSession({ preferredLanguage: language, accessibilityMode: 'standard' });
      setActiveSession(sess);
    } catch (err) {
      setHealth({ status: 'error', detail: null, error: err.message || 'Connection failed' });
      if (IS_DEMO_MODE) {
        // Explicit demo fallback session only when DEMO_MODE=true
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
  }, [language]);

  useEffect(() => {
    init();
  }, [init]);

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
    <div className="app-container">
      {/* Header — Reference 3 Healthcare Tablet Inspired */}
      <header className="app-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '1rem 1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Brand Logo & Subtitle */}
          <div className="logo-group">
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

          {/* Top Right Controls: Patient Mode, Accessibility, Language */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Mode Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.85rem',
              background: activeTab === 'patient' ? '#eff6ff' : '#f0fdf4',
              border: `1.5px solid ${activeTab === 'patient' ? '#bfdbfe' : '#bbf7d0'}`,
              borderRadius: '9999px',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: activeTab === 'patient' ? '#0284c7' : '#15803d'
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeTab === 'patient' ? '#0284c7' : '#16a34a' }}></span>
              {activeTab === 'patient' ? 'Patient Intake Mode' : activeTab === 'doctor' ? 'Clinician Command Mode' : 'Diagnostic Mode'}
            </div>

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
                  padding: '0.25rem 0.2rem'
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
                minHeight: '40px',
                minWidth: 'auto',
                padding: '0.4rem 0.85rem',
                fontSize: '0.82rem',
                background: showA11y ? '#e0f2fe' : '#ffffff',
                borderColor: showA11y ? '#38bdf8' : 'var(--border-color)',
                color: 'var(--text-secondary)'
              }}
              title="Toggle Accessibility Settings"
            >
              ♿ Accessibility
            </button>
          </div>
        </div>

        {/* Segmented Navigation Tabs */}
        <nav className="nav-links" style={{ width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
          <button
            className={`nav-btn ${activeTab === 'patient' ? 'active' : ''}`}
            onClick={() => setActiveTab('patient')}
            style={{ borderRadius: '10px', fontSize: '0.9rem' }}
          >
            🧏 1. Patient Intake & 3D Body
          </button>
          <button
            className={`nav-btn ${activeTab === 'scanner' ? 'active' : ''}`}
            onClick={() => setActiveTab('scanner')}
            style={{ borderRadius: '10px', fontSize: '0.9rem' }}
          >
            📷 2. Rx & Lab Scanner
          </button>
          <button
            className={`nav-btn ${activeTab === 'doctor' ? 'active' : ''}`}
            onClick={() => setActiveTab('doctor')}
            style={{ borderRadius: '10px', fontSize: '0.9rem' }}
          >
            🩺 3. Clinician Command Center
          </button>
          <button
            className={`nav-btn ${activeTab === 'status' ? 'active' : ''}`}
            onClick={() => setActiveTab('status')}
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
              Connected (FastAPI v{health.detail?.version || '1.0.0'} &bull; Database: {health.detail?.database_engine === 'postgresql' ? 'PostgreSQL (Connected)' : (health.detail?.database || 'Connected')} &bull; AI Mode: {health.detail?.ai_mode || 'Active'})
            </span>
          )}
          {health.status === 'connecting' && (
            <span style={{ color: '#0284c7', fontWeight: 600 }}>
              Connecting to Backend... (Warming up cloud service)
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
                  cursor: 'pointer'
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

      {/* MAIN VIEW 1: Patient-Facing Intake Experience */}
      <div style={{ display: activeTab === 'patient' ? 'block' : 'none' }}>
        <IntakeWizard
          activeSession={activeSession}
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
          onNavigateToDoctor={() => setActiveTab('doctor')}
        />
      </div>

      {/* MAIN VIEW 2: Prescription & Lab Document Ingestion Scanner */}
      <div style={{ display: activeTab === 'scanner' ? 'block' : 'none' }}>
        <DocumentScanner
          activeSession={activeSession}
          onNavigateToDoctor={() => setActiveTab('doctor')}
          theme={theme}
        />
      </div>

      {/* MAIN VIEW 3: Doctor 60-Second Briefing Dashboard */}
      <div style={{ display: activeTab === 'doctor' ? 'block' : 'none' }}>
        <ClinicianDashboard
          activeSession={activeSession}
          submittedIntake={submittedIntake}
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
