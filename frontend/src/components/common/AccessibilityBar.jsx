import React from 'react';

export default function AccessibilityBar({
  theme,
  setTheme,
  reducedMotion,
  setReducedMotion,
  textScale,
  setTextScale,
  motorMode,
  setMotorMode,
  audioEnabled,
  setAudioEnabled,
}) {
  function handleToggleAudio() {
    const next = !audioEnabled;
    setAudioEnabled(next);
    if (next && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance('Audio guidance enabled. Questions and selections will be read aloud.');
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }

  return (
    <nav
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.6rem',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1.25rem',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '14px',
      }}
      role="region"
      aria-label="Patient Accessibility Toolbar"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.1rem' }}>♿</span>
        <span style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--accent-cyan)' }}>
          Accessibility Toolbar:
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        {/* High Contrast Toggle */}
        <button
          onClick={() => setTheme(theme === 'standard' ? 'high-contrast' : 'standard')}
          className={theme === 'high-contrast' ? 'primary' : 'secondary'}
          style={{ padding: '0.4rem 0.85rem', minHeight: '40px', fontSize: '0.85rem' }}
          aria-pressed={theme === 'high-contrast'}
          title="Toggle high contrast black and yellow/white theme (WCAG AAA)"
        >
          {theme === 'high-contrast' ? '☀️ High Contrast: ON' : '👁️ High Contrast'}
        </button>

        {/* Reduced Motion Toggle */}
        <button
          onClick={() => setReducedMotion(!reducedMotion)}
          className={reducedMotion ? 'primary' : 'secondary'}
          style={{ padding: '0.4rem 0.85rem', minHeight: '40px', fontSize: '0.85rem' }}
          aria-pressed={reducedMotion}
          title="Disable animations and continuous motion"
        >
          {reducedMotion ? '⏸️ Motion: OFF (Static)' : '⚡ Motion: ON'}
        </button>

        {/* Motor / Tremor Large Target Toggle */}
        <button
          onClick={() => setMotorMode(motorMode === 'standard' ? 'tremor' : 'standard')}
          className={motorMode === 'tremor' ? 'primary' : 'secondary'}
          style={{ padding: '0.4rem 0.85rem', minHeight: '40px', fontSize: '0.85rem' }}
          aria-pressed={motorMode === 'tremor'}
          title="Enlarge all interactive controls to >=68px for tremor/motor assistance"
        >
          {motorMode === 'tremor' ? '🎯 Large Targets: 68px' : '🎯 Target Size'}
        </button>

        {/* Text Size Cycler */}
        <button
          onClick={() => {
            if (textScale === 'standard') setTextScale('large');
            else if (textScale === 'large') setTextScale('xlarge');
            else setTextScale('standard');
          }}
          className={textScale !== 'standard' ? 'primary' : 'secondary'}
          style={{ padding: '0.4rem 0.85rem', minHeight: '40px', fontSize: '0.85rem' }}
          title="Cycle through text font sizes (Standard -> Large -> Extra Large)"
          aria-label={`Text size: currently ${textScale}`}
        >
          Aa Text: {textScale.toUpperCase()}
        </button>

        {/* Audio TTS Read-Aloud Toggle */}
        <button
          onClick={handleToggleAudio}
          className={audioEnabled ? 'primary' : 'secondary'}
          style={{ padding: '0.4rem 0.85rem', minHeight: '40px', fontSize: '0.85rem' }}
          aria-pressed={audioEnabled}
          title="Enable speech synthesizer to read questions aloud"
        >
          {audioEnabled ? '🔊 Audio Guide: ON' : '🔇 Audio Guide: OFF'}
        </button>
      </div>
    </nav>
  );
}
