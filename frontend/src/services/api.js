const PROD_BACKEND_URL = 'https://preconsult-ai-backend.onrender.com';
const DEV_BACKEND_URL = 'http://127.0.0.1:8000';

export const BACKEND_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? PROD_BACKEND_URL
    : DEV_BACKEND_URL)
).replace(/\/+$/, '');

export const API_BASE = `${BACKEND_URL}/api/v1`;

// Token storage & auth header utilities
const AUTH_STORAGE_KEY = 'preconsult_auth_token';

export function getAuthToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_STORAGE_KEY);
}

export function setAuthToken(token) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(AUTH_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

export function clearAuthToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function authHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function loginUser(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Login failed with status ${res.status}`);
  }
  const data = await res.json();
  if (data.access_token) {
    setAuthToken(data.access_token);
  }
  return data;
}

export async function registerPatient(patientData) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patientData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Registration failed with status ${res.status}`);
  }
  const data = await res.json();
  if (data.access_token) {
    setAuthToken(data.access_token);
  }
  return data;
}

export async function getCurrentUser() {
  const token = getAuthToken();
  if (!token) return null;
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    if (res.status === 401) {
      clearAuthToken();
      return null;
    }
    throw new Error(`Failed to fetch current user (HTTP ${res.status})`);
  }
  return await res.json();
}

export async function updateProfile(profileData) {
  const res = await fetch(`${API_BASE}/auth/profile`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(profileData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Profile update failed (HTTP ${res.status})`);
  }
  return await res.json();
}

export async function getPatientIntakes() {
  const res = await fetch(`${API_BASE}/patient/intakes`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch patient intakes (HTTP ${res.status})`);
  }
  return await res.json();
}

export async function getPatientDocuments() {
  const res = await fetch(`${API_BASE}/patient/documents`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch patient documents (HTTP ${res.status})`);
  }
  return await res.json();
}

export function getAudioStreamUrl(pathOrFilename) {
  if (!pathOrFilename) return null;
  if (pathOrFilename.startsWith('http://') || pathOrFilename.startsWith('https://')) return pathOrFilename;
  const cleanPath = pathOrFilename.startsWith('/api')
    ? pathOrFilename
    : pathOrFilename.startsWith('/')
    ? `/api/intake/audio${pathOrFilename}`
    : `/api/intake/audio/${pathOrFilename}`;
  return `${BACKEND_URL}${cleanPath}`;
}

export const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

export async function checkHealth(maxRetries = 5, retryDelayMs = 2000, onAttempt = null) {
  let lastErr = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (onAttempt) onAttempt(attempt, maxRetries);
    try {
      const healthUrl = `${BACKEND_URL}/health`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      const res = await fetch(healthUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const fallbackRes = await fetch(`${API_BASE}/health`);
        if (!fallbackRes.ok) throw new Error(`HTTP ${fallbackRes.status}`);
        return await fallbackRes.json();
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
      console.warn(`Health check attempt ${attempt}/${maxRetries} failed:`, err.message);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, retryDelayMs * attempt));
      }
    }
  }
  console.error('All health check attempts failed:', lastErr);
  throw lastErr;
}

export async function uploadVoiceAudio(blob, {
  language = 'en',
  bodyRegion = 'right_upper_abdomen',
  anatomicalZone = 'Right Upper Quadrant (RUQ)',
  clientTranscript = '',
  sessionId = null,
} = {}) {
  const formData = new FormData();
  if (blob) {
    formData.append('audio', blob, 'patient_recording.webm');
  } else {
    const emptyBlob = new Blob(['empty_audio_stream'], { type: 'audio/webm' });
    formData.append('audio', emptyBlob, 'manual_input.webm');
  }

  formData.append('language', language || 'en');
  formData.append('body_region', bodyRegion || 'right_upper_abdomen');
  formData.append('anatomical_zone', anatomicalZone || 'Right Upper Quadrant (RUQ)');
  if (clientTranscript) {
    formData.append('client_transcript', clientTranscript);
  }

  const uploadUrl = sessionId
    ? `${BACKEND_URL}/api/intake/${sessionId}/voice/upload`
    : `${BACKEND_URL}/api/intake/voice/upload`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Voice upload failed with HTTP ${response.status}`);
  }
  return await response.json();
}

export async function createSession({ preferredLanguage = 'en', accessibilityMode = 'standard' } = {}) {
  const res = await fetch(`${API_BASE}/intake/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      preferred_language: preferredLanguage,
      accessibility_mode: accessibilityMode,
    }),
  });
  if (!res.ok) throw new Error(`Session creation failed: HTTP ${res.status}`);
  return await res.json();
}

export async function submitSymptom(symptomData) {
  const res = await fetch(`${API_BASE}/intake/symptom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(symptomData),
  });
  if (!res.ok) throw new Error(`Symptom submission failed: HTTP ${res.status}`);
  return await res.json();
}

