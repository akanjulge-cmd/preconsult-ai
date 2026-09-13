import React, { useState, useEffect } from 'react';
import AccessibilityBar from './components/common/AccessibilityBar';
import IntakeWizard from './components/intake/IntakeWizard';
import ClinicianDashboard from './components/doctor/ClinicianDashboard';
import DocumentScanner from './components/documents/DocumentScanner';
import { checkHealth, createSession, checkSafety, BACKEND_URL } from './services/api';


export default function App() {
  const [activeTab, setActiveTab] = useState('patient'); // Default directly to 'patient' experience!
  const [theme, setTheme] = useState('standard');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [textScale, setTextScale] = useState('standard');
  const [motorMode, setMotorMode] = useState('standard');
  const [audioEnabled, setAudioEnabled] = useState(false);

  const [health, setHealth] = useState({ status: 'connecting', detail: null });
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
  useEffect(() => {
    async function init() {
      try {
        const data = await checkHealth();
        setHealth({ status: 'healthy', detail: data });
        // Create initial session for patient
        const sess = await createSession({ preferredLanguage: language, accessibilityMode: 'standard' });
        setActiveSession(sess);
      } catch (err) {
        setHealth({ status: 'error', detail: null });
        // Offline fallback session for hackathon demo
        setActiveSession({
          session_id: 'SES-DEMO-01',
          created_at: new Date().toISOString(),
          status: 'active',
          preferred_language: language,
          accessibility_mode: 'standard',
        });
      }
    }
    init();
  }, [language]);

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

      {/* Backend Status Banner (Subtle indicator) */}
      <div className={`status-banner ${health.status}`}>
        <div>
          <strong>System Status: </strong>
          {health.status === 'healthy' && (
            <span>
              Connected (FastAPI v{health.detail?.version} &bull; SQLite: Active &bull; AI Mode: {health.detail?.ai_mode})
            </span>
          )}
          {health.status === 'connecting' && <span>Connecting to Backend...</span>}
          {health.status === 'error' && (
            <span>Operating in Resilient Offline Demo Mode (Backend unavailable, mock data active)</span>
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
        <div className="card">
          <h2 className="card-title">⚙️ Architecture & Diagnostic Overview</h2>
          <div className="grid-2">
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1rem', borderRadius: '10px' }}>
              <h3 style={{ fontSize: '1rem', color: 'var(--accent-cyan)', marginBottom: '0.5rem' }}>
                Backend Connectivity
              </h3>
              <ul style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', listStylePosition: 'inside', lineHeight: '1.6' }}>
                <li>Host: <code>{BACKEND_URL || 'Direct Origin / Proxy'}</code></li>
                <li>Database: {health.detail?.database_connected ? 'Connected' : 'Mock/Offline'}</li>
                <li>API Prefix: <code>/api/v1</code></li>
                <li>Active Session: {activeSession?.session_id || 'None'}</li>
              </ul>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1rem', borderRadius: '10px' }}>
              <h3 style={{ fontSize: '1rem', color: 'var(--accent-emerald)', marginBottom: '0.5rem' }}>
                Accessibility Capabilities
              </h3>
              <ul style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', listStylePosition: 'inside', lineHeight: '1.6' }}>
                <li>Non-Speaking AAC Mode: Touch-only visual semantics</li>
                <li>Tremor Motor Assistance: Large touch targets (&ge; 68px)</li>
                <li>High-Contrast Mode: WCAG AAA compliance (#000/#fff/#ffff00)</li>
                <li>Reduced Motion: Animated SVG fallbacks</li>
                <li>Audio Guidance: Web Speech API text-to-speech</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 'auto', padding: '1rem 0' }}>
        PreConsult AI &bull; Healthcare Accessibility Solution &bull; Voice when you can speak. Touch when you can't.
      </footer>
    </div>
  );
}
