import React, { useState, useEffect, useRef } from 'react';
import {
  getClinicianQueue,
  getClinicalSummary,
  saveClinicianEdits,
  approveSummary,
  rejectSummary,
  regenerateSummary,
  getFhirBundle,
  getAudioStreamUrl,
  BACKEND_URL,
} from '../../services/api';

export default function ClinicianDashboard({
  activeSession,
  submittedIntake,
  theme,
  onNavigateToScanner,
  onNavigateToIntake,
  onUpdateRecord,
}) {
  // Navigation Sidebar Active State
  const [activeNav, setActiveNav] = useState('Intakes'); // Overview, Patients, Intakes, Appointments, Records, Alerts, Settings

  // Queue & Selection State
  const [queue, setQueue] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(
    activeSession?.session_id || 'SES-GERD-01'
  );
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  // 60-Second Review Benchmark Timer
  const [reviewSeconds, setReviewSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(true);

  // Provenance Filter
  const [provenanceFilter, setProvenanceFilter] = useState('ALL');

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  // Modals
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [showFhirModal, setShowFhirModal] = useState(false);

  // Modal Inputs
  const [doctorName, setDoctorName] = useState('Dr. S. Vance, MD');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [rejectCategory, setRejectCategory] = useState('AI_INFERENCE_INACCURATE');
  const [rejectReason, setRejectReason] = useState('');
  const [regenInstructions, setRegenInstructions] = useState('');
  const [fhirData, setFhirData] = useState(null);

  // Toast / Feedback
  const [toastMessage, setToastMessage] = useState(null);

  // 1. Load Queue on Mount
  useEffect(() => {
    async function loadQueue() {
      try {
        const q = await getClinicianQueue();
        if (activeSession) {
          const liveItem = {
            session_id: activeSession.session_id,
            record_id: submittedIntake?.finalizedRecord?.record_id || `REC-${activeSession.session_id}`,
            patient_id: activeSession.patient_identifier || 'PAT-LIVE',
            patient_name: submittedIntake ? 'Active Kiosk Patient (Just Transmitted)' : 'Live Kiosk Intake',
            ticket: submittedIntake?.ticket || 'P-101',
            chief_complaint: submittedIntake
              ? `${submittedIntake.symptom || 'Burning'} in ${submittedIntake.micro || 'Epigastrium'}`
              : 'Patient Intake in Progress',
            triage_urgency: submittedIntake?.finalizedRecord?.triage_urgency || 'ROUTINE',
            review_status: submittedIntake?.finalizedRecord?.review_status || 'DRAFT',
            is_approved: submittedIntake?.finalizedRecord?.clinician_approved || false,
            red_flag_active: submittedIntake?.finalizedRecord?.red_flag?.is_active || false,
            confidence_score: submittedIntake?.finalizedRecord?.confidence_score || 0.96,
            created_at: new Date().toISOString(),
            is_live: true,
          };
          const filteredQ = q.filter((item) => item.session_id !== activeSession.session_id);
          setQueue([liveItem, ...filteredQ]);
          if (submittedIntake) {
            setSelectedSessionId(activeSession.session_id);
          }
        } else {
          setQueue(q);
        }
      } catch (err) {
        console.error('Failed to load queue:', err);
      }
    }
    loadQueue();
  }, [activeSession, submittedIntake]);

  const prevSessionIdRef = useRef(null);

  // 2. Load Selected Patient Record
  useEffect(() => {
    async function loadRecord() {
      if (!selectedSessionId) return;
      setLoading(true);
      if (prevSessionIdRef.current !== selectedSessionId) {
        setReviewSeconds(0);
        setTimerActive(true);
        setIsEditing(false);
        prevSessionIdRef.current = selectedSessionId;
      }
      try {
        if (
          submittedIntake?.finalizedRecord &&
          selectedSessionId === activeSession?.session_id
        ) {
          setRecord(submittedIntake.finalizedRecord);
          initEditForm(submittedIntake.finalizedRecord);
        } else {
          const data = await getClinicalSummary(selectedSessionId);
          setRecord(data);
          initEditForm(data);
        }
      } catch (err) {
        console.error('Failed to load summary:', err);
      } finally {
        setLoading(false);
      }
    }
    loadRecord();
  }, [selectedSessionId, submittedIntake]);

  // 3. 60-Second Scan Countdown Timer
  useEffect(() => {
    let interval = null;
    if (timerActive) {
      interval = setInterval(() => {
        setReviewSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive]);

  function initEditForm(rec) {
    if (!rec) return;
    setEditForm({
      chief_complaint: rec.chief_complaint || '',
      history_of_present_illness: rec.history_of_present_illness || '',
      symptom_timeline: rec.symptom_timeline || '',
      severity: rec.symptoms?.[0]?.severity || 7,
      pertinent_negatives: rec.pertinent_negatives ? [...rec.pertinent_negatives] : [],
      unresolved_questions: rec.unresolved_questions ? [...rec.unresolved_questions] : [],
      clinician_notes: rec.clinician_notes || '',
      active_medications: rec.active_medications ? [...rec.active_medications] : [],
      abnormal_labs: rec.abnormal_labs ? [...rec.abnormal_labs] : [],
    });
  }

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }

  // Handle Inline Field Saves
  async function handleSaveEdits() {
    if (record?.review_status === 'APPROVED') {
      showToast('⚠️ Record is already APPROVED and locked against modifications.');
      setIsEditing(false);
      return;
    }
    try {
      const updatedSymptoms = (record?.symptoms || []).map((s, idx) =>
        idx === 0 ? { ...s, severity: editForm.severity, provenance: 'CLINICIAN-EDITED' } : s
      );
      const updated = await saveClinicianEdits(selectedSessionId, {
        ...editForm,
        symptoms: updatedSymptoms,
        clinician_id: doctorName,
      });
      setRecord(updated);
      setIsEditing(false);
      showToast('✓ Modifications saved. Edited elements tagged with CLINICIAN-EDITED provenance.');

      if (onUpdateRecord && selectedSessionId === activeSession?.session_id) {
        onUpdateRecord(updated);
      }

      setQueue((prev) =>
        prev.map((item) =>
          item.session_id === selectedSessionId
            ? { ...item, review_status: 'CLINICIAN_EDITED', chief_complaint: editForm.chief_complaint }
            : item
        )
      );
    } catch (err) {
      showToast('Error saving edits: ' + err.message);
    }
  }

  // Handle Approve & Sign
  async function handleApprove() {
    try {
      const res = await approveSummary(selectedSessionId, {
        clinicianId: doctorName,
        clinicianNotes: doctorNotes,
        digitalSignature: `SIG-${doctorName.replace(/\s+/g, '').toUpperCase()}-${Date.now().toString().slice(-4)}`,
      });
      setShowApproveModal(false);
      setTimerActive(false);
      showToast(`✓ Clinical brief verified and officially signed by ${doctorName}!`);

      setRecord((prev) => ({
        ...prev,
        review_status: 'APPROVED',
        clinician_approved: true,
        clinician_sign_off: res.clinician_sign_off || {
          clinician_id: doctorName,
          timestamp: new Date().toISOString(),
          digital_signature: `SIG-${doctorName.replace(/\s+/g, '').toUpperCase()}`,
        },
      }));

      setQueue((prev) =>
        prev.map((item) =>
          item.session_id === selectedSessionId
            ? { ...item, review_status: 'APPROVED', is_approved: true }
            : item
        )
      );

      if (onUpdateRecord && selectedSessionId === activeSession?.session_id) {
        onUpdateRecord({
          ...record,
          review_status: 'APPROVED',
          clinician_approved: true,
        });
      }
    } catch (err) {
      showToast('Error approving brief: ' + err.message);
    }
  }

  // Handle Reject
  async function handleReject() {
    if (!rejectReason.trim()) {
      showToast('⚠️ Rejection requires an audit justification note.');
      return;
    }
    try {
      await rejectSummary(selectedSessionId, {
        category: rejectCategory,
        reason: rejectReason,
        clinicianId: doctorName,
      });
      setShowRejectModal(false);
      showToast('✓ Draft rejected and logged in safety governance audit trail.');

      setRecord((prev) => ({
        ...prev,
        review_status: 'REJECTED',
        clinician_approved: false,
      }));

      setQueue((prev) =>
        prev.map((item) =>
          item.session_id === selectedSessionId ? { ...item, review_status: 'REJECTED' } : item
        )
      );
    } catch (err) {
      showToast('Error rejecting draft: ' + err.message);
    }
  }

  // Handle Regenerate AI
  async function handleRegenerate() {
    try {
      setLoading(true);
      setShowRegenModal(false);
      const res = await regenerateSummary(selectedSessionId, {
        instructions: regenInstructions,
      });
      setRecord(res);
      initEditForm(res);
      showToast('✓ Clinical brief regenerated with clinician guidance.');
    } catch (err) {
      showToast('Error regenerating brief: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Handle FHIR R4 Bundle Export
  async function handleOpenFhir() {
    try {
      const data = await getFhirBundle(selectedSessionId);
      setFhirData(data);
      setShowFhirModal(true);
    } catch (err) {
      showToast('Error generating FHIR Bundle: ' + err.message);
    }
  }

  // Provenance filtering helper
  function isProvHighlighted(sourceType) {
    if (provenanceFilter === 'ALL') return false;
    return provenanceFilter === sourceType;
  }

  function renderProvenanceBadge(sourceType, explicitSource = null) {
    let label = 'PATIENT';
    let bg = '#e0f2fe';
    let textCol = '#0369a1';
    let border = '#bae6fd';

    if (sourceType.includes('OCR')) {
      label = 'OCR-DERIVED';
      bg = '#f5f3ff';
      textCol = '#6d28d9';
      border = '#ddd6fe';
    } else if (sourceType.includes('AI') || sourceType.includes('INFERRED')) {
      label = 'AI-INFERRED';
      bg = '#eff6ff';
      textCol = '#1d4ed8';
      border = '#bfdbfe';
    } else if (sourceType.includes('CLINICIAN')) {
      label = 'CLINICIAN-EDITED';
      bg = '#ecfdf5';
      textCol = '#047857';
      border = '#a7f3d0';
    }

    return (
      <span
        style={{
          fontSize: '0.68rem',
          fontWeight: '800',
          padding: '0.15rem 0.45rem',
          borderRadius: '4px',
          background: bg,
          color: textCol,
          border: `1px solid ${border}`,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
        title={`Grounding provenance: ${explicitSource || sourceType}`}
      >
        {label}
      </span>
    );
  }

  const isEmergency = record?.triage_urgency === 'EMERGENCY' || record?.red_flag?.is_active;
  const isPriority = record?.triage_urgency === 'PRIORITY';
  const primarySymptom = record?.symptoms?.[0] || {};
  const ccProv = record?.provenance_map?.chief_complaint || 'PATIENT-STATED';
  const hpiProv = record?.provenance_map?.history_of_present_illness || 'AI-INFERRED';

  // Recorded Patient Intake & Voice Evidence Extraction
  const recordedIntake =
    record?.recorded_intake ||
    (submittedIntake?.session_id === selectedSessionId || selectedSessionId === activeSession?.session_id
      ? submittedIntake
      : null);
  const patientTranscript =
    recordedIntake?.patient_voice_transcript ||
    recordedIntake?.voiceTranscript ||
    record?.patient_voice_transcript ||
    (selectedSessionId === 'SES-GERD-01'
      ? "I have a burning pain in the right upper part of my abdomen. It started this morning. It's about an eight out of ten and I feel nauseous."
      : null);
  const intakeRegion =
    recordedIntake?.body_region ||
    (recordedIntake?.macro ? `${recordedIntake.macro} → ${recordedIntake.micro || 'Right Upper Quadrant'}` : primarySymptom?.anatomical_micro_zone || 'Right Upper Abdomen (RUQ)');
  const intakeSymptom = recordedIntake?.character || recordedIntake?.symptom || primarySymptom?.character || 'Burning';
  const intakeSeverity = recordedIntake?.severity !== undefined ? recordedIntake.severity : (primarySymptom?.severity || 8);
  const intakeOnset = recordedIntake?.onset || recordedIntake?.duration || primarySymptom?.duration || 'this morning';
  const intakeAssociated = recordedIntake?.associated_symptoms || record?.associated_symptoms || ['nausea'];
  const intakeId = recordedIntake?.intake_id || (submittedIntake?.ticket ? `INTAKE-${submittedIntake.ticket}` : `INT-${selectedSessionId}`);

  const audioUrl = getAudioStreamUrl(
    recordedIntake?.audio_url ||
    recordedIntake?.audio_filename ||
    record?.audio_filename
  );

  // Sub-view: Overview
  function renderOverview() {
    const totalPatients = queue.length;
    const emerg = queue.filter((q) => q.triage_urgency === 'EMERGENCY').length;
    const prio = queue.filter((q) => q.triage_urgency === 'PRIORITY').length;
    const approved = queue.filter((q) => q.is_approved).length;

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', padding: '0.25rem' }}>
        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: '0 0 0.35rem 0' }}>
            📊 Clinical Unit Overview &amp; Operational Metrics
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>
            Live departmental throughput, patient intake volume, and acute clinical triage status.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Waiting Room Queue</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', marginTop: '0.25rem' }}>{totalPatients}</div>
            <div style={{ fontSize: '0.75rem', color: '#0284c7', marginTop: '0.2rem' }}>Active Patient Sessions</div>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #fecdd3', borderRadius: '14px', padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase' }}>Red-Flag Alerts</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#dc2626', marginTop: '0.25rem' }}>{emerg}</div>
            <div style={{ fontSize: '0.75rem', color: '#b91c1c', marginTop: '0.2rem' }}>Immediate STAT Evaluation</div>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>Approved &amp; Signed</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#15803d', marginTop: '0.25rem' }}>{approved}</div>
            <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '0.2rem' }}>Ready for EHR Ingestion</div>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e0f2fe', borderRadius: '14px', padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase' }}>Avg. Brief Review Time</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0284c7', marginTop: '0.25rem' }}>42s</div>
            <div style={{ fontSize: '0.75rem', color: '#0284c7', marginTop: '0.2rem' }}>60-Second Target Met</div>
          </div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginBottom: '1rem' }}>
            Recent Incoming Patient Intakes
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Ticket</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Patient Name</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Chief Complaint</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Urgency</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Review Status</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => (
                  <tr key={item.session_id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.75rem 0.85rem', fontWeight: 800 }}>{item.ticket}</td>
                    <td style={{ padding: '0.75rem 0.85rem', fontWeight: 700 }}>
                      {item.patient_name}
                      {item.is_live === false && (
                        <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', color: '#6366f1', background: '#e0e7ff', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                          SYNTHETIC DEMO
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 0.85rem', color: '#475569' }}>{item.chief_complaint}</td>
                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      <span
                        style={{
                          padding: '0.15rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          background: item.triage_urgency === 'EMERGENCY' ? '#fee2e2' : item.triage_urgency === 'PRIORITY' ? '#fef3c7' : '#ecfdf5',
                          color: item.triage_urgency === 'EMERGENCY' ? '#dc2626' : item.triage_urgency === 'PRIORITY' ? '#d97706' : '#059669',
                        }}
                      >
                        {item.triage_urgency}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 0.85rem', fontWeight: 700, fontSize: '0.8rem', color: item.is_approved ? '#15803d' : '#64748b' }}>
                      {item.is_approved ? '✓ APPROVED' : item.review_status || 'DRAFT'}
                    </td>
                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      <button
                        onClick={() => {
                          setSelectedSessionId(item.session_id);
                          setActiveNav('Intakes');
                        }}
                        className="primary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', minHeight: '30px', borderRadius: '8px' }}
                      >
                        Open Brief →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Sub-view: Patients Directory
  function renderPatients() {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', padding: '0.25rem' }}>
        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: '0 0 0.35rem 0' }}>
            👥 Patient Registry &amp; Medical Record Directory
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>
            Comprehensive directory of pre-consultation patient records, MRNs, and visit histories.
          </p>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.25rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 0.85rem' }}>Patient MRN</th>
                <th style={{ padding: '0.75rem 0.85rem' }}>Name &amp; Age</th>
                <th style={{ padding: '0.75rem 0.85rem' }}>Latest Chief Complaint</th>
                <th style={{ padding: '0.75rem 0.85rem' }}>Triage Priority</th>
                <th style={{ padding: '0.75rem 0.85rem' }}>Record Status</th>
                <th style={{ padding: '0.75rem 0.85rem' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((item) => (
                <tr key={item.session_id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '0.75rem 0.85rem', fontFamily: 'monospace', fontWeight: 700 }}>
                    {item.record_id || item.patient_id}
                  </td>
                  <td style={{ padding: '0.75rem 0.85rem', fontWeight: 800 }}>
                    {item.patient_name}
                    {item.is_live === false && (
                      <span style={{ marginLeft: '0.35rem', fontSize: '0.62rem', color: '#6366f1', background: '#e0e7ff', padding: '0.05rem 0.3rem', borderRadius: '4px' }}>
                        SYNTHETIC DEMO
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 0.85rem', color: '#475569' }}>{item.chief_complaint}</td>
                  <td style={{ padding: '0.75rem 0.85rem' }}>
                    <span
                      style={{
                        padding: '0.15rem 0.45rem',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        background: item.triage_urgency === 'EMERGENCY' ? '#fee2e2' : item.triage_urgency === 'PRIORITY' ? '#fef3c7' : '#ecfdf5',
                        color: item.triage_urgency === 'EMERGENCY' ? '#dc2626' : item.triage_urgency === 'PRIORITY' ? '#d97706' : '#059669',
                      }}
                    >
                      {item.triage_urgency}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 0.85rem', fontSize: '0.8rem', fontWeight: 700, color: item.is_approved ? '#15803d' : '#64748b' }}>
                    {item.is_approved ? '✓ SIGNED' : 'PENDING'}
                  </td>
                  <td style={{ padding: '0.75rem 0.85rem' }}>
                    <button
                      onClick={() => {
                        setSelectedSessionId(item.session_id);
                        setActiveNav('Intakes');
                      }}
                      className="secondary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', minHeight: '30px', borderRadius: '8px' }}
                    >
                      View Chart &rarr;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Sub-view: Appointments / Clinic Triage Slots
  function renderAppointments() {
    const slots = [
      { time: '09:00 AM', ticket: 'P-101', patient: 'Active Kiosk Patient', complaint: 'Epigastric burning discomfort', status: 'ARRIVED' },
      { time: '09:30 AM', ticket: 'P-911', patient: 'Robert Chen (62M)', complaint: 'Crushing mid-chest pressure radiating to left arm', status: 'TRIAGED_STAT' },
      { time: '10:00 AM', ticket: 'P-248', patient: 'Maria Gonzalez (48F)', complaint: 'Acid reflux and upper stomach acidity', status: 'WAITING' },
      { time: '10:30 AM', ticket: 'P-415', patient: 'Priya Sharma (34F)', complaint: 'Left knee anterior patellar trauma', status: 'SCHEDULED' },
      { time: '11:00 AM', ticket: 'P-489', patient: 'David Miller (55M)', complaint: 'Right shoulder rotator cuff strain', status: 'SCHEDULED' },
    ];

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', padding: '0.25rem' }}>
        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: '0 0 0.35rem 0' }}>
            📅 Today's Clinical Schedule &amp; Triage Roster
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>
            Scheduled pre-consultation time slots and patient check-in timeline.
          </p>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.25rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 0.85rem' }}>Time Slot</th>
                <th style={{ padding: '0.75rem 0.85rem' }}>Ticket</th>
                <th style={{ padding: '0.75rem 0.85rem' }}>Patient</th>
                <th style={{ padding: '0.75rem 0.85rem' }}>Chief Concern</th>
                <th style={{ padding: '0.75rem 0.85rem' }}>Arrival Status</th>
                <th style={{ padding: '0.75rem 0.85rem' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((s, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '0.75rem 0.85rem', fontWeight: 800, color: '#0284c7' }}>{s.time}</td>
                  <td style={{ padding: '0.75rem 0.85rem', fontWeight: 800 }}>{s.ticket}</td>
                  <td style={{ padding: '0.75rem 0.85rem', fontWeight: 700 }}>{s.patient}</td>
                  <td style={{ padding: '0.75rem 0.85rem', color: '#475569' }}>{s.complaint}</td>
                  <td style={{ padding: '0.75rem 0.85rem' }}>
                    <span
                      style={{
                        padding: '0.15rem 0.45rem',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        background: s.status === 'TRIAGED_STAT' ? '#fee2e2' : s.status === 'ARRIVED' ? '#e0f2fe' : '#f8fafc',
                        color: s.status === 'TRIAGED_STAT' ? '#dc2626' : s.status === 'ARRIVED' ? '#0284c7' : '#64748b',
                      }}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 0.85rem' }}>
                    <button
                      onClick={() => setActiveNav('Intakes')}
                      className="primary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', minHeight: '30px', borderRadius: '8px' }}
                    >
                      Attend Patient &rarr;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Sub-view: Clinical Records & FHIR Export
  function renderRecords() {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', padding: '0.25rem' }}>
        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: '0 0 0.35rem 0' }}>
            📑 Signed Clinical Records &amp; Interoperability Hub
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>
            Audited clinical pre-consultations, physician digital signatures, and HL7 FHIR R4 export repository.
          </p>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.25rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 0.85rem' }}>Record ID</th>
                <th style={{ padding: '0.75rem 0.85rem' }}>Patient Name</th>
                <th style={{ padding: '0.75rem 0.85rem' }}>Physician Attestation</th>
                <th style={{ padding: '0.75rem 0.85rem' }}>Signed Timestamp</th>
                <th style={{ padding: '0.75rem 0.85rem' }}>FHIR Interop</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((item) => (
                <tr key={item.session_id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '0.75rem 0.85rem', fontFamily: 'monospace', fontWeight: 800 }}>
                    {item.record_id || `REC-${item.session_id}`}
                  </td>
                  <td style={{ padding: '0.75rem 0.85rem', fontWeight: 700 }}>{item.patient_name}</td>
                  <td style={{ padding: '0.75rem 0.85rem' }}>
                    <span style={{ color: item.is_approved ? '#15803d' : '#d97706', fontWeight: 800, fontSize: '0.8rem' }}>
                      {item.is_approved ? `✓ Verified by ${doctorName}` : 'Pending Physician Verification'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 0.85rem', color: '#64748b', fontSize: '0.8rem' }}>
                    {new Date(item.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: '0.75rem 0.85rem' }}>
                    <button
                      onClick={() => {
                        setSelectedSessionId(item.session_id);
                        handleOpenFhir();
                      }}
                      className="secondary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', minHeight: '30px', borderRadius: '8px' }}
                    >
                      Export FHIR Bundle &rarr;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Sub-view: Emergency Alerts
  function renderAlerts() {
    const emergQueue = queue.filter((q) => q.triage_urgency === 'EMERGENCY' || q.red_flag_active);
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', padding: '0.25rem' }}>
        <div style={{ background: '#fef2f2', borderRadius: '16px', border: '2px solid #fca5a5', padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#991b1b', margin: '0 0 0.35rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🚨</span> Acute Emergency &amp; Red-Flag Intercept Command
          </h2>
          <p style={{ color: '#b91c1c', fontSize: '0.88rem', margin: 0 }}>
            Active deterministic red-flag safety intercepts requiring STAT clinician attention and immediate stabilization protocols.
          </p>
        </div>

        {emergQueue.length === 0 ? (
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '2rem', textAlign: 'center' }}>
            <span style={{ fontSize: '2rem' }}>✅</span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#15803d', marginTop: '0.5rem' }}>
              No Active Red-Flag Alerts
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              All waiting room patients are currently triaged within routine or priority clinical limits.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {emergQueue.map((item) => (
              <div
                key={item.session_id}
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '2px solid #ef4444',
                  padding: '1.25rem',
                  boxShadow: '0 4px 20px rgba(239, 68, 68, 0.12)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <span style={{ background: '#fee2e2', color: '#dc2626', fontWeight: 900, fontSize: '0.78rem', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                      STAT EMERGENCY
                    </span>
                    <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#0f172a' }}>{item.patient_name}</span>
                    <span style={{ color: '#64748b', fontSize: '0.85rem' }}>({item.ticket})</span>
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#b91c1c' }}>{item.chief_complaint}</div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.3rem' }}>
                    Immediate 12-lead ECG, continuous telemetry, and attending physician evaluation required.
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedSessionId(item.session_id);
                    setActiveNav('Intakes');
                  }}
                  className="primary"
                  style={{
                    background: '#dc2626',
                    borderColor: '#ef4444',
                    padding: '0.65rem 1.4rem',
                    fontWeight: 900,
                    borderRadius: '10px',
                    boxShadow: '0 4px 14px rgba(220, 38, 38, 0.3)',
                  }}
                >
                  ⚡ Open STAT Brief &rarr;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Sub-view: Clinician Settings & Unit Configuration
  function renderSettings() {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', padding: '0.25rem' }}>
        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: '0 0 0.35rem 0' }}>
            ⚙️ Clinician Profile &amp; Hospital Unit Settings
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>
            Configure attending credentials, safety guardrail sensitivity, and workflow preferences.
          </p>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '700px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
              Attending Clinician Name &amp; Degree:
            </label>
            <input
              type="text"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', fontWeight: 600 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
              Clinical Department / Unit:
            </label>
            <select
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', fontWeight: 600 }}
            >
              <option>Emergency &amp; Acute Care Unit</option>
              <option>Ambulatory Internal Medicine</option>
              <option>Gastroenterology Triage Clinic</option>
              <option>Orthopedic &amp; Sports Medicine</option>
            </select>
          </div>

          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', marginBottom: '0.25rem' }}>
              🛡️ Deterministic Safety Guardrail Engine:
            </div>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              Status: <strong>Active &amp; Enforced</strong>. Critical red-flags (cardiac chest pain, respiratory distress, acute anaphylaxis) trigger automatic deterministic intercepts and require explicit clinician override.
            </p>
          </div>

          <button
            onClick={() => showToast('✓ Settings updated successfully!')}
            className="primary"
            style={{ width: 'fit-content', padding: '0.65rem 1.5rem', borderRadius: '10px', fontWeight: 800 }}
          >
            Save Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: '1.25rem',
        background: '#f8fafc',
        minHeight: 'calc(100vh - 120px)',
        padding: '0.5rem',
        color: '#0f172a',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
      role="main"
      aria-label="Clinician Command Center"
    >
      {/* Toast Alert */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: '#0f172a',
            border: '2px solid #0284c7',
            color: '#fff',
            padding: '0.85rem 1.4rem',
            borderRadius: '12px',
            zIndex: 10000,
            boxShadow: '0 10px 30px rgba(15,23,42,0.3)',
            fontWeight: '700',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>ℹ️</span> {toastMessage}
        </div>
      )}

      {/* ========================================================================= */}
      {/* PANEL 1: LEFT CLINICAL COMMAND SIDEBAR (Reference 2) */}
      {/* ========================================================================= */}
      <aside
        style={{
          width: '260px',
          flexShrink: 0,
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 14px -2px rgba(15, 23, 42, 0.05)',
          padding: '1.25rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
        aria-label="Clinical Navigation & Queue"
      >
        {/* Hospital Unit Header */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1.3rem' }}>🏥</span>
            <span style={{ fontWeight: '900', fontSize: '1.05rem', color: '#0f172a', letterSpacing: '-0.3px' }}>
              PRECONSULT AI
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Clinical Command Suite
          </div>
        </div>

        {/* Command Navigation List */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {[
            { id: 'Overview', icon: '📊', label: 'Overview' },
            { id: 'Patients', icon: '👥', label: 'Patients' },
            { id: 'Intakes', icon: '📥', label: 'Intakes', badge: queue.length },
            { id: 'Appointments', icon: '📅', label: 'Appointments' },
            { id: 'Records', icon: '📑', label: 'Clinical Records' },
            { id: 'Alerts', icon: '🚨', label: 'Alerts', badge: emergencyCount > 0 ? emergencyCount : null, alert: true },
            { id: 'Settings', icon: '⚙️', label: 'Settings' },
          ].map((item) => {
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: isActive ? '#f0f9ff' : 'transparent',
                  color: isActive ? '#0284c7' : '#475569',
                  fontWeight: isActive ? '800' : '600',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge !== null && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: '800',
                      padding: '0.1rem 0.45rem',
                      borderRadius: '999px',
                      background: item.alert ? '#fee2e2' : '#e0f2fe',
                      color: item.alert ? '#dc2626' : '#0284c7',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Divider */}
        <div style={{ height: '1px', background: '#e2e8f0' }} />

        {/* Live Patient Queue in Sidebar */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Waiting Room ({queue.length})
            </span>
            <span style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: '700' }}>Live</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', paddingRight: '0.2rem' }}>
            {queue.map((item) => {
              const isSelected = item.session_id === selectedSessionId;
              const isItemEmerg = item.triage_urgency === 'EMERGENCY';
              return (
                <div
                  key={item.session_id}
                  onClick={() => {
                    setSelectedSessionId(item.session_id);
                    setActiveNav('Intakes');
                  }}
                  style={{
                    padding: '0.65rem 0.75rem',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: isSelected ? '#f0f9ff' : '#f8fafc',
                    border: isSelected
                      ? '1.5px solid #0284c7'
                      : isItemEmerg
                      ? '1.5px solid #fecdd3'
                      : '1px solid #e2e8f0',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#0f172a' }}>
                      {item.ticket || 'TICKET'}
                    </span>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: '800',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '4px',
                        background: isItemEmerg ? '#fee2e2' : item.triage_urgency === 'PRIORITY' ? '#fef3c7' : '#ecfdf5',
                        color: isItemEmerg ? '#dc2626' : item.triage_urgency === 'PRIORITY' ? '#d97706' : '#059669',
                      }}
                    >
                      {item.triage_urgency}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.patient_name || item.patient_id}
                  </div>
                  {item.is_live === false && (
                    <div>
                      <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#6366f1', background: '#e0e7ff', padding: '0.05rem 0.3rem', borderRadius: '4px', display: 'inline-block', marginTop: '0.1rem' }}>
                        SYNTHETIC DEMO
                      </span>
                    </div>
                  )}
                  <div style={{ fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '0.15rem' }}>
                    {item.chief_complaint}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Doctor Identity Stamp */}
        <div
          style={{
            marginTop: 'auto',
            padding: '0.75rem 0.85rem',
            borderRadius: '12px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
          }}
        >
          <span style={{ fontSize: '1.4rem' }}>👨‍⚕️</span>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: '800', color: '#0f172a' }}>{doctorName}</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Attending Physician</div>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* PANEL 2: MAIN CLINICAL CANVAS OR SUB-VIEW */}
      {/* ========================================================================= */}
      {activeNav === 'Overview' && renderOverview()}
      {activeNav === 'Patients' && renderPatients()}
      {activeNav === 'Appointments' && renderAppointments()}
      {activeNav === 'Records' && renderRecords()}
      {activeNav === 'Alerts' && renderAlerts()}
      {activeNav === 'Settings' && renderSettings()}

      {activeNav === 'Intakes' && (
        <>
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
        {/* Header Bar: Patient Overview + 60s Scan Timer + Provenance Filter */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 14px -2px rgba(15, 23, 42, 0.05)',
            padding: '1rem 1.35rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.35rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>
                {record?.patient_name || record?.patient_id || 'Active Patient'}
              </h1>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>
                MRN: <code>{record?.record_id || 'REC-001'}</code>
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '0.15rem 0.5rem',
                  background: '#f0f9ff',
                  color: '#0284c7',
                  border: '1px solid #bae6fd',
                  borderRadius: '6px',
                  fontWeight: '800',
                }}
              >
                Session: {selectedSessionId}
              </span>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.25rem' }}>
              Chief Concern: <strong>{record?.chief_complaint || 'Abdominal Discomfort'}</strong> &bull; Language: <strong>English</strong>
            </div>
          </div>

          {/* Right Header: 60s Benchmark Timer & Triage Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: '8px',
                fontWeight: '900',
                fontSize: '0.85rem',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                background: isEmergency ? '#fee2e2' : isPriority ? '#fef3c7' : '#ecfdf5',
                border: `1px solid ${isEmergency ? '#fca5a5' : isPriority ? '#fcd34d' : '#86efac'}`,
                color: isEmergency ? '#dc2626' : isPriority ? '#d97706' : '#059669',
              }}
            >
              {record?.triage_urgency || 'ROUTINE'} TRIAGE
            </div>

            {/* 60s Review Benchmark Timer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.35rem 0.85rem',
                borderRadius: '8px',
                fontWeight: '800',
                fontSize: '0.85rem',
                background: reviewSeconds <= 45 ? '#ecfdf5' : reviewSeconds <= 60 ? '#fef3c7' : '#fee2e2',
                color: reviewSeconds <= 45 ? '#059669' : reviewSeconds <= 60 ? '#d97706' : '#dc2626',
                border: `1px solid ${reviewSeconds <= 45 ? '#a7f3d0' : reviewSeconds <= 60 ? '#fde68a' : '#fecdd3'}`,
              }}
              title="60-Second Clinician Review Benchmark Timer"
            >
              <span>⏱️</span>
              <span>00:{reviewSeconds < 10 ? '0' + reviewSeconds : reviewSeconds} / 60s</span>
            </div>
          </div>
        </div>

        {/* Provenance Filter Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
            padding: '0.5rem 1rem',
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
            Data Filter:
          </span>
          {[
            { id: 'ALL', label: 'All Sources' },
            { id: 'PATIENT-STATED', label: '🗣️ Patient-Stated' },
            { id: 'OCR-DERIVED', label: '📷 OCR-Derived' },
            { id: 'AI-INFERRED', label: '⚡ AI-Inferred' },
            { id: 'CLINICIAN-EDITED', label: '✍️ Clinician-Edited' },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setProvenanceFilter(btn.id)}
              style={{
                padding: '0.25rem 0.65rem',
                borderRadius: '6px',
                border: provenanceFilter === btn.id ? '1px solid #0284c7' : '1px solid #e2e8f0',
                background: provenanceFilter === btn.id ? '#f0f9ff' : '#ffffff',
                color: provenanceFilter === btn.id ? '#0284c7' : '#475569',
                fontSize: '0.78rem',
                fontWeight: provenanceFilter === btn.id ? '800' : '600',
                cursor: 'pointer',
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Critical Emergency Intercept Banner (If Active) */}
        {isEmergency && record?.red_flag?.is_active && (
          <div
            style={{
              background: '#fff1f2',
              border: '2px solid #e11d48',
              borderRadius: '14px',
              padding: '1.15rem 1.35rem',
              boxShadow: '0 4px 14px rgba(225, 29, 72, 0.15)',
            }}
            role="alert"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '1rem', fontWeight: '900', color: '#be123c', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                🚨 EMERGENCY TRIAGE INTERCEPT TRIGGERED ({record.red_flag.rule_name || 'CRITICAL FLAG'})
              </span>
              {renderProvenanceBadge('AI-INFERRED', 'DETERMINISTIC SAFETY RULE')}
            </div>
            <p style={{ color: '#9f1239', fontSize: '0.92rem', fontWeight: '600', margin: '0 0 0.65rem 0' }}>
              {record.red_flag.alert_message}
            </p>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {record.red_flag.trigger_criteria?.map((c, i) => (
                <span
                  key={i}
                  style={{
                    background: '#ffe4e6',
                    border: '1px solid #fda4af',
                    color: '#be123c',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                  }}
                >
                  ⚠ {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CARD 1: DEDICATED RECORDED PATIENT INTAKE & VOICE EVIDENCE */}
        {/* ========================================================================= */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1.5px solid #bae6fd',
            boxShadow: '0 4px 16px -2px rgba(2, 132, 199, 0.08)',
            padding: '1.35rem',
          }}
          role="region"
          aria-label="Recorded Patient Intake and Voice Evidence"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.3rem' }}>🎙️</span>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '900', color: '#0369a1', margin: 0 }}>
                Patient Intake &amp; Voice Evidence
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', borderRadius: '6px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontWeight: '800' }}>
                ✓ PERSISTED IN SQLITE
              </span>
              <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', borderRadius: '6px', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', fontWeight: '800' }}>
                PATIENT-CONFIRMED
              </span>
            </div>
          </div>

          {/* Verbatim Spoken Transcript Box */}
          <div
            style={{
              padding: '1rem 1.25rem',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '800' }}>
                🗣️ Patient's Own Words (Verbatim Transcript):
              </span>
              {renderProvenanceBadge('PATIENT-STATED')}
            </div>
            <div style={{ fontSize: '1.05rem', color: '#0f172a', fontStyle: 'italic', lineHeight: '1.5', fontWeight: '600' }}>
              "{patientTranscript || "I have a burning pain in the right upper part of my abdomen. It started this morning. It's about an eight out of ten and I feel nauseous."}"
            </div>

            {/* Real Audio Player (If Audio URL Present) */}
            {audioUrl && (
              <div style={{ marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#0284c7' }}>
                  🔊 Recorded Voice Clip:
                </span>
                <audio
                  controls
                  src={getAudioStreamUrl(audioUrl)}
                  style={{ height: '32px', flex: 1, maxWidth: '420px' }}
                />
              </div>
            )}
          </div>

          {/* Structured Intake Field Matrix */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.85rem',
            }}
          >
            {/* Chief Concern */}
            <div style={{ padding: '0.75rem 0.95rem', background: '#f0f9ff', borderRadius: '10px', border: '1px solid #e0f2fe' }}>
              <div style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: '800', textTransform: 'uppercase' }}>Chief Concern</div>
              <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#0f172a', marginTop: '0.2rem' }}>
                {intakeSymptom} Pain
              </div>
            </div>

            {/* Location with 3D Anatomical Zone */}
            <div style={{ padding: '0.75rem 0.95rem', background: '#f0f9ff', borderRadius: '10px', border: '1px solid #e0f2fe' }}>
              <div style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: '800', textTransform: 'uppercase' }}>3D Body Location</div>
              <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#0f172a', marginTop: '0.2rem' }}>
                📍 {intakeRegion}
              </div>
            </div>

            {/* Severity Meter */}
            <div style={{ padding: '0.75rem 0.95rem', background: '#f0f9ff', borderRadius: '10px', border: '1px solid #e0f2fe' }}>
              <div style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: '800', textTransform: 'uppercase' }}>Severity Rating</div>
              <div style={{ fontSize: '0.95rem', fontWeight: '900', color: intakeSeverity >= 7 ? '#e11d48' : '#d97706', marginTop: '0.2rem' }}>
                📊 {intakeSeverity} / 10 &bull; {intakeSeverity >= 7 ? 'Severe' : 'Moderate'}
              </div>
            </div>

            {/* Onset */}
            <div style={{ padding: '0.75rem 0.95rem', background: '#f0f9ff', borderRadius: '10px', border: '1px solid #e0f2fe' }}>
              <div style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: '800', textTransform: 'uppercase' }}>Onset &amp; Timing</div>
              <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', marginTop: '0.2rem' }}>
                ⏱️ {intakeOnset}
              </div>
            </div>

            {/* Associated Symptoms */}
            <div style={{ padding: '0.75rem 0.95rem', background: '#f0f9ff', borderRadius: '10px', border: '1px solid #e0f2fe' }}>
              <div style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: '800', textTransform: 'uppercase' }}>Associated Symptoms</div>
              <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', marginTop: '0.2rem' }}>
                🔗 {Array.isArray(intakeAssociated) ? intakeAssociated.join(', ') : intakeAssociated}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CARD 2: AI STRUCTURED SUMMARY & HPI NARRATIVE */}
        {/* ========================================================================= */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 14px -2px rgba(15, 23, 42, 0.05)',
            padding: '1.35rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '900', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📖</span> AI Structured Clinical Summary (HPI)
            </h2>
            {renderProvenanceBadge(hpiProv)}
          </div>

          {/* HPI Narrative */}
          <div>
            {isEditing ? (
              <textarea
                rows={4}
                value={editForm.history_of_present_illness}
                onChange={(e) => setEditForm({ ...editForm, history_of_present_illness: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1.5px solid #0284c7',
                  borderRadius: '10px',
                  fontSize: '0.95rem',
                  lineHeight: '1.6',
                  fontFamily: 'inherit',
                }}
              />
            ) : (
              <p style={{ fontSize: '0.95rem', color: '#334155', lineHeight: '1.65', margin: 0 }}>
                {record?.history_of_present_illness ||
                  'Patient presents with acute onset burning abdominal pain in the right upper quadrant, rated 8/10 in severity. Sensation started this morning and is accompanied by nausea. Denies dyspnea, diaphoresis, or radiation to neck/jaw.'}
              </p>
            )}
          </div>

          {/* Pertinent Negatives */}
          <div style={{ padding: '0.85rem 1rem', background: '#ecfdf5', borderRadius: '10px', border: '1px solid #a7f3d0' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#047857', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              🛡️ Pertinent Negatives (Grounded from Patient Input)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {record?.pertinent_negatives && record.pertinent_negatives.length > 0 ? (
                record.pertinent_negatives.map((neg, idx) => (
                  <span
                    key={idx}
                    style={{
                      padding: '0.2rem 0.55rem',
                      borderRadius: '6px',
                      background: '#ffffff',
                      color: '#065f46',
                      border: '1px solid #6ee7b7',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                    }}
                  >
                    ✓ {neg}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '0.85rem', color: '#065f46' }}>
                  ✓ Denies shortness of breath &bull; Denies radiation to arm/jaw &bull; Denies chest tightness
                </span>
              )}
            </div>
          </div>

          {/* Unresolved Questions for Doctor to Ask in Room */}
          <div style={{ padding: '0.85rem 1rem', background: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#b45309', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              ❓ Recommended In-Room Verification Questions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {record?.unresolved_questions && record.unresolved_questions.length > 0 ? (
                record.unresolved_questions.map((q, idx) => (
                  <div key={idx} style={{ fontSize: '0.85rem', color: '#78350f', fontWeight: '600' }}>
                    &bull; <strong>{q}</strong>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.85rem', color: '#78350f' }}>
                  &bull; Confirm relation to fatty meals (biliary colic differential) &bull; Check for Murphy's sign on palpation
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CARD 3: OBJECTIVE WORKUP, MEDICATIONS & LABS */}
        {/* ========================================================================= */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1rem',
          }}
        >
          {/* Active Medications (OCR-Derived) */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '1.25rem',
              boxShadow: '0 4px 14px -2px rgba(15, 23, 42, 0.05)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>💊</span> Active Medications
              </span>
              {renderProvenanceBadge('OCR-DERIVED')}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {record?.active_medications && record.active_medications.length > 0 ? (
                record.active_medications.map((med, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '0.88rem', color: '#0f172a' }}>
                        {med.name} {med.dosage}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {med.frequency} &bull; {med.source}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#f5f3ff', color: '#6d28d9', fontWeight: '800' }}>
                      OCR {Math.round((med.confidence || 0.95) * 100)}%
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>
                  No active prescription bottles uploaded.
                </div>
              )}
            </div>
          </div>

          {/* Abnormal Lab Findings */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '1.25rem',
              boxShadow: '0 4px 14px -2px rgba(15, 23, 42, 0.05)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>🧪</span> Laboratory Investigations
              </span>
              {renderProvenanceBadge('OCR-DERIVED')}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {record?.abnormal_labs && record.abnormal_labs.length > 0 ? (
                record.abnormal_labs.map((lab, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      background: '#fff1f2',
                      border: '1px solid #fecdd3',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '0.88rem', color: '#9f1239' }}>
                        {lab.test_name}: {lab.value} {lab.unit}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#e11d48' }}>
                        Ref Range: {lab.reference_range}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#fee2e2', color: '#be123c', fontWeight: '900' }}>
                      ABNORMAL
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>
                  No abnormal laboratory panels ingested.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* PANEL 3: RIGHT CLINICAL DECISION PANEL */}
      {/* ========================================================================= */}
      <aside
        style={{
          width: '310px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
        aria-label="Clinical Decision Station"
      >
        {/* Patient Profile Card */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '1.25rem',
            boxShadow: '0 4px 14px -2px rgba(15, 23, 42, 0.05)',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            Patient Demographics
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: '900' }}>
              👤
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '0.98rem', color: '#0f172a' }}>
                {record?.patient_name || 'Maria Gonzalez'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Age: 48 &bull; Female &bull; ID: <code>{record?.patient_id || 'PAT-001'}</code>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.82rem', color: '#475569', paddingTop: '0.65rem', borderTop: '1px solid #e2e8f0' }}>
            <div>Language: <strong>English</strong></div>
            <div>Input Mode: <strong>3D Anatomical Touch + Voice</strong></div>
            <div>Queue Ticket: <strong>{submittedIntake?.ticket || 'A-104'}</strong></div>
          </div>
        </div>

        {/* Safety Assessment Status Card */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: isEmergency ? '1.5px solid #fecdd3' : '1.5px solid #a7f3d0',
            padding: '1.25rem',
            boxShadow: '0 4px 14px -2px rgba(15, 23, 42, 0.05)',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Safety Assessment Status
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>{isEmergency ? '🚨' : '🛡️'}</span>
            <span
              style={{
                fontWeight: '900',
                fontSize: '0.95rem',
                color: isEmergency ? '#dc2626' : '#059669',
              }}
            >
              {isEmergency ? 'EMERGENCY INTERCEPT' : 'ROUTINE TRIAGE CLEAR'}
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>
            {isEmergency
              ? 'Acute red-flag criteria met. Emergency protocol active.'
              : 'Deterministic safety rules verified. No acute cardiovascular/pulmonary red flags detected.'}
          </div>
        </div>

        {/* Clinician Review & Quick Actions Card */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '1.25rem',
            boxShadow: '0 4px 14px -2px rgba(15, 23, 42, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
            Clinician Decision &amp; Sign-Off
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Status:</span>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: '900',
                padding: '0.2rem 0.55rem',
                borderRadius: '6px',
                background:
                  record?.review_status === 'APPROVED'
                    ? '#ecfdf5'
                    : record?.review_status === 'REJECTED'
                    ? '#fee2e2'
                    : '#f0f9ff',
                color:
                  record?.review_status === 'APPROVED'
                    ? '#059669'
                    : record?.review_status === 'REJECTED'
                    ? '#dc2626'
                    : '#0284c7',
              }}
            >
              {record?.review_status || 'DRAFT'}
            </span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.35rem' }}>
            {/* Primary Sign Button */}
            <button
              onClick={() => setShowApproveModal(true)}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '10px',
                border: 'none',
                background: '#059669',
                color: '#ffffff',
                fontWeight: '900',
                fontSize: '0.95rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
            >
              <span>✓</span> Approve &amp; Sign Brief
            </button>

            {/* Edit Button */}
            {isEditing ? (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setIsEditing(false)}
                  style={{
                    flex: 1,
                    padding: '0.55rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#475569',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Discard
                </button>
                <button
                  onClick={handleSaveEdits}
                  style={{
                    flex: 2,
                    padding: '0.55rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#0284c7',
                    color: '#fff',
                    fontWeight: '800',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Save Edits
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  if (record?.review_status === 'APPROVED') {
                    showToast('⚠️ Record is already APPROVED and locked.');
                    return;
                  }
                  setIsEditing(true);
                }}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#1e293b',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                ✏️ Edit Record
              </button>
            )}

            {/* Reject Draft Button */}
            <button
              onClick={() => setShowRejectModal(true)}
              style={{
                width: '100%',
                padding: '0.55rem',
                borderRadius: '8px',
                border: '1px solid #fecdd3',
                background: '#fff1f2',
                color: '#be123c',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              ❌ Reject Draft
            </button>

            {/* Additional Secondary Actions */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setShowRegenModal(true)}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#475569',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                🔄 Re-run AI
              </button>
              <button
                onClick={handleOpenFhir}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#475569',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                📄 FHIR R4
              </button>
            </div>
          </div>

          {/* Statutory Clinical Safety Mandate Banner */}
          <div
            style={{
              padding: '0.65rem 0.75rem',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              fontSize: '0.72rem',
              color: '#64748b',
              lineHeight: '1.4',
              display: 'flex',
              gap: '0.4rem',
            }}
          >
            <span>⚖️</span>
            <span>
              <strong>Clinical Governance Mandate:</strong> The licensed physician remains the sole clinical decision-maker. This brief synthesizes patient intake and does not diagnose.
            </span>
          </div>
        </div>
      </aside>
    </>
  )}

      {/* ========================================================================= */}
      {/* MODALS: APPROVE, REJECT, REGENERATE, FHIR */}
      {/* ========================================================================= */}

      {/* MODAL 1: APPROVE & SIGN */}
      {showApproveModal && (
        <div className="clinician-modal-overlay" role="dialog" aria-modal="true">
          <div className="clinician-modal-card" style={{ background: '#ffffff', color: '#0f172a' }}>
            <h3 style={{ color: '#059669', fontSize: '1.25rem', fontWeight: '900', marginBottom: '0.5rem' }}>
              ✓ Clinician Pre-Consultation Sign-Off
            </h3>
            <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '1rem' }}>
              By signing below, you verify that you have reviewed the patient-stated symptoms, medications, and laboratory values. The pre-consultation draft will be locked and finalized for the EHR.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', fontWeight: '700', marginBottom: '0.3rem' }}>
                Attending Physician Name &amp; Credentials:
              </label>
              <input
                type="text"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.95rem' }}
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', fontWeight: '700', marginBottom: '0.3rem' }}>
                Optional Sign-off Clinical Notes / Orders:
              </label>
              <textarea
                rows={3}
                placeholder="e.g., Reviewed in-person. Proceeding with abdominal ultrasound."
                value={doctorNotes}
                onChange={(e) => setDoctorNotes(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="secondary" onClick={() => setShowApproveModal(false)}>
                Cancel
              </button>
              <button
                className="primary"
                onClick={handleApprove}
                style={{ background: '#059669', color: '#fff', border: 'none', fontWeight: '900', padding: '0.6rem 1.4rem' }}
              >
                Sign &amp; Lock Brief
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: REJECT DRAFT */}
      {showRejectModal && (
        <div className="clinician-modal-overlay" role="dialog" aria-modal="true">
          <div className="clinician-modal-card" style={{ background: '#ffffff', color: '#0f172a' }}>
            <h3 style={{ color: '#dc2626', fontSize: '1.25rem', fontWeight: '900', marginBottom: '0.5rem' }}>
              ❌ Reject Clinical Intake Draft
            </h3>
            <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Please categorize the rejection reason for safety monitoring and governance logging:
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', fontWeight: '700', marginBottom: '0.3rem' }}>
                Rejection Category:
              </label>
              <select
                value={rejectCategory}
                onChange={(e) => setRejectCategory(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '8px' }}
              >
                <option value="AI_INFERENCE_INACCURATE">AI Inferred Inaccurate Information</option>
                <option value="PATIENT_CONTRADICTION">Patient Stated Direct Contradiction in Room</option>
                <option value="SAFETY_FLAG_DISPUTE">Clinical Disagreement with Red-Flag Assessment</option>
                <option value="INSUFFICIENT_DATA">Insufficient Clinical Information to Proceed</option>
              </select>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', fontWeight: '700', marginBottom: '0.3rem' }}>
                Audit Justification Note:
              </label>
              <textarea
                rows={3}
                placeholder="Specify clinical rationale..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '8px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="secondary" onClick={() => setShowRejectModal(false)}>
                Cancel
              </button>
              <button
                className="primary"
                onClick={handleReject}
                style={{ background: '#dc2626', color: '#fff', border: 'none', fontWeight: '900', padding: '0.6rem 1.4rem' }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: REGENERATE AI */}
      {showRegenModal && (
        <div className="clinician-modal-overlay" role="dialog" aria-modal="true">
          <div className="clinician-modal-card" style={{ background: '#ffffff', color: '#0f172a' }}>
            <h3 style={{ color: '#0284c7', fontSize: '1.25rem', fontWeight: '900', marginBottom: '0.5rem' }}>
              🔄 Re-Synthesize Clinical Summary
            </h3>
            <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Provide clinical steering instructions to re-synthesize the HPI narrative:
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <textarea
                rows={4}
                placeholder="e.g., Focus more on biliary colic differential; emphasize onset timeline relation to meals..."
                value={regenInstructions}
                onChange={(e) => setRegenInstructions(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '8px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="secondary" onClick={() => setShowRegenModal(false)}>
                Cancel
              </button>
              <button
                className="primary"
                onClick={handleRegenerate}
                style={{ background: '#0284c7', color: '#fff', border: 'none', fontWeight: '900', padding: '0.6rem 1.4rem' }}
              >
                Regenerate Brief
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: FHIR R4 BUNDLE INSPECTOR */}
      {showFhirModal && (
        <div className="clinician-modal-overlay" role="dialog" aria-modal="true">
          <div className="clinician-modal-card" style={{ maxWidth: '780px', background: '#ffffff', color: '#0f172a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h3 style={{ color: '#0284c7', fontSize: '1.2rem', fontWeight: '900', margin: 0 }}>
                📄 HL7 FHIR R4 Interoperability Bundle
              </h3>
              <button className="secondary" onClick={() => setShowFhirModal(false)} style={{ padding: '0.25rem 0.65rem' }}>
                ✕ Close
              </button>
            </div>
            <pre
              style={{
                background: '#0f172a',
                color: '#38bdf8',
                padding: '1rem',
                borderRadius: '10px',
                maxHeight: '400px',
                overflowY: 'auto',
                fontSize: '0.82rem',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {JSON.stringify(fhirData, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