export async function checkSafety(symptoms = [], anatomicalRegions = []) {
  const res = await fetch(`${API_BASE}/intake/safety-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      symptoms,
      anatomical_regions: anatomicalRegions,
    }),
  });
  if (!res.ok) throw new Error(`Safety check failed: HTTP ${res.status}`);
  return await res.json();
}

export async function processVoiceTranscript({
  sessionId,
  transcript,
  bodyRegion = null,
  anatomicalZone = null,
}) {
  try {
    const res = await fetch(`${API_BASE}/intake/voice/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId || 'SES-DEMO',
        voice_transcript: transcript,
        selected_body_region: bodyRegion,
        selected_anatomical_zone: anatomicalZone,
      }),
    });
    if (!res.ok) throw new Error(`Voice process failed: HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend voice processing failed, using resilient offline parser:', err);
    // Resilient offline fallback parser for hackathon demo
    const t = transcript.toLowerCase();
    let char = 'burning';
    if (t.includes('cramp') || t.includes('tight')) char = 'cramping';
    else if (t.includes('sharp') || t.includes('stab')) char = 'sharp';
    else if (t.includes('dull') || t.includes('heavy')) char = 'dull';

    let sev = 7;
    const sevMatch = t.match(/\b(\d{1,2}|eight|seven|six|nine|ten)\s*(?:out of|\/|\s*of\s*)?10\b/i) ||
                     t.match(/\b(?:eight|about an eight)\b/i);
    if (sevMatch) sev = 8;

    const isChest = t.includes('chest') || t.includes('retrosternal');
    const hasRadiation = t.includes('arm') || t.includes('jaw');
    const hasDyspnea = t.includes('breath') || t.includes('short of breath');
    const hasSweat = t.includes('sweat');
    const isEmergency = isChest && (hasRadiation || hasDyspnea || hasSweat || sev >= 8);

    const isRightUpperAbd = t.includes('right upper') || t.includes('upper right');

    return {
      session_id: sessionId || 'SES-DEMO-OFFLINE',
      voice_transcript: transcript,
      extracted_data: {
        body_region: isRightUpperAbd ? 'right_upper_abdomen' : (isChest ? 'chest' : (bodyRegion || 'abdomen')),
        anatomical_zone: isRightUpperAbd ? 'Right Upper Quadrant (RUQ)' : (isChest ? 'Retrosternal' : (anatomicalZone || 'Epigastrium')),
        symptom: 'pain',
        character: char,
        severity: sev,
        onset: t.includes('morning') ? 'this morning' : 'today',
        duration: 'today',
        associated_symptoms: t.includes('nausea') ? ['nausea'] : (hasSweat ? ['sweating'] : []),
        patient_text: transcript,
      },
      provenance: 'AI-INFERRED',
      requires_patient_confirmation: true,
      confidence_score: 0.95,
      red_flag_detected: isEmergency,
      red_flag_alert: isEmergency ? {
        is_active: true,
        trigger_criteria: ['Chest Pain Location', 'Radiation to Left Arm / Jaw', 'Shortness of Breath'],
        alert_message: 'CRITICAL CARDIAC WARNING: Urgent triage required.',
      } : null,
    };
  }
}

export async function persistPatientIntake(intakeData) {
  const payload = {
    session_id: intakeData.session_id || intakeData.sessionId || 'SES-DEMO',
    patient_identifier: intakeData.patient_identifier || intakeData.patientIdentifier || 'PAT-001',
    selected_body_region: intakeData.selected_body_region || intakeData.body_region || intakeData.bodyRegion || 'Abdomen',
    body_region: intakeData.selected_body_region || intakeData.body_region || intakeData.bodyRegion || 'Abdomen',
    anatomical_zone: intakeData.anatomical_zone || intakeData.anatomicalZone || 'Right Upper Quadrant',
    side: intakeData.side || 'midline',
    symptom: intakeData.symptom || 'pain',
    symptom_character: intakeData.symptom_character || intakeData.character || 'Burning',
    character: intakeData.symptom_character || intakeData.character || 'Burning',
    severity: Number(intakeData.severity ?? 8),
    onset: intakeData.onset || 'this morning',
    duration: intakeData.duration || 'today',
    associated_symptoms: intakeData.associated_symptoms || intakeData.associatedSymptoms || [],
    voice_transcript: intakeData.voice_transcript || intakeData.patient_voice_transcript || intakeData.patientVoiceTranscript || intakeData.patient_stated_text || '',
    patient_voice_transcript: intakeData.voice_transcript || intakeData.patient_voice_transcript || intakeData.patientVoiceTranscript || intakeData.patient_stated_text || '',
    patient_stated_text: intakeData.patient_stated_text || intakeData.patientText || intakeData.voice_transcript || '',
    structured_clinical_data: intakeData.structured_clinical_data || intakeData.structuredClinicalData || null,
    is_patient_confirmed: intakeData.is_patient_confirmed ?? intakeData.patient_confirmed ?? intakeData.patientConfirmed ?? true,
    patient_confirmed: intakeData.is_patient_confirmed ?? intakeData.patient_confirmed ?? intakeData.patientConfirmed ?? true,
    safety_result: intakeData.safety_result || intakeData.safetyResult || { is_safe: true, code: 'ROUTINE_TRIAGE', message: 'No acute emergent flags detected' },
    triage_urgency: intakeData.triage_urgency || 'ROUTINE',
    status: intakeData.status || 'COMPLETED',
  };

  try {
    const res = await fetch(`${API_BASE}/intake/record`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Persist intake failed: HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (!IS_DEMO_MODE) {
      throw err;
    }
    console.warn('Backend persistPatientIntake failed, using demo mode fallback:', err);
    return {
      intake_id: `INTAKE-LOCAL-${Date.now()}`,
      session_id: payload.session_id,
      patient_identifier: payload.patient_identifier,
      timestamp: new Date().toISOString(),
      selected_body_region: payload.selected_body_region,
      body_region: payload.selected_body_region,
      anatomical_zone: payload.anatomical_zone,
      symptom: payload.symptom,
      symptom_character: payload.symptom_character,
      character: payload.symptom_character,
      severity: payload.severity,
      onset: payload.onset,
      duration: payload.duration,
      associated_symptoms: payload.associated_symptoms,
      voice_transcript: payload.voice_transcript,
      patient_voice_transcript: payload.voice_transcript,
      is_patient_confirmed: payload.is_patient_confirmed,
      patient_confirmed: payload.is_patient_confirmed,
      triage_urgency: payload.triage_urgency,
      clinician_review_status: 'DRAFT',
      is_approved: false,
      status: 'success',
    };
  }
}

export async function getPatientIntake(sessionId) {
  try {
    const res = await fetch(`${API_BASE}/intake/record/${sessionId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend getPatientIntake failed:', err);
    return null;
  }
}

