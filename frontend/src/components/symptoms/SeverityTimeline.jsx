import React from 'react';

export const DURATION_OPTIONS = [
  { id: 'today', label: 'Just Today', hint: '< 24 hours ago' },
  { id: '2-3days', label: '2 to 3 Days', hint: 'Started a few days ago' },
  { id: '1week', label: '1+ Week', hint: 'Persisting over 7 days' },
  { id: 'chronic', label: 'Chronic / Recurring', hint: 'Comes & goes for weeks/months' },
];

export const ASSOCIATED_SYMPTOMS = [
  { id: 'nausea', label: '🤢 Nausea / Queasiness' },
  { id: 'fever', label: '🌡️ Fever / Warmth' },
  { id: 'dizziness', label: '💫 Dizziness / Unsteadiness' },
  { id: 'shortness_of_breath', label: '🫁 Shortness of Breath' },
  { id: 'sweating', label: '💦 Heavy Sweating / Clamminess' },
  { id: 'radiating', label: '⚡ Spreading / Radiating Discomfort' },
];

export default function SeverityTimeline({
  severity,
  onSelectSeverity,
  duration,
  onSelectDuration,
  associatedSymptoms = [],
  onToggleAssociatedSymptom,
  reducedMotion = false,
  audioEnabled = false,
}) {
  function getSeverityLabel(val) {
    if (val <= 3) {
      return {
        tier: 'mild',
        level: 'Mild Discomfort',
        desc: 'Noticeable physical sensation, fully manageable without restricting motion.',
        color: 'var(--accent-cyan)',
      };
    }
    if (val <= 6) {
      return {
        tier: 'moderate',
        level: 'Moderate Discomfort',
        desc: 'Sensory presence interferes with usual concentration, tasks, or physical movement.',
        color: 'var(--accent-amber)',
      };
    }
    if (val <= 8) {
      return {
        tier: 'severe',
        level: 'Severe Discomfort',
        desc: 'Intense physical discomfort, significantly limiting mobility, focus, and rest.',
        color: '#fb7185',
      };
    }
    return {
      tier: 'extreme',
      level: 'Extreme / Critical Intensity',
      desc: 'Peak sensory intensity requiring urgent clinical attention and pain relief.',
      color: 'var(--accent-rose)',
    };
  }

  const currentLevel = getSeverityLabel(severity);

  function handleSliderChange(e) {
    const val = parseInt(e.target.value, 10);
    onSelectSeverity(val);
    if (audioEnabled && 'speechSynthesis' in window && (val === 1 || val === 5 || val === 7 || val === 10)) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(`Severity ${val} out of 10. ${getSeverityLabel(val).level}`);
      utterance.rate = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <div>
        <h2 className="card-title" style={{ color: 'var(--accent-cyan)', marginBottom: '0.25rem' }}>
          📊 Step 6: Visual Severity Scale &amp; Timeline
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Indicate the intensity and timeline of your sensation (stores structured attributes only):
        </p>
      </div>

      {/* 1. Dynamic Tactile Severity Meter */}
      <div className="severity-container" role="region" aria-label="Pain severity rating">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              1. Sensation Severity Intensity (1 to 10)
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Tactile scale &bull; Structured Tier: <strong style={{ color: currentLevel.color }}>{currentLevel.tier.toUpperCase()}</strong>
            </span>
          </div>

          <div
            style={{
              fontSize: '1.4rem',
              fontWeight: '900',
              padding: '0.4rem 1.25rem',
              borderRadius: '12px',
              background: 'var(--bg-secondary)',
              border: `2px solid ${currentLevel.color}`,
              color: currentLevel.color,
              boxShadow: severity >= 7 ? '0 0 20px rgba(244, 63, 94, 0.4)' : 'none',
            }}
          >
            {severity} / 10 &bull; {currentLevel.level}
          </div>
        </div>

        <p style={{ fontSize: '0.95rem', fontWeight: '600', color: currentLevel.color }}>
          {currentLevel.desc}
        </p>

        {/* Color Gradient Track */}
        <div className="severity-meter" />

        {/* Tactile Range Input with Large Touch Thumb */}
        <input
          type="range"
          min="1"
          max="10"
          value={severity}
          onChange={handleSliderChange}
          className={`severity-slider ${severity >= 7 && !reducedMotion ? 'severity-slider-severe' : ''}`}
          aria-label={`Sensation severity from 1 to 10. Currently ${severity}`}
          aria-valuemin="1"
          aria-valuemax="10"
          aria-valuenow={severity}
        />

        <div className="severity-labels">
          <span>1: Mild</span>
          <span>4: Moderate</span>
          <span>7: Severe</span>
          <span>10: Critical Peak</span>
        </div>

        {/* Clinical Attribute Meta Pill */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          <span className="clinical-attribute-pill">
            <strong>Attribute:</strong> severity_score = {severity}
          </span>
          <span className="clinical-attribute-pill">
            <strong>Tier:</strong> {currentLevel.tier}
          </span>
          <span className="clinical-attribute-pill" style={{ color: 'var(--accent-cyan)' }}>
            ✓ Real-time Tactile Input Confirmed
          </span>
        </div>
      </div>

      {/* 2. Rapid Duration Selector Chips */}
      <div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
          2. Onset &amp; Duration
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
          Select the timeframe when this sensation was first noticed:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          {DURATION_OPTIONS.map((d) => {
            const isSelected = duration === d.id;
            return (
              <button
                key={d.id}
                className={isSelected ? 'primary' : 'secondary'}
                onClick={() => onSelectDuration(d.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: '1rem 1.25rem',
                  borderRadius: '14px',
                  minHeight: '72px',
                  textAlign: 'left',
                }}
                aria-pressed={isSelected}
              >
                <span style={{ fontWeight: '800', fontSize: '1.05rem' }}>{d.label}</span>
                <span style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '0.2rem' }}>{d.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Associated Physical Sensations (Optional Quick-Chips) */}
      <div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
          3. Associated Physical Sensations (Optional)
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
          Tap any additional physical qualities occurring alongside this sensation:
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
          {ASSOCIATED_SYMPTOMS.map((item) => {
            const isSelected = associatedSymptoms.includes(item.id);
            return (
              <div
                key={item.id}
                className={`chip-toggle ${isSelected ? 'selected' : ''}`}
                onClick={() => onToggleAssociatedSymptom(item.id)}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
              >
                <span>{item.label}</span>
                {isSelected && <span style={{ fontWeight: '900', color: 'var(--accent-cyan)' }}>✓</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
