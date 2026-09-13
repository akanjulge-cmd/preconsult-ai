import React, { useState, useEffect } from 'react';
import {
  getDocumentSamples,
  uploadDocument,
  uploadDocumentFile,
  verifyDocumentExtraction,
} from '../../services/api';

export default function DocumentScanner({ activeSession, onNavigateToDoctor, theme }) {
  // Session handling
  const sessionId = activeSession?.session_id || 'SES-GERD-01';

  // Sample presets from API / offline fallback
  const [presets, setPresets] = useState([]);
  const [selectedPresetId, setSelectedPresetId] = useState('PRESET_LOW_CONF_RX');

  // Pipeline execution state
  // Stages: 1 = UPLOAD, 2 = SCANNING, 3 = STRUCTURED_REVIEW, 4 = MERGED_SUCCESS
  const [pipelineStep, setPipelineStep] = useState(1);
  const [isScanning, setIsScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewerRole, setReviewerRole] = useState('CLINICIAN'); // CLINICIAN or PATIENT

  // Editable fields for human verification
  const [medications, setMedications] = useState([]);
  const [labs, setLabs] = useState([]);

  // File upload state
  const [customFile, setCustomFile] = useState(null);
  const [customText, setCustomText] = useState('');
  const [inputMode, setInputMode] = useState('presets'); // 'presets' | 'upload' | 'text'

  // Safety alerts / toasts
  const [safetyAlert, setSafetyAlert] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Load sample presets on mount
  useEffect(() => {
    async function loadSamples() {
      try {
        const data = await getDocumentSamples();
        setPresets(data);
      } catch (err) {
        console.error('Failed to load document samples:', err);
      }
    }
    loadSamples();
  }, []);

  // Trigger scanning process
  async function handleStartScan(presetIdToScan = selectedPresetId) {
    setIsScanning(true);
    setPipelineStep(2);
    setSafetyAlert(null);
    setSuccessMessage(null);

    try {
      let res;
      if (inputMode === 'upload' && customFile) {
        res = await uploadDocumentFile(customFile, sessionId);
      } else if (inputMode === 'text' && customText.trim()) {
        res = await uploadDocument({
          filename: 'custom_clinical_notes.txt',
          text_content: customText,
          session_id: sessionId,
        });
      } else {
        res = await uploadDocument({
          preset_id: presetIdToScan,
          session_id: sessionId,
        });
      }

      // Simulate a realistic optical OCR laser pass
      setTimeout(() => {
        setOcrResult(res);
        setMedications(res.extracted_medications || []);
        setLabs(res.extracted_labs || []);
        setIsScanning(false);
        setPipelineStep(3);

        // Highlight any mandatory human verification requirements
        if (res.requires_human_verification) {
          if (res.conflicts_detected && res.conflicts_detected.length > 0) {
            setSafetyAlert({
              type: 'CONFLICT',
              title: '🚨 THERAPEUTIC CONFLICT DETECTED - NO SILENT RESOLUTION',
              message: res.conflicts_detected[0],
            });
          } else {
            setSafetyAlert({
              type: 'LOW_CONFIDENCE',
              title: '⚠️ LOW OPTICAL CONFIDENCE (< 80%) - VERIFICATION MANDATORY',
              message:
                'Optical confidence for one or more fields falls below clinical safety threshold (0.80). Human reviewer must inspect and verify values before summary insertion.',
            });
          }
        }
      }, 1200);
    } catch (err) {
      setIsScanning(false);
      setPipelineStep(1);
      setSafetyAlert({
        type: 'ERROR',
        title: 'OCR Ingestion Failed',
        message: err.message || 'Unable to complete optical character recognition.',
      });
    }
  }

  // Toggle verification for a medication
  function toggleMedVerification(index) {
    setMedications((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], is_verified: !next[index].is_verified };
      return next;
    });
    setSafetyAlert(null);
  }

  // Edit medication field
  function updateMedField(index, field, value) {
    setMedications((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  // Toggle verification for a lab test
  function toggleLabVerification(index) {
    setLabs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], is_verified: !next[index].is_verified };
      return next;
    });
    setSafetyAlert(null);
  }

  // Resolve conflict explicitly (clinician choice)
  function resolveConflict(strategy, keepMedIndex = 0) {
    if (strategy === 'KEEP_BOTH_WITH_WARNING') {
      setMedications((prev) =>
        prev.map((m) => ({
          ...m,
          is_verified: true,
          conflict_reason: `${m.conflict_reason} [CLINICIAN REVIEWED: Retained concurrently with explicit clinical monitoring]`,
        }))
      );
      setSafetyAlert({
        type: 'RESOLVED',
        title: '✓ Dual Therapy Retained with Clinical Conflict Alert',
        message:
          'Both PPI records marked as verified with explicit warning preserved for attending physician in the clinical brief.',
      });
    } else if (strategy === 'RECONCILE_TO_ONE') {
      const chosen = medications[keepMedIndex];
      const other = medications[1 - keepMedIndex];
      setMedications([
        {
          ...chosen,
          is_verified: true,
          has_conflict: false,
          conflict_reason: `[RECONCILED]: Discontinued conflicting ${other.name} ${other.dosage} per human review.`,
        },
      ]);
      setSafetyAlert({
        type: 'RESOLVED',
        title: `✓ Reconciled to ${chosen.name} ${chosen.dosage}`,
        message: `Attending reviewer reconciled conflicting therapy. ${other.name} marked as discontinued.`,
      });
    }
  }

  // Submit human-verified fields into clinical summary
  async function handleVerifyAndMerge() {
    setSafetyAlert(null);
    setSuccessMessage(null);

    // 1. Check for unverified low-confidence items
    const unverifiedLowConf = medications.find(
      (m) => m.confidence < 0.8 && !m.is_verified
    );
    if (unverifiedLowConf) {
      setSafetyAlert({
        type: 'SAFETY_BLOCK',
        title: '🛡️ CLINICAL SAFETY GUARD: Low-Confidence Item Unverified',
        message: `Medication "${unverifiedLowConf.name}" has optical confidence of ${(
          unverifiedLowConf.confidence * 100
        ).toFixed(0)}% (< 80% threshold). Clinical safety policy requires you to inspect and check "Verified by Human" before merging.`,
      });
      return;
    }

    // 2. Check for unresolved conflicts
    const unresolvedConflict = medications.find((m) => m.has_conflict && !m.is_verified);
    if (unresolvedConflict) {
      setSafetyAlert({
        type: 'SAFETY_BLOCK',
        title: '🛡️ CLINICAL SAFETY GUARD: Unresolved Medication Conflict',
        message: `Conflicting records for "${unresolvedConflict.name}" are not reconciled. System safety rules prohibit silent resolution. Please choose a reconciliation strategy or explicitly verify both with caution.`,
      });
      return;
    }

    // 3. Submit verification
    try {
      const payload = {
        session_id: sessionId,
        document_id: ocrResult?.document_id || 'DOC-DEMO-01',
        verified_medications: medications,
        verified_labs: labs,
        reviewer_role: reviewerRole,
        reviewer_notes: reviewNotes || 'Human reviewer confirmed optical extraction.',
      };

      const res = await verifyDocumentExtraction(payload);
      setPipelineStep(4);
      setSuccessMessage({
        title: '🎉 Extraction Verified & Merged into Pre-Consult Summary!',
        message: `Successfully incorporated ${res.medications_added} medication(s) and ${res.labs_added} lab result(s) with OCR-DERIVED provenance.`,
      });
    } catch (err) {
      setSafetyAlert({
        type: 'ERROR',
        title: 'Verification Submission Failed',
        message: err.message || 'Error occurred while merging into clinical database.',
      });
    }
  }

  return (
    <div style={{ padding: '1rem', maxWidth: '1280px', margin: '0 auto' }}>
      {/* 1. PIPELINE BREADCRUMB HEADER */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '16px',
          padding: '1.25rem',
          marginBottom: '1.5rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.5rem' }}>📷</span>
              <h1
                style={{
                  fontSize: '1.4rem',
                  fontWeight: '800',
                  color: '#fff',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                Prescription & Lab Document Ingestion
              </h1>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: '800',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: 'var(--accent-cyan)',
                  border: '1px solid var(--accent-cyan)',
                }}
              >
                OCR + Human Verification Gate
              </span>
            </div>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Optical extraction &bull; Optical confidence scoring &bull; Clinical conflict detection &bull; Human verification &bull; 60s Doctor Brief
            </p>
          </div>

          {/* Quick Doctor Brief Jump Button */}
          {onNavigateToDoctor && (
            <button
              onClick={onNavigateToDoctor}
              style={{
                background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '0.6rem 1.1rem',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 4px 14px rgba(14, 165, 233, 0.4)',
              }}
            >
              <span>🩺</span> View in Doctor 60s Brief &rarr;
            </button>
          )}
        </div>

        {/* Visual Pipeline Flow Tracker */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '0.5rem',
            background: 'rgba(0, 0, 0, 0.3)',
            padding: '0.75rem',
            borderRadius: '12px',
          }}
        >
          {[
            { step: 1, label: '1. Image / PDF', icon: '📄' },
            { step: 2, label: '2. Optical OCR', icon: '⚡' },
            { step: 3, label: '3. Structured Fields', icon: '🏷️' },
            { step: 3, label: '4. Confidence Score', icon: '📊' },
            { step: 3, label: '5. Human Verification', icon: '🧑‍⚕️' },
            { step: 4, label: '6. Clinical Summary', icon: '📋' },
          ].map((item, idx) => {
            const isCompleted = pipelineStep > item.step || (pipelineStep === 4);
            const isCurrent = pipelineStep === item.step;
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '8px',
                  background: isCurrent
                    ? 'rgba(56, 189, 248, 0.2)'
                    : isCompleted
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'transparent',
                  border: isCurrent
                    ? '1px solid var(--accent-cyan)'
                    : isCompleted
                    ? '1px solid rgba(16, 185, 129, 0.3)'
                    : '1px solid transparent',
                  color: isCurrent ? '#fff' : isCompleted ? '#6ee7b7' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: isCurrent || isCompleted ? '700' : '500',
                  transition: 'all 0.2s ease',
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. DEMO PRESET PICKER & INPUT METHOD SELECTION */}
      <div
        style={{
          background: 'rgba(30, 41, 59, 0.7)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <h2
            style={{
              fontSize: '1rem',
              fontWeight: '800',
              color: 'var(--accent-cyan)',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span>🎯</span> Curated Hackathon Demo Presets (1-Click Demonstration)
          </h2>

          {/* Mode Switcher */}
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {[
              { id: 'presets', label: 'Preset Scenarios' },
              { id: 'upload', label: 'Upload File (PNG/PDF)' },
              { id: 'text', label: 'Paste Raw OCR Text' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setInputMode(m.id)}
                style={{
                  background: inputMode === m.id ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.06)',
                  color: inputMode === m.id ? '#000' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Preset Cards */}
        {inputMode === 'presets' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {/* Preset 1: Low Confidence Smudged */}
            <div
              onClick={() => {
                setSelectedPresetId('PRESET_LOW_CONF_RX');
                handleStartScan('PRESET_LOW_CONF_RX');
              }}
              style={{
                background:
                  selectedPresetId === 'PRESET_LOW_CONF_RX'
                    ? 'rgba(245, 158, 11, 0.12)'
                    : 'rgba(15, 23, 42, 0.6)',
                border:
                  selectedPresetId === 'PRESET_LOW_CONF_RX'
                    ? '2px solid var(--accent-amber)'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '1rem',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, border-color 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: '800', background: 'rgba(245, 158, 11, 0.25)', color: '#fde68a', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                  LOW-CONFIDENCE GATE (62%)
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Prescription</span>
              </div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#fff', margin: '0 0 0.3rem 0' }}>
                Dr. Evans Handwritten Rx (Smudged Dose)
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                Demonstrates optical OCR scanning a smudged dose (Pantoprazole 40?mg) with 62% optical confidence. Triggers <strong>mandatory human verification gate</strong> before clinical summary entry.
              </p>
            </div>

            {/* Preset 2: Conflicting Medication Records */}
            <div
              onClick={() => {
                setSelectedPresetId('PRESET_CONFLICT_RX');
                handleStartScan('PRESET_CONFLICT_RX');
              }}
              style={{
                background:
                  selectedPresetId === 'PRESET_CONFLICT_RX'
                    ? 'rgba(244, 63, 94, 0.12)'
                    : 'rgba(15, 23, 42, 0.6)',
                border:
                  selectedPresetId === 'PRESET_CONFLICT_RX'
                    ? '2px solid var(--accent-rose)'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '1rem',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, border-color 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: '800', background: 'rgba(244, 63, 94, 0.25)', color: '#fda4af', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                  🚨 CONFLICT: DUPLICATE PPIs
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Prescription</span>
              </div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#fff', margin: '0 0 0.3rem 0' }}>
                Conflicting Records (Omeprazole + Pantoprazole)
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                Scans 2 contradictory records: Omeprazole 20mg Daily vs Pantoprazole 40mg BID. <strong>Strict safety rule:</strong> never silently resolves duplicate therapy.
              </p>
            </div>

            {/* Preset 3: Diagnostic Lab Panel */}
            <div
              onClick={() => {
                setSelectedPresetId('PRESET_ABNORMAL_LABS');
                handleStartScan('PRESET_ABNORMAL_LABS');
              }}
              style={{
                background:
                  selectedPresetId === 'PRESET_ABNORMAL_LABS'
                    ? 'rgba(16, 185, 129, 0.12)'
                    : 'rgba(15, 23, 42, 0.6)',
                border:
                  selectedPresetId === 'PRESET_ABNORMAL_LABS'
                    ? '2px solid var(--accent-emerald)'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '1rem',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, border-color 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: '800', background: 'rgba(16, 185, 129, 0.25)', color: '#6ee7b7', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                  ABNORMAL LAB FLAGS & RANGES
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lab Report</span>
              </div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#fff', margin: '0 0 0.3rem 0' }}>
                CBC & Metabolic Panel (Hb 10.8 & Glucose 146)
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                Demonstrates lab extraction with reference ranges and abnormal flags: Low Hemoglobin (10.8 g/dL) & High Fasting Glucose (146 mg/dL).
              </p>
            </div>
          </div>
        )}

        {/* Custom File Upload Dropzone */}
        {inputMode === 'upload' && (
          <div
            style={{
              border: '2px dashed rgba(56, 189, 248, 0.4)',
              borderRadius: '12px',
              padding: '2rem',
              textAlign: 'center',
              background: 'rgba(15, 23, 42, 0.5)',
            }}
          >
            <input
              type="file"
              id="doc-file-input"
              accept=".png,.jpg,.jpeg,.pdf"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setCustomFile(e.target.files[0]);
                }
              }}
            />
            <label htmlFor="doc-file-input" style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📤</div>
              <p style={{ color: '#fff', fontWeight: '700', margin: '0 0 0.25rem 0' }}>
                {customFile ? customFile.name : 'Drag and drop prescription image or PDF here'}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
                Supports PNG, JPG, or PDF prescription / lab documents
              </p>
            </label>
            {customFile && (
              <button
                onClick={() => handleStartScan()}
                style={{
                  marginTop: '1rem',
                  background: 'var(--accent-cyan)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 1.25rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                }}
              >
                Scan Uploaded File &rarr;
              </button>
            )}
          </div>
        )}

        {/* Custom Text Mode */}
        {inputMode === 'text' && (
          <div>
            <textarea
              rows={4}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Paste raw prescription text or laboratory findings here to test OCR parsing..."
              style={{
                width: '100%',
                background: 'rgba(15, 23, 42, 0.7)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '0.75rem',
                fontSize: '0.85rem',
                boxSizing: 'border-box',
                fontFamily: 'monospace',
              }}
            />
            <button
              onClick={() => handleStartScan()}
              style={{
                marginTop: '0.5rem',
                background: 'var(--accent-cyan)',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                padding: '0.5rem 1.25rem',
                fontWeight: '800',
                cursor: 'pointer',
              }}
            >
              Parse Text Input &rarr;
            </button>
          </div>
        )}
      </div>

      {/* 3. LASER SCANNING ANIMATION */}
      {isScanning && (
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid var(--accent-cyan)',
            borderRadius: '16px',
            padding: '2.5rem',
            textAlign: 'center',
            marginBottom: '1.5rem',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Laser scanning beam line */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '50%',
              height: '3px',
              background: 'linear-gradient(90deg, transparent, #38bdf8, #818cf8, transparent)',
              boxShadow: '0 0 16px #38bdf8, 0 0 24px #38bdf8',
              animation: 'pulse 1.2s infinite',
            }}
          />
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🔬</div>
          <h3 style={{ color: '#fff', fontSize: '1.2rem', margin: '0 0 0.5rem 0' }}>
            Optical Entity Extraction & Confidence Analysis in Progress...
          </h3>
          <p style={{ color: 'var(--accent-cyan)', fontSize: '0.85rem', margin: 0 }}>
            Inspecting optical resolution &bull; Comparing therapeutic duplicate classes &bull; Calculating confidence intervals
          </p>
        </div>
      )}

      {/* 4. SAFETY & CONFLICT NOTIFICATION BANNER */}
      {safetyAlert && (
        <div
          style={{
            background:
              safetyAlert.type === 'CONFLICT' || safetyAlert.type === 'SAFETY_BLOCK'
                ? 'rgba(244, 63, 94, 0.15)'
                : safetyAlert.type === 'LOW_CONFIDENCE'
                ? 'rgba(245, 158, 11, 0.15)'
                : safetyAlert.type === 'RESOLVED'
                ? 'rgba(16, 185, 129, 0.15)'
                : 'rgba(239, 68, 68, 0.2)',
            border: `1px solid ${
              safetyAlert.type === 'CONFLICT' || safetyAlert.type === 'SAFETY_BLOCK'
                ? 'var(--accent-rose)'
                : safetyAlert.type === 'LOW_CONFIDENCE'
                ? 'var(--accent-amber)'
                : safetyAlert.type === 'RESOLVED'
                ? 'var(--accent-emerald)'
                : '#ef4444'
            }`,
            borderRadius: '12px',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h4
                style={{
                  color:
                    safetyAlert.type === 'CONFLICT' || safetyAlert.type === 'SAFETY_BLOCK'
                      ? '#fda4af'
                      : safetyAlert.type === 'LOW_CONFIDENCE'
                      ? '#fde68a'
                      : safetyAlert.type === 'RESOLVED'
                      ? '#6ee7b7'
                      : '#fca5a5',
                  fontSize: '0.95rem',
                  fontWeight: '800',
                  margin: '0 0 0.35rem 0',
                }}
              >
                {safetyAlert.title}
              </h4>
              <p style={{ color: '#fff', fontSize: '0.85rem', margin: 0, lineHeight: 1.4 }}>
                {safetyAlert.message}
              </p>
            </div>
          </div>

          {/* Conflict Resolution Controls (For Conflict Preset) */}
          {safetyAlert.type === 'CONFLICT' && (
            <div
              style={{
                marginTop: '0.85rem',
                paddingTop: '0.85rem',
                borderTop: '1px solid rgba(244, 63, 94, 0.3)',
                display: 'flex',
                gap: '0.5rem',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: '0.8rem', color: '#fda4af', fontWeight: '700', alignSelf: 'center' }}>
                Reconciliation Action:
              </span>
              <button
                onClick={() => resolveConflict('KEEP_BOTH_WITH_WARNING')}
                style={{
                  background: 'rgba(244, 63, 94, 0.3)',
                  color: '#fff',
                  border: '1px solid var(--accent-rose)',
                  borderRadius: '6px',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                ⚠️ Keep Both (Flag Warning to MD)
              </button>
              <button
                onClick={() => resolveConflict('RECONCILE_TO_ONE', 1)}
                style={{
                  background: 'rgba(56, 189, 248, 0.2)',
                  color: '#fff',
                  border: '1px solid var(--accent-cyan)',
                  borderRadius: '6px',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                ✓ Reconcile to Pantoprazole 40mg (Discharge)
              </button>
              <button
                onClick={() => resolveConflict('RECONCILE_TO_ONE', 0)}
                style={{
                  background: 'rgba(56, 189, 248, 0.2)',
                  color: '#fff',
                  border: '1px solid var(--accent-cyan)',
                  borderRadius: '6px',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                ✓ Reconcile to Omeprazole 20mg (Primary Care)
              </button>
            </div>
          )}
        </div>
      )}

      {/* SUCCESS CONFIRMATION BANNER */}
      {successMessage && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.2)',
            border: '1px solid var(--accent-emerald)',
            borderRadius: '12px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <h4 style={{ color: '#6ee7b7', fontSize: '1rem', fontWeight: '800', margin: '0 0 0.35rem 0' }}>
              {successMessage.title}
            </h4>
            <p style={{ color: '#fff', fontSize: '0.85rem', margin: 0 }}>
              {successMessage.message}
            </p>
          </div>

          {onNavigateToDoctor && (
            <button
              onClick={onNavigateToDoctor}
              style={{
                background: 'var(--accent-emerald)',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                padding: '0.55rem 1.25rem',
                fontWeight: '800',
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
              }}
            >
              Open Clinician 60s Dashboard &rarr;
            </button>
          )}
        </div>
      )}

      {/* 5. STRUCTURED ENTITIES VIEW (MEDICATIONS & LABS) */}
      {ocrResult && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
          {/* Document Summary Bar */}
          <div
            style={{
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '0.85rem 1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Document ID: </span>
              <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{ocrResult.document_id}</strong>
              <span style={{ margin: '0 0.5rem', color: 'rgba(255,255,255,0.2)' }}>&bull;</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>File: </span>
              <span style={{ color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>{ocrResult.filename}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Optical Confidence:</span>
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: '800',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '6px',
                  background:
                    ocrResult.overall_confidence < 0.8
                      ? 'rgba(245, 158, 11, 0.25)'
                      : 'rgba(16, 185, 129, 0.25)',
                  color: ocrResult.overall_confidence < 0.8 ? '#fde68a' : '#6ee7b7',
                  border: `1px solid ${
                    ocrResult.overall_confidence < 0.8 ? 'var(--accent-amber)' : 'var(--accent-emerald)'
                  }`,
                }}
              >
                {(ocrResult.overall_confidence * 100).toFixed(0)}% Overall
              </span>
            </div>
          </div>

          {/* MEDICATIONS EXTRACTION SECTION */}
          {medications.length > 0 && (
            <div
              style={{
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                padding: '1.25rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                }}
              >
                <h3
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: '800',
                    color: 'var(--accent-cyan)',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span>💊</span> Extracted Medications ({medications.length})
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Optical entity extraction with dose & frequency normalization
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {medications.map((med, idx) => {
                  const isLowConf = med.confidence < 0.8;
                  return (
                    <div
                      key={idx}
                      style={{
                        background: med.has_conflict
                          ? 'rgba(244, 63, 94, 0.08)'
                          : isLowConf && !med.is_verified
                          ? 'rgba(245, 158, 11, 0.08)'
                          : 'rgba(15, 23, 42, 0.6)',
                        border: `1px solid ${
                          med.has_conflict
                            ? 'var(--accent-rose)'
                            : isLowConf && !med.is_verified
                            ? 'var(--accent-amber)'
                            : 'rgba(255, 255, 255, 0.1)'
                        }`,
                        borderRadius: '12px',
                        padding: '1rem',
                      }}
                    >
                      {/* Item Top Row */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '0.75rem',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{ fontWeight: '800', fontSize: '1.05rem', color: '#fff' }}>
                            {med.name}
                          </span>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: '700',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              background: 'rgba(56, 189, 248, 0.15)',
                              color: 'var(--accent-cyan)',
                            }}
                          >
                            {med.provenance || 'OCR-DERIVED'}
                          </span>
                          {med.has_conflict && (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: '800',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '4px',
                                background: 'rgba(244, 63, 94, 0.25)',
                                color: '#fda4af',
                              }}
                            >
                              ⚠️ CONFLICT
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          {/* Confidence Tag */}
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: '800',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '6px',
                              background: isLowConf
                                ? 'rgba(245, 158, 11, 0.25)'
                                : 'rgba(16, 185, 129, 0.25)',
                              color: isLowConf ? '#fde68a' : '#6ee7b7',
                            }}
                          >
                            {(med.confidence * 100).toFixed(0)}% Confidence
                            {isLowConf && ' (LOW)'}
                          </span>

                          {/* Verification Checkbox */}
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              cursor: 'pointer',
                              background: med.is_verified ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.06)',
                              border: `1px solid ${med.is_verified ? 'var(--accent-emerald)' : 'rgba(255,255,255,0.2)'}`,
                              padding: '0.3rem 0.6rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              color: med.is_verified ? '#6ee7b7' : '#fff',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={med.is_verified}
                              onChange={() => toggleMedVerification(idx)}
                              style={{ cursor: 'pointer' }}
                            />
                            <span>{med.is_verified ? '✓ Verified by Human' : 'Unconfirmed'}</span>
                          </label>
                        </div>
                      </div>

                      {/* Structured Fields Editor */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: '0.75rem',
                          fontSize: '0.85rem',
                        }}
                      >
                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                            Dosage {isLowConf && <strong style={{ color: 'var(--accent-amber)' }}>(Smudged - Edit to Confirm)</strong>}
                          </label>
                          <input
                            type="text"
                            value={med.dosage || ''}
                            onChange={(e) => updateMedField(idx, 'dosage', e.target.value)}
                            style={{
                              width: '100%',
                              background: 'rgba(0,0,0,0.3)',
                              color: '#fff',
                              border: isLowConf ? '1px solid var(--accent-amber)' : '1px solid rgba(255,255,255,0.15)',
                              borderRadius: '6px',
                              padding: '0.4rem 0.6rem',
                              fontSize: '0.85rem',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                            Frequency
                          </label>
                          <input
                            type="text"
                            value={med.frequency || ''}
                            onChange={(e) => updateMedField(idx, 'frequency', e.target.value)}
                            style={{
                              width: '100%',
                              background: 'rgba(0,0,0,0.3)',
                              color: '#fff',
                              border: '1px solid rgba(255,255,255,0.15)',
                              borderRadius: '6px',
                              padding: '0.4rem 0.6rem',
                              fontSize: '0.85rem',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                            Prescriber / Source
                          </label>
                          <div style={{ color: 'var(--text-secondary)', padding: '0.4rem 0' }}>
                            {med.prescriber || med.source || 'Prescription OCR'}
                          </div>
                        </div>

                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                            Date Extracted
                          </label>
                          <div style={{ color: 'var(--text-secondary)', padding: '0.4rem 0' }}>
                            {med.date || '2026-09-08'}
                          </div>
                        </div>
                      </div>

                      {/* Conflict details if present */}
                      {med.conflict_reason && (
                        <div
                          style={{
                            marginTop: '0.6rem',
                            fontSize: '0.8rem',
                            color: '#fda4af',
                            background: 'rgba(244, 63, 94, 0.1)',
                            padding: '0.4rem 0.6rem',
                            borderRadius: '6px',
                          }}
                        >
                          ⚠️ {med.conflict_reason}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* LAB RESULTS EXTRACTION SECTION */}
          {labs.length > 0 && (
            <div
              style={{
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                padding: '1.25rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                }}
              >
                <h3
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: '800',
                    color: 'var(--accent-emerald)',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span>🧪</span> Extracted Laboratory Diagnostics ({labs.length})
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Automated reference range checking & abnormal value detection
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '0.75rem',
                }}
              >
                {labs.map((lab, idx) => {
                  return (
                    <div
                      key={idx}
                      style={{
                        background: lab.is_abnormal
                          ? 'rgba(244, 63, 94, 0.08)'
                          : 'rgba(15, 23, 42, 0.6)',
                        border: `1px solid ${
                          lab.is_abnormal ? 'rgba(244, 63, 94, 0.4)' : 'rgba(255, 255, 255, 0.1)'
                        }`,
                        borderRadius: '12px',
                        padding: '1rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '0.4rem',
                        }}
                      >
                        <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{lab.test_name}</strong>
                        {lab.is_abnormal ? (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: '800',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              background: 'rgba(244, 63, 94, 0.25)',
                              color: '#fda4af',
                            }}
                          >
                            ⚠️ ABNORMAL
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: '700',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              background: 'rgba(16, 185, 129, 0.2)',
                              color: '#6ee7b7',
                            }}
                          >
                            ✓ NORMAL
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', margin: '0.5rem 0' }}>
                        <span
                          style={{
                            fontSize: '1.4rem',
                            fontWeight: '900',
                            color: lab.is_abnormal ? '#fda4af' : '#fff',
                          }}
                        >
                          {lab.value}
                        </span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{lab.unit}</span>
                      </div>

                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                        Reference Range: <strong style={{ color: '#fff' }}>{lab.reference_range} {lab.unit}</strong>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingTop: '0.5rem',
                          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {(lab.confidence * 100).toFixed(0)}% Conf &bull; {lab.source}
                        </span>
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            color: lab.is_verified ? '#6ee7b7' : 'var(--text-secondary)',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={lab.is_verified}
                            onChange={() => toggleLabVerification(idx)}
                          />
                          <span>Verified</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. HUMAN VERIFICATION & MERGE ACTION DOCK */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '16px',
              padding: '1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ flex: '1 1 320px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '1.1rem' }}>🧑‍⚕️</span>
                <strong style={{ color: '#fff', fontSize: '0.95rem' }}>
                  Human Verification & Accountability Check
                </strong>
                <select
                  value={reviewerRole}
                  onChange={(e) => setReviewerRole(e.target.value)}
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '6px',
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.75rem',
                  }}
                >
                  <option value="CLINICIAN">Role: Attending Clinician</option>
                  <option value="PATIENT">Role: Patient / Caregiver</option>
                </select>
              </div>
              <input
                type="text"
                placeholder="Reviewer notes (e.g. 'Confirmed smudged handwritten dose with patient chart')..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  padding: '0.4rem 0.7rem',
                  fontSize: '0.8rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleVerifyAndMerge}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.75rem 1.5rem',
                  fontWeight: '800',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                }}
              >
                <span>✓</span> Verify & Merge into Clinical Summary
              </button>
            </div>
          </div>

          {/* Raw Document Scanned Transcript Preview */}
          {ocrResult.raw_text && (
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '1rem',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                RAW OPTICAL SCAN TRANSCRIPT:
              </div>
              <pre
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5,
                }}
              >
                {ocrResult.raw_text}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
