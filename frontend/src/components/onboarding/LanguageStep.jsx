import React from 'react';

export const LANGUAGES = [
  { id: 'en', label: 'English', native: 'English', flag: '🇬🇧', greeting: 'Hello and welcome. Please select your language to begin.' },
  { id: 'es', label: 'Español', native: 'Spanish', flag: '🇪🇸', greeting: 'Hola y bienvenido. Por favor seleccione su idioma para comenzar.' },
  { id: 'hi', label: 'हिन्दी', native: 'Hindi', flag: '🇮🇳', greeting: 'नमस्ते। कृपया आगे बढ़ने के लिए अपनी भाषा चुनें।' },
  { id: 'te', label: 'తెలుగు', native: 'Telugu', flag: '🇮🇳', greeting: 'నమస్కారం. దయచేసి ప్రారంభించడానికి మీ భాషను ఎంచుకోండి.' },
];

export default function LanguageStep({ selectedLang, onSelectLang, onNext, audioEnabled }) {
  function handleSelect(langId) {
    onSelectLang(langId);
    if (audioEnabled && 'speechSynthesis' in window) {
      const selected = LANGUAGES.find((l) => l.id === langId);
      if (selected) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(selected.greeting);
        utterance.lang = langId === 'es' ? 'es-ES' : langId === 'hi' ? 'hi-IN' : langId === 'te' ? 'te-IN' : 'en-US';
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
      }
    }
  }

  function handlePlayAudioGreeting() {
    if ('speechSynthesis' in window) {
      const selected = LANGUAGES.find((l) => l.id === selectedLang) || LANGUAGES[0];
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(selected.greeting);
      utterance.lang = selected.id === 'es' ? 'es-ES' : selected.id === 'hi' ? 'hi-IN' : selected.id === 'te' ? 'te-IN' : 'en-US';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 className="card-title" style={{ color: 'var(--accent-cyan)', marginBottom: '0.25rem' }}>
            🌐 Select Your Language / अपनी भाषा चुनें
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Choose the language you feel most comfortable reading and communicating with:
          </p>
        </div>

        <button
          onClick={handlePlayAudioGreeting}
          className="secondary"
          style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
          title="Play voice greeting in the selected language"
          aria-label="Listen to audio greeting"
        >
          🔊 Listen Greeting
        </button>
      </div>

      {/* Large Language Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          margin: '0.5rem 0',
        }}
        role="group"
        aria-label="Language selection"
      >
        {LANGUAGES.map((l) => {
          const isSelected = selectedLang === l.id;
          return (
            <button
              key={l.id}
              className={isSelected ? 'primary' : 'secondary'}
              onClick={() => handleSelect(l.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1.5rem 1rem',
                minHeight: '130px',
                borderRadius: '16px',
                borderWidth: '2px',
                textAlign: 'center',
                boxShadow: isSelected ? '0 0 20px rgba(6, 182, 212, 0.4)' : 'none',
              }}
              aria-pressed={isSelected}
            >
              <span style={{ fontSize: '2.5rem', marginBottom: '0.4rem', lineHeight: 1 }}>
                {l.flag}
              </span>
              <span style={{ fontWeight: '800', fontSize: '1.25rem', color: isSelected ? '#ffffff' : 'var(--text-primary)' }}>
                {l.label}
              </span>
              <span style={{ fontSize: '0.9rem', color: isSelected ? 'rgba(255,255,255,0.9)' : 'var(--text-muted)' }}>
                {l.native}
              </span>
              {isSelected && (
                <span
                  style={{
                    marginTop: '0.5rem',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    background: 'rgba(0, 0, 0, 0.3)',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                  }}
                >
                  ✓ Selected
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="action-bar">
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Step 1 of 7 &bull; Language can also be changed anytime
        </span>
        <button
          className="primary"
          onClick={onNext}
          style={{ padding: '0.85rem 2.25rem', fontSize: '1.05rem', fontWeight: '800' }}
        >
          Continue to Accessibility Preferences &rarr;
        </button>
      </div>
    </div>
  );
}
