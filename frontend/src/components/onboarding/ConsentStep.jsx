import React from 'react';

export default function ConsentStep({ onBack, onConfirm }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 className="card-title" style={{ color: 'var(--accent-cyan)', marginBottom: '0.25rem' }}>
          🛡️ Step 3: Plain-Language Clinical Consent
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Please review the following simple principles before beginning your symptom report:
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* Card 1: Assistive, Not Diagnostic */}
        <div
          style={{
            padding: '1.25rem',
            background: 'var(--bg-secondary)',
            border: '2px solid rgba(6, 182, 212, 0.3)',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.8rem' }}>🩺</span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--accent-cyan)' }}>
              Prepares Your Doctor
            </h3>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            PreConsult AI organizes your symptoms into a structured draft for your doctor to review. It does <strong>not</strong> make diagnoses or replace clinical examinations.
          </p>
        </div>

        {/* Card 2: Privacy & Encryption */}
        <div
          style={{
            padding: '1.25rem',
            background: 'var(--bg-secondary)',
            border: '2px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.8rem' }}>🔒</span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--accent-emerald)' }}>
              Confidential & Secure
            </h3>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Your health responses are encrypted and accessible only by your treating healthcare team during this consultation session.
          </p>
        </div>

        {/* Card 3: Emergency Safety Guardrail */}
        <div
          style={{
            padding: '1.25rem',
            background: 'var(--bg-secondary)',
            border: '2px solid rgba(244, 63, 94, 0.3)',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.8rem' }}>🚨</span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--accent-rose)' }}>
              Emergency Safety Guardrails
            </h3>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            If life-threatening symptoms (such as acute chest tightness or difficulty breathing) are reported, routine intake immediately pauses to connect you to urgent clinical staff.
          </p>
        </div>
      </div>

      {/* Confirmation & CTA Button */}
      <div
        style={{
          marginTop: '0.5rem',
          padding: '1.5rem',
          background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(16, 185, 129, 0.1))',
          border: '2px solid var(--accent-cyan)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '1rem',
        }}
      >
        <p style={{ fontSize: '1.05rem', fontWeight: '600', color: 'var(--text-primary)', maxWidth: '600px' }}>
          By tapping below, you agree to submit your symptom details for your physician's clinical review.
        </p>

        <button
          className="primary"
          onClick={onConfirm}
          style={{
            minHeight: '64px',
            padding: '1.1rem 3rem',
            fontSize: '1.25rem',
            fontWeight: '900',
            borderRadius: '16px',
            letterSpacing: '0.5px',
            width: '100%',
            maxWidth: '480px',
            boxShadow: '0 6px 24px rgba(6, 182, 212, 0.4)',
          }}
          aria-label="I Understand & Begin Intake"
        >
          ✓ I Understand &amp; Begin Intake &rarr;
        </button>
      </div>

      <div className="action-bar">
        <button className="secondary" onClick={onBack}>
          &larr; Back to Preferences
        </button>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Step 3 of 7 &bull; Patient Consent &amp; Privacy Notice
        </span>
      </div>
    </div>
  );
}
