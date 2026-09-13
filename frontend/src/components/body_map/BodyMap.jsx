import React, { useState } from 'react';
import HumanBody3D, { ANATOMICAL_REGIONS } from './HumanBody3D';

export default function BodyMap({
  confirmedLocations = [],
  onAddConfirmedLocation,
  onRemoveConfirmedLocation,
  onContinue,
  reducedMotion = false,
}) {
  const [selected3DRegion, setSelected3DRegion] = useState(null);

  // Handle 3D Body region selection
  function handle3DSelectRegion(region) {
    if (!region) return;
    setSelected3DRegion(region);
  }

  // Confirm this anatomical selection and proceed to voice
  function handleConfirmAndProceed(autoContinue = true) {
    if (!selected3DRegion) return;

    const newLocation = {
      id: `loc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      body_region: selected3DRegion.id,
      macro: selected3DRegion.macro,
      anatomical_zone: selected3DRegion.zone || selected3DRegion.label,
      side: selected3DRegion.side || 'midline',
      source: 'patient_3d_human_model',
      confidence: 1.0,
      confirmed_by_user: true,
      orientation: selected3DRegion.view || 'front',
      label: selected3DRegion.label,
    };

    if (onAddConfirmedLocation) {
      onAddConfirmedLocation(newLocation);
    }

    if (autoContinue && onContinue) {
      onContinue(newLocation);
    }
    return newLocation;
  }

  return (
    <div className="body-map-container" role="region" aria-label="Interactive 3D Anatomical Body Selector">
      {/* Visual Clinical Pipeline Header */}
      <div
        style={{
          width: '100%',
          padding: '0.65rem 1.25rem',
          background: 'linear-gradient(90deg, #f0fdfa, #f8fafc, #f0f9ff)',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0284c7', letterSpacing: '0.5px' }}>
          CLINICAL PIPELINE:
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 700, color: '#334155', flexWrap: 'wrap' }}>
          <span style={{ color: '#0284c7', background: '#e0f2fe', padding: '0.2rem 0.55rem', borderRadius: '6px' }}>🧍 1. SHOW ME WHERE</span>
          <span>&rarr;</span>
          <span style={{ opacity: 0.75 }}>🎙️ 2. TELL ME WHAT</span>
          <span>&rarr;</span>
          <span style={{ opacity: 0.75 }}>⚡ 3. AI STRUCTURES IT</span>
          <span>&rarr;</span>
          <span style={{ opacity: 0.75 }}>🛡️ 4. SAFETY CHECK</span>
          <span>&rarr;</span>
          <span style={{ opacity: 0.75 }}>🩺 5. CLINICIAN REVIEW</span>
        </div>
      </div>

      {/* Main Heading & Supporting Text (Phases 3 & 4) */}
      <div style={{ textAlign: 'center', marginBottom: '1.25rem', width: '100%' }}>
        <h2 style={{ fontSize: '1.85rem', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
          Let's understand how you're feeling.
        </h2>
        <p style={{ color: '#64748b', fontSize: '1.05rem', marginTop: '0.4rem', maxWidth: '680px', marginInline: 'auto' }}>
          You can show us where it hurts and describe what you're experiencing in your own words.
        </p>
      </div>

      {/* Confirmed Locations Summary Tray (if already populated) */}
      {confirmedLocations.length > 0 && (
        <div
          style={{
            width: '100%',
            maxWidth: '680px',
            background: '#ffffff',
            borderRadius: '14px',
            border: '1.5px solid #cbd5e1',
            padding: '0.85rem 1.25rem',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 800, color: '#0284c7', fontSize: '0.88rem' }}>
              📍 Selected Locations ({confirmedLocations.length}):
            </span>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Click ✕ to remove</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {confirmedLocations.map((loc) => (
              <div
                key={loc.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '9999px',
                  padding: '0.25rem 0.75rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#0f172a',
                }}
              >
                <span>{loc.anatomical_zone || loc.body_region}</span>
                <button
                  onClick={() => onRemoveConfirmedLocation && onRemoveConfirmedLocation(loc.id)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#64748b',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    minHeight: 'auto',
                    minWidth: 'auto',
                    padding: '0',
                  }}
                  title="Remove location"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Area Status Banner (When Region Selected) */}
      {selected3DRegion && (
        <div
          style={{
            width: '100%',
            maxWidth: '680px',
            background: '#f0fdf4',
            border: '2px solid #86efac',
            borderRadius: '16px',
            padding: '1rem 1.35rem',
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.85rem',
            boxShadow: '0 4px 14px rgba(22, 163, 74, 0.1)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Selected Area:
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>
              {selected3DRegion.label.toUpperCase()}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#15803d', fontWeight: 600 }}>
              {selected3DRegion.zone} &bull; {selected3DRegion.side.toUpperCase()}
            </div>
          </div>

          <button
            type="button"
            className="primary"
            onClick={() => handleConfirmAndProceed(true)}
            style={{
              padding: '0.75rem 1.6rem',
              fontSize: '1rem',
              fontWeight: 800,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0284c7, #0d9488)',
              borderColor: '#38bdf8',
              boxShadow: '0 4px 16px rgba(2, 132, 199, 0.3)',
            }}
          >
            🎙️ Tell me what you're experiencing &rarr;
          </button>
        </div>
      )}

      {/* REAL 3D HUMAN ANATOMICAL MODEL VIEWPORT */}
      <HumanBody3D
        selectedRegionId={selected3DRegion?.id}
        onSelectRegion={handle3DSelectRegion}
        confirmedLocations={confirmedLocations}
        reducedMotion={reducedMotion}
      />
    </div>
  );
}