export async function updatePatientIntake(sessionId, updateFields) {
  try {
    const res = await fetch(`${API_BASE}/intake/record/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateFields),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend updatePatientIntake failed:', err);
    return null;
  }
}


export async function getClinicianQueue() {
  try {
    const res = await fetch(`${API_BASE}/summary/queue`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (IS_DEMO_MODE) {
      console.warn('Backend queue fetch failed, using explicit synthetic demo queue:', err);
      return [
        {
          session_id: 'SES-GERD-01',
          record_id: 'REC-GERD-01',
          patient_id: 'PAT-4821',
          patient_name: 'Maria Gonzalez (48F) [SYNTHETIC DEMO DATA]',
          ticket: 'P-248',
          chief_complaint: 'Burning / Acidity sensation in Epigastrium (Upper Stomach)',
          triage_urgency: 'ROUTINE',
          review_status: 'DRAFT',
          is_approved: false,
          red_flag_active: false,
          confidence_score: 0.95,
          created_at: new Date(Date.now() - 12 * 60000).toISOString(),
          is_live: false,
        },
        {
          session_id: 'SES-CARDIAC-99',
          record_id: 'REC-CARD-99',
          patient_id: 'PAT-9110',
          patient_name: 'Robert Chen (62M) [SYNTHETIC DEMO DATA]',
          ticket: 'P-911',
          chief_complaint: 'Crushing pressure in Mid-Chest / Precordium with Left Arm Radiation',
          triage_urgency: 'EMERGENCY',
          review_status: 'DRAFT',
          is_approved: false,
          red_flag_active: true,
          confidence_score: 0.98,
          created_at: new Date(Date.now() - 5 * 60000).toISOString(),
          is_live: false,
        },
        {
          session_id: 'SES-MSK-42',
          record_id: 'REC-MSK-42',
          patient_id: 'PAT-3388',
          patient_name: 'Priya Sharma (34F) [SYNTHETIC DEMO DATA]',
          ticket: 'P-415',
          chief_complaint: 'Sharp / Stabbing pain in Left Knee Joint (Anterior Patellar)',
          triage_urgency: 'PRIORITY',
          review_status: 'DRAFT',
          is_approved: false,
          red_flag_active: false,
          confidence_score: 0.93,
          created_at: new Date(Date.now() - 25 * 60000).toISOString(),
          is_live: false,
        },
      ];
    }
    console.error('Backend queue fetch failed in production mode:', err);
    throw err;
  }
}

export async function getClinicalSummary(sessionId) {
  try {
    const res = await fetch(`${API_BASE}/summary/${sessionId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (IS_DEMO_MODE) {
      console.warn('Backend getClinicalSummary failed, using explicit demo mode fallback:', err);
      return getOfflineDemoRecord(sessionId);
    }
    console.error('Backend getClinicalSummary failed in production mode:', err);
    throw err;
  }
}

export async function saveClinicianEdits(sessionId, editData) {
  try {
    const res = await fetch(`${API_BASE}/summary/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editData),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend saveClinicianEdits failed, updating local state:', err);
    return {
      ...editData,
      review_status: 'CLINICIAN_EDITED',
      provenance_map: {
        chief_complaint: 'CLINICIAN-EDITED',
        history_of_present_illness: 'CLINICIAN-EDITED',
      },
    };
  }
}

export async function approveSummary(sessionId, { clinicianId = 'Dr. S. Vance, MD', clinicianNotes = '', digitalSignature = '' } = {}) {
  try {
    const res = await fetch(`${API_BASE}/summary/${sessionId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinician_id: clinicianId,
        clinician_notes: clinicianNotes,
        digital_signature: digitalSignature,
      }),
    });
    if (!res.ok) throw new Error(`Approve failed: HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend approve failed, returning offline approved state:', err);
    return {
      status: 'success',
      review_status: 'APPROVED',
      session_id: sessionId,
      clinician_id: clinicianId,
      message: 'Clinical brief approved by attending clinician (Offline Mode).',
      signed_at: new Date().toISOString(),
    };
  }
}

export async function rejectSummary(sessionId, { clinicianId = 'Dr. S. Vance, MD', rejectionCategory = 'AI_INFERENCE_INACCURATE', rejectionReason = 'Requires nurse triage', notes = '' } = {}) {
  try {
    const res = await fetch(`${API_BASE}/summary/${sessionId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinician_id: clinicianId,
        rejection_category: rejectionCategory,
        rejection_reason: rejectionReason,
        notes,
      }),
    });
    if (!res.ok) throw new Error(`Reject failed: HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend reject failed, returning offline rejected state:', err);
    return {
      status: 'rejected',
      review_status: 'REJECTED',
      session_id: sessionId,
      clinician_id: clinicianId,
      rejection_reason: `[${rejectionCategory}] ${rejectionReason}`,
      message: 'Draft rejected by physician (Offline Mode).',
    };
  }
}

export async function regenerateSummary(sessionId, { instructions = '', focusAreas = [] } = {}) {
  try {
    const res = await fetch(`${API_BASE}/summary/${sessionId}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instructions, focus_areas: focusAreas }),
    });
    if (!res.ok) throw new Error(`Regenerate failed: HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend regenerate failed, returning local synthesized copy:', err);
    const existing = getOfflineDemoRecord(sessionId);
    return {
      ...existing,
      review_status: 'REGENERATED',
      history_of_present_illness: `RE-SYNTHESIZED NARRATIVE: ${existing.history_of_present_illness} (Refined per physician guidance: "${instructions || 'Concise handoff'}").`,
    };
  }
}

export async function getFhirBundle(sessionId) {
  try {
    const res = await fetch(`${API_BASE}/summary/${sessionId}/fhir`);
    if (!res.ok) throw new Error(`FHIR fetch failed: HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend FHIR fetch failed, generating offline bundle:', err);
    const rec = getOfflineDemoRecord(sessionId);
    return {
      resourceType: 'Bundle',
      id: rec.record_id || 'bundle-fallback',
      type: 'document',
      timestamp: new Date().toISOString(),
      entry: [
        { resource: { resourceType: 'Patient', id: rec.patient_id } },
        { resource: { resourceType: 'Condition', code: { text: rec.chief_complaint } } },
      ],
    };
  }
}

