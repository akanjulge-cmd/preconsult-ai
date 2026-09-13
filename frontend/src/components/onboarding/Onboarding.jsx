import React from 'react';

const LANGUAGES = [
  { id: 'en', label: 'English', native: 'English', flag: '🇬🇧' },
  { id: 'es', label: 'Español', native: 'Spanish', flag: '🇪🇸' },
  { id: 'hi', label: 'हिन्दी', native: 'Hindi', flag: '🇮🇳' },
  { id: 'te', label: 'తెలుగు', native: 'Telugu', flag: '🇮🇳' },
];

const MODES = [
  {
    id: 'non_speaking',
    title: 'Non-Speaking / AAC Mode',
    desc: 'Touch and visual semantic choices only. No typing or talking required.',
    icon: '🧏‍♂️',
    recommended: true,
  },
  {
    id: 'tremor',
    title: 'Motor / Tremor Assistance',
    desc: 'Extra-large touch targets (68px) and forgiveness padding for hand tremors.',
    icon: '🎯',
    recommended: false,
  },
  {
    id: 'standard',
    title: 'Standard Touch Mode',
    desc: 'Full touch and visual interface for standard smartphones or tablets.',
    icon: '📱',
    recommended: false,
  },
];

export default function Onboarding({
  selectedLang,
  onSelectLang,
  selectedMode,
  onSelectMode,
  onConfirmConsent,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 1. Language Selection */}
      <div>
        <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
          1. Select Your Language / भाषा चुनें
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.85rem' }}>
          Choose the language you are most comfortable using:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
          {LANGUAGES.map((l) => (
            <button
              key={l.id}
              className={selectedLang === l.id ? 'primary' : 'secondary'}
              onClick={() => onSelectLang(l.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '1rem',
                borderRadius: '12px',
                textAlign: 'center',
              }}
              aria-pressed={selectedLang === l.id}
            >
              <span style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>{l.flag}</span>
              <span style={{ fontWeight: '800', fontSize: '1.05rem' }}>{l.label}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{l.native}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Accessibility / Interaction Mode */}
      <div>
        <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
          2. How would you like to communicate?
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.85rem' }}>
          Select the mode that matches your physical and communication preferences:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {MODES.map((m) => {
            const isSelected = selectedMode === m.id;
            return (
              <div
                key={m.id}
                onClick={() => onSelectMode(m.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1.1rem 1.4rem',
                  borderRadius: '14px',
                  border: `2px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-color)'}`,
                  background: isSelected ? 'rgba(6, 182, 212, 0.15)' : 'var(--bg-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? '0 0 16px rgba(6, 182, 212, 0.25)' : 'none',
                }}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
              >
                <span style={{ fontSize: '2.2rem' }}>{m.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: '800', color: isSelected ? '#fff' : 'var(--text-primary)' }}>
                      {m.title}
                    </h4>
                    {m.recommended && (
                      <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', borderRadius: '6px', fontWeight: '700' }}>
                        ★ Recommended for Hackathon Demo
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    {m.desc}
                  </p>
                </div>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: `2px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-color)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isSelected && <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent-cyan)' }}></div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Consent & Privacy Card */}
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '1.25rem',
        }}
      >
        <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--accent-emerald)', marginBottom: '0.4rem' }}>
          🛡️ Privacy & Medical Assistance Notice
        </h4>
        <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '1.25rem', lineHeight: '1.6' }}>
          <li>Your responses create a structured draft for your doctor to review before your consultation.</li>
          <li>PreConsult AI does not make autonomous diagnoses or prescribe treatment.</li>
          <li>Your health details are encrypted and handled confidentially.</li>
        </ul>

        <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="primary"
            onClick={onConfirmConsent}
            style={{ fontSize: '1.05rem', padding: '0.85rem 2rem', fontWeight: '800' }}
          >
            I Agree &rarr; Start Intake
          </button>
        </div>
      </div>
    </div>
  );
}
