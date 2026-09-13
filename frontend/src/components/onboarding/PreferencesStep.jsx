import React from 'react';

const INTERACTION_MODES = [
  {
    id: 'non_speaking',
    title: 'Non-Speaking / AAC Mode',
    desc: 'Touch-only visual semantic cards. Zero speech or typing required.',
    icon: '🧏',
    badge: '★ Recommended for Clinical Intake',
  },
  {
    id: 'tremor',
    title: 'Motor & Tremor Assistance',
    desc: 'Enlarged touch targets (>=68px), generous hit padding, and tap forgiveness.',
    icon: '🎯',
    badge: 'Assistive Spacing',
  },
  {
    id: 'standard',
    title: 'Standard Touch Mode',
    desc: 'Standard responsive touchscreen interface for phone, tablet, or kiosk.',
    icon: '📱',
    badge: 'Standard UI',
  },
];

export default function PreferencesStep({
  selectedMode,
  onSelectMode,
  theme,
  setTheme,
  reducedMotion,
  setReducedMotion,
  textScale,
  setTextScale,
  audioEnabled,
  setAudioEnabled,
  onBack,
  onNext,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <div>
        <h2 className="card-title" style={{ color: 'var(--accent-cyan)', marginBottom: '0.25rem' }}>
          ♿ Step 2: Accessibility Preferences
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Personalize your interaction settings to ensure maximum comfort and clarity:
        </p>
      </div>

      {/* Part 1: Interaction Mode */}
      <div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
          1. Interaction Mode
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {INTERACTION_MODES.map((m) => {
            const isSelected = selectedMode === m.id;
            return (
              <div
                key={m.id}
                onClick={() => onSelectMode(m.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.25rem',
                  padding: '1.1rem 1.4rem',
                  borderRadius: '16px',
                  border: `2px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-color)'}`,
                  background: isSelected ? 'rgba(6, 182, 212, 0.15)' : 'var(--bg-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? '0 0 20px rgba(6, 182, 212, 0.25)' : 'none',
                }}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
              >
                <span style={{ fontSize: '2.5rem', lineHeight: 1 }}>{m.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <h4 style={{ fontSize: '1.15rem', fontWeight: '800', color: isSelected ? '#ffffff' : 'var(--text-primary)' }}>
                      {m.title}
                    </h4>
                    {m.badge && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.6rem',
                          background: isSelected ? 'rgba(6, 182, 212, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                          color: isSelected ? '#38bdf8' : 'var(--text-secondary)',
                          borderRadius: '999px',
                          fontWeight: '700',
                        }}
                      >
                        {m.badge}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    {m.desc}
                  </p>
                </div>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    border: `2px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-color)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {isSelected && (
                    <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'var(--accent-cyan)' }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Part 2: Visual & Audio Controls */}
      <div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
          2. Visual & Audio Controls
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
          }}
        >
          {/* High Contrast Option */}
          <div
            onClick={() => setTheme(theme === 'standard' ? 'high-contrast' : 'standard')}
            style={{
              padding: '1.1rem',
              borderRadius: '14px',
              border: `2px solid ${theme === 'high-contrast' ? 'var(--accent-amber)' : 'var(--border-color)'}`,
              background: theme === 'high-contrast' ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            role="button"
            tabIndex={0}
            aria-pressed={theme === 'high-contrast'}
          >
            <div>
              <div style={{ fontWeight: '800', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                ☀️ High Contrast Option
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                WCAG AAA pure black/yellow contrast for low vision
              </p>
            </div>
            <span style={{ fontSize: '1.5rem' }}>{theme === 'high-contrast' ? '✅' : '⚪'}</span>
          </div>

          {/* Reduced Motion Option */}
          <div
            onClick={() => setReducedMotion(!reducedMotion)}
            style={{
              padding: '1.1rem',
              borderRadius: '14px',
              border: `2px solid ${reducedMotion ? 'var(--accent-cyan)' : 'var(--border-color)'}`,
              background: reducedMotion ? 'rgba(6, 182, 212, 0.15)' : 'var(--bg-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            role="button"
            tabIndex={0}
            aria-pressed={reducedMotion}
          >
            <div>
              <div style={{ fontWeight: '800', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                ⏸️ Reduced Motion Option
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Replaces animations with static high-contrast badges
              </p>
            </div>
            <span style={{ fontSize: '1.5rem' }}>{reducedMotion ? '✅' : '⚪'}</span>
          </div>

          {/* Text Scaling */}
          <div
            onClick={() => {
              if (textScale === 'standard') setTextScale('large');
              else if (textScale === 'large') setTextScale('xlarge');
              else setTextScale('standard');
            }}
            style={{
              padding: '1.1rem',
              borderRadius: '14px',
              border: `2px solid ${textScale !== 'standard' ? 'var(--accent-emerald)' : 'var(--border-color)'}`,
              background: textScale !== 'standard' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            role="button"
            tabIndex={0}
          >
            <div>
              <div style={{ fontWeight: '800', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                🔍 Text Scale ({textScale.toUpperCase()})
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Standard (16px) &bull; Large (19px) &bull; Extra Large (22px)
              </p>
            </div>
            <span style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--accent-emerald)' }}>
              Aa+
            </span>
          </div>

          {/* Audio Guidance */}
          <div
            onClick={() => setAudioEnabled(!audioEnabled)}
            style={{
              padding: '1.1rem',
              borderRadius: '14px',
              border: `2px solid ${audioEnabled ? 'var(--accent-purple)' : 'var(--border-color)'}`,
              background: audioEnabled ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            role="button"
            tabIndex={0}
            aria-pressed={audioEnabled}
          >
            <div>
              <div style={{ fontWeight: '800', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                🔊 Audio Guidance (TTS)
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Reads questions & choices aloud via browser speech
              </p>
            </div>
            <span style={{ fontSize: '1.5rem' }}>{audioEnabled ? '✅' : '⚪'}</span>
          </div>
        </div>
      </div>

      <div className="action-bar">
        <button className="secondary" onClick={onBack}>
          &larr; Back to Language
        </button>
        <button
          className="primary"
          onClick={onNext}
          style={{ padding: '0.85rem 2.25rem', fontSize: '1.05rem', fontWeight: '800' }}
        >
          Confirm Preferences & Continue &rarr;
        </button>
      </div>
    </div>
  );
}