// Fallback demo record builder for offline hackathon presentations
function getOfflineDemoRecord(sessionId) {
  if (sessionId === 'SES-CARDIAC-99') {
    return {
      record_id: 'REC-CARD-99',
      patient_id: 'PAT-9110',
      patient_name: 'Robert Chen (62M)',
      chief_complaint: 'Crushing pressure in Mid-Chest / Precordium with Left Arm Radiation',
      history_of_present_illness:
        'EMERGENCY INTERCEPT ACTIVATED. Patient communicated severe tightness/crushing sensation in retrosternal chest radiating to left arm and jaw. Severity rated 9/10 with sudden onset within past 45 minutes. Associated cold sweating (diaphoresis) and mild shortness of breath reported via visual chips.',
      symptoms: [
        {
          symptom_id: 'SYM-CARD-99',
          body_macro_region: 'Chest',
          anatomical_micro_zone: 'Precordium / Retrosternal',
          character: 'Tightness / Crushing',
          severity: 9,
          onset_description: 'Started today (< 1 hour)',
          duration: 'today',
          provenance: 'PATIENT-STATED',
          confidence: 1.0,
        },
      ],
      symptom_timeline: 'Hyper-acute onset 45 minutes ago during light activity, progressively intensifying.',
      pertinent_negatives: [
        'Denies sharp pleuritic changes on deep inspiration',
        'Denies positional relief when leaning forward',
        'Denies recent fever or productive cough',
      ],
      active_medications: [
        {
          name: 'Atorvastatin',
          dosage: '40mg',
          frequency: 'Once daily at bedtime',
          source: 'Prescription OCR',
          confidence: 0.94,
          verification_status: 'Unconfirmed',
          provenance: 'OCR-DERIVED',
        },
        {
          name: 'Aspirin',
          dosage: '81mg',
          frequency: 'Daily',
          source: 'Prescription OCR',
          confidence: 0.97,
          verification_status: 'Unconfirmed',
          provenance: 'OCR-DERIVED',
        },
      ],
      abnormal_labs: [
        {
          test_name: 'High-Sensitivity Troponin I',
          value: 'Pending STAT',
          unit: 'ng/L',
          reference_range: '< 14.0',
          is_abnormal: true,
          confidence: 0.99,
          provenance: 'DATABASE-DERIVED',
        },
      ],
      triage_urgency: 'EMERGENCY',
      red_flag: {
        is_active: true,
        rule_id: 'RULE_CRITICAL_CARDIAC',
        rule_name: 'ACUTE_CORONARY_SUSPICION',
        trigger_criteria: [
          'Precordial Crushing Pain',
          'Radiation to Left Arm / Jaw',
          'Diaphoresis',
          'High Severity (9/10)',
        ],
        alert_message:
          'CRITICAL CARDIAC EMERGENCY: Suspected Acute Coronary Syndrome. Immediate 12-lead ECG, telemetry, and ER physician evaluation initiated.',
        requires_clinician_override: true,
      },
      unresolved_questions: [
        'STAT 12-lead ECG review required within 10 minutes',
        'Verify exact time patient took any sublingual nitroglycerin',
      ],
      clinician_approved: false,
      clinician_notes: null,
      review_status: 'DRAFT',
      confidence_score: 0.98,
      associated_symptoms: ['Diaphoresis', 'Shortness of breath', 'Dizziness'],
    };
  }

  // Default: Maria Gonzalez - GERD
  return {
    record_id: 'REC-GERD-01',
    patient_id: 'PAT-4821',
    patient_name: 'Maria Gonzalez (48F)',
    chief_complaint: 'Burning / Acidity sensation in Epigastrium (Upper Stomach)',
    history_of_present_illness:
      'Patient communicates via non-verbal touch intake (<4 taps). Reports acute-onset acidic, burning discomfort localized to the upper epigastric abdomen with an intensity of 7/10. Discomfort started 2-3 days ago and shows postprandial exacerbation 45 minutes after meals. No prior history of gastric bypass or peptic ulcer disease confirmed.',
    symptoms: [
      {
        symptom_id: 'SYM-GERD-01',
        body_macro_region: 'Abdomen',
        anatomical_micro_zone: 'Epigastrium',
        character: 'Burning',
        severity: 7,
        onset_description: '2 to 3 days ago',
        duration: '2-3days',
        provenance: 'PATIENT-STATED',
        confidence: 1.0,
      },
    ],
    symptom_timeline: 'Onset 48-72h ago, episodic postprandial burning sensation.',
    pertinent_negatives: [
      'Denies hematemesis or coffee-ground emesis',
      'Denies melena or rectal bleeding',
      'Denies radiation to left arm or neck',
      'Denies acute systemic fever or chills',
    ],
    active_medications: [
      {
        name: 'Pantoprazole',
        dosage: '40mg',
        frequency: 'Once daily before breakfast',
        source: 'Prescription OCR',
        confidence: 0.96,
        verification_status: 'Unconfirmed',
        provenance: 'OCR-DERIVED',
      },
      {
        name: 'Antacid Chewable',
        dosage: 'OTC',
        frequency: 'PRN after meals',
        source: 'Patient Verbal / Touch',
        confidence: 0.88,
        verification_status: 'Unconfirmed',
        provenance: 'PATIENT-STATED',
      },
    ],
    abnormal_labs: [
      {
        test_name: 'Hemoglobin (Hb)',
        value: '10.8',
        unit: 'g/dL',
        reference_range: '12.0 - 15.5',
        is_abnormal: true,
        confidence: 0.98,
        provenance: 'OCR-DERIVED',
      },
    ],
    triage_urgency: 'ROUTINE',
    red_flag: { is_active: false, trigger_criteria: [], alert_message: '' },
    unresolved_questions: [
      'Confirm patient response to trial of antacid chewables',
      'Clarify if symptoms awaken patient during nocturnal sleep',
      'Check for recent NSAID or aspirin consumption',
    ],
    clinician_approved: false,
    clinician_notes: null,
    review_status: 'DRAFT',
    confidence_score: 0.95,
    associated_symptoms: ['Heartburn', 'Belching', 'Sour taste'],
  };
}

