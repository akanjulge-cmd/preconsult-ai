import React, { useState } from 'react';

export const SYMPTOM_CONCEPTS = [
  {
    id: 'Burning',
    title: 'Burning / Heat',
    sensoryQuality: 'acidic_heat',
    visualCue: 'flame_vector',
    subtitle: 'Hot, burning, or acidic heat sensation',
    color: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.4)',
    staticIcon: '🔥',
    // Custom SVG Flame Component
    svgVisual: (
      <svg viewBox="0 0 64 64" width="60" height="60" className="flame-anim" role="img" aria-label="Animated burning flame">
        <defs>
          <linearGradient id="flameGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="45%" stopColor="#f97316" />
            <stop offset="85%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
          <filter id="flameGlow">
            <feGaussianBlur stdDeviation="3" result="glow" />
            <feComposite in="SourceGraphic" in2="glow" operator="over" />
          </filter>
        </defs>
        {/* Outer Flame */}
        <path
          d="M 32 4 C 36 16, 48 24, 48 38 C 48 50, 40 58, 32 58 C 24 58, 16 50, 16 38 C 16 26, 26 14, 32 4 Z"
          fill="url(#flameGrad)"
          filter="url(#flameGlow)"
        />
        {/* Inner Tongue */}
        <path
          d="M 32 18 C 34 26, 42 32, 42 42 C 42 48, 38 54, 32 54 C 26 54, 22 48, 22 42 C 22 34, 28 24, 32 18 Z"
          fill="#fef08a"
          opacity="0.9"
        />
        {/* White-Hot Core */}
        <ellipse cx="32" cy="46" rx="5" ry="7" fill="#ffffff" opacity="0.95" />
      </svg>
    ),
  },
  {
    id: 'Cramping',
    title: 'Cramping / Tightness',
    sensoryQuality: 'constricting_spasm',
    visualCue: 'contracting_band',
    subtitle: 'Squeezing, twisting, contracting spasm',
    color: '#8b5cf6',
    glowColor: 'rgba(139, 92, 246, 0.4)',
    staticIcon: '🪢',
    // Custom SVG Contracting Band Component
    svgVisual: (
      <svg viewBox="0 0 64 64" width="60" height="60" className="cramp-anim" role="img" aria-label="Animated contracting band">
        <defs>
          <linearGradient id="bandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#6d28d9" />
          </linearGradient>
        </defs>
        {/* Tension Outer Ring */}
        <circle cx="32" cy="32" r="26" fill="none" stroke="url(#bandGrad)" strokeWidth="4" strokeDasharray="6 4" />
        {/* Contracting Spiral Band */}
        <path
          d="M 16 32 C 16 22, 24 16, 32 16 C 42 16, 48 24, 48 32 C 48 40, 40 48, 32 48 C 22 48, 20 38, 26 32 C 30 28, 36 28, 36 32"
          fill="none"
          stroke="#e9d5ff"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {/* Center Compression Node */}
        <circle cx="32" cy="32" r="7" fill="#8b5cf6" />
        <circle cx="32" cy="32" r="4" fill="#ffffff" />
      </svg>
    ),
  },
  {
    id: 'Sharp',
    title: 'Sharp / Stabbing',
    sensoryQuality: 'lancinating_pierce',
    visualCue: 'needle_starburst',
    subtitle: 'Piercing, sudden, needle-like jab',
    color: '#06b6d4',
    glowColor: 'rgba(6, 182, 212, 0.4)',
    staticIcon: '⚡',
    // Custom SVG Needle Starburst Component
    svgVisual: (
      <svg viewBox="0 0 64 64" width="60" height="60" className="sharp-anim" role="img" aria-label="Animated sharp lancet needles">
        <defs>
          <linearGradient id="needleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
        </defs>
        {/* Sharp Needle Spokes */}
        <line x1="32" y1="6" x2="32" y2="58" stroke="url(#needleGrad)" strokeWidth="3" strokeLinecap="round" />
        <line x1="6" y1="32" x2="58" y2="32" stroke="url(#needleGrad)" strokeWidth="3" strokeLinecap="round" />
        <line x1="14" y1="14" x2="50" y2="50" stroke="url(#needleGrad)" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="50" y1="14" x2="14" y2="50" stroke="url(#needleGrad)" strokeWidth="2.5" strokeLinecap="round" />
        {/* Central Piercing Diamond */}
        <polygon points="32,20 44,32 32,44 20,32" fill="#38bdf8" />
        <circle cx="32" cy="32" r="3.5" fill="#ffffff" />
      </svg>
    ),
  },
  {
    id: 'Dull',
    title: 'Dull / Heavy Ache',
    sensoryQuality: 'heavy_pressure',
    visualCue: 'isobaric_wave',
    subtitle: 'Constant heavy ache, background pressure',
    color: '#3b82f6',
    glowColor: 'rgba(59, 130, 246, 0.4)',
    staticIcon: '🌊',
    // Custom SVG Pressure Waves Component
    svgVisual: (
      <svg viewBox="0 0 64 64" width="60" height="60" className="dull-anim" role="img" aria-label="Animated pressure wave rings">
        <defs>
          <radialGradient id="waveGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#3b82f6" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.1" />
          </radialGradient>
        </defs>
        {/* Expanding Wave Rings */}
        <circle cx="32" cy="32" r="26" fill="url(#waveGrad)" stroke="#60a5fa" strokeWidth="2" strokeDasharray="4 2" />
        <circle cx="32" cy="32" r="18" fill="none" stroke="#93c5fd" strokeWidth="2.5" />
        <circle cx="32" cy="32" r="10" fill="#3b82f6" />
        <circle cx="32" cy="32" r="5" fill="#ffffff" />
      </svg>
    ),
  },
];

export default function SemanticVisuals({
  selectedSymptom,
  onSelectSymptom,
  symptomConfirmed = false,
  onConfirmSymptom,
  reducedMotion = false,
  audioEnabled = false,
}) {
  const activeConcept = SYMPTOM_CONCEPTS.find((c) => c.id === selectedSymptom) || null;

  function handleCardClick(concept) {
    onSelectSymptom(concept.id);
    if (onConfirmSymptom) {
      onConfirmSymptom({
        character: concept.id,
        sensory_quality: concept.sensoryQuality,
        visual_cue: concept.visualCue,
        confirmed_by_user: true,
      });
    }

    if (audioEnabled && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(`${concept.title}. ${concept.subtitle}`);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }

  function handleConfirm() {
    if (!activeConcept) return;
    if (onConfirmSymptom) {
      onConfirmSymptom({
        character: activeConcept.id,
        sensory_quality: activeConcept.sensoryQuality,
        visual_cue: activeConcept.visualCue,
        confirmed_by_user: true,
      });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 className="card-title" style={{ color: 'var(--accent-cyan)', marginBottom: '0.25rem' }}>
          ⚡ Step 5: Adaptive Semantic Visual Sensation
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Touch the visual canvas that matches your physical sensory discomfort (describes physical quality only):
        </p>
      </div>

      {/* 4 Core Semantic Symptom Cards */}
      <div className="grid-4" role="group" aria-label="Visual semantic symptom options">
        {SYMPTOM_CONCEPTS.map((concept) => {
          const isSelected = selectedSymptom === concept.id;
          return (
            <div
              key={concept.id}
              className={`symptom-card ${isSelected ? 'selected' : ''}`}
              onClick={() => handleCardClick(concept)}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              style={{
                borderColor: isSelected ? 'var(--accent-cyan)' : 'var(--border-color)',
                boxShadow: isSelected ? `0 0 24px ${concept.glowColor}` : 'none',
                minHeight: '210px',
              }}
            >
              {/* Visual Canvas (Dynamic Animated SVG or Static High-Contrast Fallback) */}
              <div
                className="visual-canvas"
                style={{
                  border: `2px solid ${isSelected ? concept.color : 'rgba(255,255,255,0.12)'}`,
                  background: 'rgba(0, 0, 0, 0.45)',
                  boxShadow: isSelected ? `inset 0 0 16px ${concept.glowColor}` : 'none',
                }}
              >
                {reducedMotion ? (
                  <span className="static-symptom-badge" style={{ fontSize: '2.5rem' }}>
                    {concept.staticIcon}
                  </span>
                ) : (
                  concept.svgVisual
                )}
              </div>

              <div>
                <h3
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: '800',
                    color: isSelected ? '#ffffff' : 'var(--text-primary)',
                  }}
                >
                  {concept.title}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                  {concept.subtitle}
                </p>
              </div>

              {isSelected && (
                <div
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: '800',
                    color: '#ffffff',
                    background: 'var(--accent-cyan)',
                    padding: '0.25rem 0.85rem',
                    borderRadius: '999px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  ✓ Selected
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Explicit Sensation Confirmation Preview Panel */}
      {activeConcept && (
        <div className="sensation-confirm-panel" role="region" aria-label="Sensation confirmation panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '2rem' }}>{activeConcept.staticIcon}</span>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Selected Sensation Character:
                </span>
                <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#ffffff' }}>
                  {activeConcept.title}
                </div>
              </div>
            </div>

            {symptomConfirmed && (
              <span
                style={{
                  padding: '0.35rem 0.9rem',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1.5px solid var(--accent-emerald)',
                  color: '#34d399',
                  fontWeight: '800',
                  fontSize: '0.85rem',
                }}
              >
                ✓ Confirmed by User
              </span>
            )}
          </div>

          {/* Structured Clinical Attributes Breakdown (Zero Diagnoses) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span className="clinical-attribute-pill">
              <strong>Quality:</strong> {activeConcept.sensoryQuality}
            </span>
            <span className="clinical-attribute-pill">
              <strong>Visual Cue:</strong> {activeConcept.visualCue}
            </span>
            <span className="clinical-attribute-pill" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', color: '#6ee7b7' }}>
              <strong>Clinical Classification:</strong> Patient-Reported Physical Sensory Quality
            </span>
          </div>

          {!symptomConfirmed && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <button
                className="primary"
                onClick={handleConfirm}
                style={{ minHeight: '52px', padding: '0.85rem 2rem', fontSize: '1.05rem', fontWeight: '900' }}
                aria-label={`Confirm sensation as ${activeConcept.title}`}
              >
                ✓ Confirm Sensation Character
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