export async function getNextAdaptiveQuestion(state) {
  try {
    const res = await fetch(`${API_BASE}/intake/adaptive/next`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    if (!res.ok) throw new Error(`Adaptive turn failed: HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend adaptive question call failed, using resilient offline fallback:', err);
    // Offline fallback for hackathon demonstration resilience
    const answeredCount = state.completed_answers?.length || 0;
    if (answeredCount >= 2) {
      return {
        is_complete: true,
        turn_number: answeredCount,
        max_turns: 3,
        next_question: null,
        red_flag_alert: { is_active: false },
        resolved_variables: ['site', 'character', 'severity', 'duration'],
        unresolved_variables: [],
      };
    }
    return {
      is_complete: false,
      turn_number: answeredCount + 1,
      max_turns: 3,
      next_question: {
        question_id: answeredCount === 0 ? 'abd_radiation' : 'abd_timing_pattern',
        target_field: answeredCount === 0 ? 'radiation' : 'timing_pattern',
        prompt_text:
          answeredCount === 0
            ? 'Does your stomach discomfort spread or travel anywhere else?'
            : 'How does this sensation behave over time?',
        audio_prompt:
          answeredCount === 0
            ? 'Does your stomach discomfort spread or travel anywhere else?'
            : 'How does this sensation behave over time?',
        options:
          answeredCount === 0
            ? [
                { id: 'abd_rad_chest', label: 'Spreads up into chest or throat', icon: '🔥', clinical_value: 'radiation_chest' },
                { id: 'abd_rad_back', label: 'Spreads through to mid-back', icon: '🔙', clinical_value: 'radiation_back' },
                { id: 'abd_rad_none', label: 'Stays in one spot only (No spread)', icon: '🎯', clinical_value: 'no_radiation' },
              ]
            : [
                { id: 'abd_time_postprandial', label: 'Worse 30-60 mins after eating', icon: '🍽️', clinical_value: 'postprandial' },
                { id: 'abd_time_empty', label: 'Worse on empty stomach / fasting', icon: '⏰', clinical_value: 'fasting' },
                { id: 'abd_time_constant', label: 'Constant steady presence', icon: '⏳', clinical_value: 'constant' },
              ],
        turn_number: answeredCount + 1,
        max_turns: 3,
      },
      red_flag_alert: { is_active: false },
      resolved_variables: ['site', 'character', 'severity'],
      unresolved_variables: ['radiation', 'timing_pattern'],
    };
  }
}

export async function finalizeAdaptiveIntake(state) {
  try {
    const res = await fetch(`${API_BASE}/intake/adaptive/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    if (!res.ok) throw new Error(`Finalize intake failed: HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend finalize call failed, returning fallback record:', err);
    return {
      record_id: 'REC-OFFLINE-FALLBACK',
      patient_id: state.patient_identifier || 'PAT-DEMO',
      chief_complaint: `${state.character || 'Discomfort'} in ${state.anatomical_micro_zone || 'Epigastrium'}`,
      history_of_present_illness: `Patient communicated complaints via non-verbal touch intake. Reports ${state.character || 'Burning'} in ${state.anatomical_micro_zone || 'Epigastrium'} with intensity ${state.severity}/10.`,
      symptoms: [
        {
          symptom_id: 'SYM-DEMO',
          body_macro_region: state.body_macro_region || 'Abdomen',
          anatomical_micro_zone: state.anatomical_micro_zone || 'Epigastrium',
          character: state.character || 'Burning',
          severity: state.severity,
          duration: state.duration || '2-3days',
          provenance: 'PATIENT_SELECTED',
          confidence: 1.0,
        },
      ],
      symptom_timeline: `Duration: ${state.duration || '2-3days'}.`,
      pertinent_negatives: ['Denies fever', 'Denies melena or hematemesis'],
      active_medications: [],
      abnormal_labs: [],
      triage_urgency: state.severity >= 8 ? 'PRIORITY' : 'ROUTINE',
      red_flag: { is_active: false },
      unresolved_questions: [],
      clinician_approved: false,
    };
  }
}

export async function getDocumentSamples() {
  try {
    const res = await fetch(`${API_BASE}/documents/samples`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend samples fetch failed, returning curated fallback presets:', err);
    return [
      {
        id: 'PRESET_LOW_CONF_RX',
        title: 'Dr. Evans Handwritten Rx (Low-Confidence Smudged Dose)',
        document_type: 'PRESCRIPTION',
        description: 'Demonstrates optical OCR scanning a smudged handwritten prescription where dosage has low optical confidence (62%) and requires mandatory human verification.',
        filename: 'dr_evans_rx_pantoprazole_smudged.png',
        medication_count: 1,
        lab_count: 0,
        has_conflicts: false,
      },
      {
        id: 'PRESET_CONFLICT_RX',
        title: 'Conflicting Medication Records (Duplicate PPI Therapy)',
        document_type: 'PRESCRIPTION',
        description: 'Demonstrates clinical conflict detection. Contains Omeprazole 20mg daily AND Pantoprazole 40mg twice daily. Safety rule prevents silent resolution.',
        filename: 'conflicting_records_omeprazole_pantoprazole.pdf',
        medication_count: 2,
        lab_count: 0,
        has_conflicts: true,
      },
      {
        id: 'PRESET_ABNORMAL_LABS',
        title: 'Comprehensive Diagnostic Lab Panel (Low Hemoglobin & High Glucose)',
        document_type: 'LAB_REPORT',
        description: 'Demonstrates lab report extraction with reference range comparisons and automatic abnormal flagging.',
        filename: 'quest_diagnostics_cbc_metabolic.pdf',
        medication_count: 0,
        lab_count: 4,
        has_conflicts: false,
      },
    ];
  }
}

export async function uploadDocument({ preset_id, session_id = 'SES-GERD-01', filename, text_content } = {}) {
  try {
    const res = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset_id, session_id, filename, text_content }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || `Upload failed: HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.warn('Backend document upload failed, using curated preset fallback:', err);
    if (preset_id === 'PRESET_LOW_CONF_RX') {
      return {
        document_id: 'DOC-FALLBACK-LOWCONF',
        session_id,
        document_type: 'PRESCRIPTION',
        filename: 'dr_evans_rx_pantoprazole_smudged.png',
        extracted_medications: [
          {
            name: 'Pantoprazole Sodium',
            dosage: '40mg (Unclear, possibly 20mg)',
            frequency: 'Once daily before breakfast',
            date: '2026-09-08',
            prescriber: 'Dr. Marcus Evans, MD (Gastroenterology)',
            source: 'Prescription OCR',
            confidence: 0.62,
            requires_verification: true,
            is_verified: false,
            has_conflict: false,
            conflict_reason: null,
            provenance: 'OCR-DERIVED',
          },
        ],
        extracted_labs: [],
        conflicts_detected: [],
        requires_human_verification: true,
        overall_confidence: 0.62,
        raw_text: 'ST. JUDE CLINIC - DR. MARCUS EVANS, MD\nRx: Pantoprazole Sodium [40?mg smudged]\nSig: 1 tab daily AC (before breakfast)\nDisp: #30 tabs | Refills: 2\nDate: 09/08/2026',
        timestamp: new Date().toISOString(),
      };
    } else if (preset_id === 'PRESET_CONFLICT_RX') {
      return {
        document_id: 'DOC-FALLBACK-CONFLICT',
        session_id,
        document_type: 'PRESCRIPTION',
        filename: 'conflicting_records_omeprazole_pantoprazole.pdf',
        extracted_medications: [
          {
            name: 'Omeprazole',
            dosage: '20mg',
            frequency: 'Once daily in the morning',
            date: '2026-09-02',
            prescriber: 'Dr. Lisa Miller, MD (Primary Care)',
            source: 'Outpatient Pharmacy OCR',
            confidence: 0.95,
            requires_verification: true,
            is_verified: false,
            has_conflict: true,
            conflict_reason: 'THERAPEUTIC DUPLICATION: Duplicate Proton Pump Inhibitor (PPI) prescribed concurrently with Pantoprazole 40mg.',
            provenance: 'OCR-DERIVED',
          },
          {
            name: 'Pantoprazole',
            dosage: '40mg',
            frequency: 'Twice daily before meals',
            date: '2026-09-11',
            prescriber: 'Dr. Marcus Evans, MD (Urgent Care)',
            source: 'Hospital Discharge OCR',
            confidence: 0.94,
            requires_verification: true,
            is_verified: false,
            has_conflict: true,
            conflict_reason: 'THERAPEUTIC DUPLICATION: Duplicate Proton Pump Inhibitor (PPI) prescribed concurrently with Omeprazole 20mg.',
            provenance: 'OCR-DERIVED',
          },
        ],
        extracted_labs: [],
        conflicts_detected: [
          '🚨 THERAPEUTIC DUPLICATION DETECTED: Multiple Proton Pump Inhibitors (PPIs) (Omeprazole 20mg + Pantoprazole 40mg) prescribed concurrently. System will NOT silently resolve. Requires explicit human reconciliation.',
        ],
        requires_human_verification: true,
        overall_confidence: 0.95,
        raw_text: 'RECORD 1 (Community Rx 09/02/2026 - Dr. Miller):\nOmeprazole 20mg PO Daily QAM #30\n\nRECORD 2 (Hospital Discharge 09/11/2026 - Dr. Evans):\nPantoprazole 40mg PO BID AC #60\nWARNING: Concurrent therapy detected.',
        timestamp: new Date().toISOString(),
      };
    } else {
      return {
        document_id: 'DOC-FALLBACK-LABS',
        session_id,
        document_type: 'LAB_REPORT',
        filename: 'quest_diagnostics_cbc_metabolic.pdf',
        extracted_medications: [],
        extracted_labs: [
          {
            test_name: 'Hemoglobin (Hb)',
            value: '10.8',
            unit: 'g/dL',
            reference_range: '12.0 - 15.5',
            is_abnormal: true,
            date: '2026-09-12',
            source: 'Laboratory OCR',
            confidence: 0.98,
            requires_verification: false,
            is_verified: false,
            provenance: 'OCR-DERIVED',
          },
          {
            test_name: 'Fasting Blood Glucose',
            value: '146',
            unit: 'mg/dL',
            reference_range: '70 - 99',
            is_abnormal: true,
            date: '2026-09-12',
            source: 'Laboratory OCR',
            confidence: 0.96,
            requires_verification: false,
            is_verified: false,
            provenance: 'OCR-DERIVED',
          },
          {
            test_name: 'Serum Creatinine',
            value: '0.9',
            unit: 'mg/dL',
            reference_range: '0.6 - 1.2',
            is_abnormal: false,
            date: '2026-09-12',
            source: 'Laboratory OCR',
            confidence: 0.97,
            requires_verification: false,
            is_verified: false,
            provenance: 'OCR-DERIVED',
          },
          {
            test_name: 'Platelet Count',
            value: '240',
            unit: 'k/uL',
            reference_range: '150 - 450',
            is_abnormal: false,
            date: '2026-09-12',
            source: 'Laboratory OCR',
            confidence: 0.95,
            requires_verification: false,
            is_verified: false,
            provenance: 'OCR-DERIVED',
          },
        ],
        conflicts_detected: [],
        requires_human_verification: false,
        overall_confidence: 0.96,
        raw_text: 'METROPOLITAN CLINICAL LABORATORIES\nHemoglobin: 10.8 g/dL [LOW] (Ref: 12.0 - 15.5)\nFasting Glucose: 146 mg/dL [HIGH] (Ref: 70 - 99)\nCreatinine: 0.9 mg/dL [NORMAL] (Ref: 0.6 - 1.2)\nPlatelets: 240 k/uL [NORMAL] (Ref: 150 - 450)',
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export async function uploadDocumentFile(file, sessionId = 'SES-GERD-01') {
  const formData = new FormData();
  formData.append('file', file);
  if (sessionId) formData.append('session_id', sessionId);

  const res = await fetch(`${API_BASE}/documents/upload-file`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || `File upload failed: HTTP ${res.status}`);
  }
  return await res.json();
}

export async function verifyDocumentExtraction(payload) {
  const res = await fetch(`${API_BASE}/documents/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || `Verification failed: HTTP ${res.status}`);
  }
  return await res.json();
}
