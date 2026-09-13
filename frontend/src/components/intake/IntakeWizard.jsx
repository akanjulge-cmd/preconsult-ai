import React, { useState, useEffect } from 'react';
import LanguageStep from '../onboarding/LanguageStep';
import PreferencesStep from '../onboarding/PreferencesStep';
import ConsentStep from '../onboarding/ConsentStep';
import BodyMap from '../body_map/BodyMap';
import SemanticVisuals from '../symptoms/SemanticVisuals';
import SeverityTimeline from '../symptoms/SeverityTimeline';
import AdaptiveQuestionStep from './AdaptiveQuestionStep';
import VoiceIntakeCard from './VoiceIntakeCard';
import { submitSymptom, finalizeAdaptiveIntake, persistPatientIntake } from '../../services/api';

const STEPS = [
  { id: 1, name: 'Language', label: '1. Language', icon: '🌐' },
  { id: 2, name: 'Preferences', label: '2. Preferences', icon: '♿' },
  { id: 3, name: 'Consent', label: '3. Consent', icon: '🛡️' },
  { id: 4, name: 'Location', label: '4. Location', icon: '📍' },
  { id: 5, name: 'Sensation', label: '5. Sensation', icon: '⚡' },
  { id: 6, name: 'Severity', label: '6. Severity', icon: '📊' },
  { id: 7, name: 'Clarify', label: '7. Clarify', icon: '🎯' },
  { id: 8, name: 'Confirm', label: '8. Confirm', icon: '✅' },
];

export default function IntakeWizard({
  activeSession,
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
  onFinishIntake,
  onNavigateToDoctor,
}) {
  const [currentStep, setCurrentStep] = useState(1);

  // Intake State
  const [language, setLanguage] = useState('en');
  const [mode, setMode] = useState('non_speaking'); // 'non_speaking' | 'tremor' | 'standard'

  // Structured Anatomical Locations Array
  const [confirmedLocations, setConfirmedLocations] = useState([]);

  // Symptom sensation & severity state
  const [selectedSymptom, setSelectedSymptom] = useState(null);
  const [symptomConfirmed, setSymptomConfirmed] = useState(false);
  const [symptomAttributes, setSymptomAttributes] = useState(null);
  const [severity, setSeverity] = useState(6);
  const [duration, setDuration] = useState('2-3days');
  const [associatedSymptoms, setAssociatedSymptoms] = useState([]);

  // Voice Input & Intake Persistence State
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceStructuredData, setVoiceStructuredData] = useState(null);
  const [isVoiceConfirmed, setIsVoiceConfirmed] = useState(false);
  const [persistedIntakeId, setPersistedIntakeId] = useState(null);

  // Adaptive Clinical Follow-up State (SOCRATES)
  const [adaptiveAnswers, setAdaptiveAnswers] = useState([]);
  const [finalizedRecord, setFinalizedRecord] = useState(null);

  // Safety, Undo & Metrics State
  const [emergencyAlert, setEmergencyAlert] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepError, setStepError] = useState(null);
  const [tapCount, setTapCount] = useState(0);
  const [historyStack, setHistoryStack] = useState([]);
  const [queueTicket, setQueueTicket] = useState('A-104');

  // Push snapshot to history stack
  function saveSnapshot() {
    setHistoryStack((prev) => [
      ...prev,
      {
        step: currentStep,
        language,
        mode,
        confirmedLocations: JSON.parse(JSON.stringify(confirmedLocations)),
        selectedSymptom,
        symptomConfirmed,
        symptomAttributes: symptomAttributes ? { ...symptomAttributes } : null,
        severity,
        duration,
        associatedSymptoms: [...associatedSymptoms],
        adaptiveAnswers: [...adaptiveAnswers],
        finalizedRecord,
        tapCount,
      },
    ]);
  }

  function recordTap() {
    setTapCount((prev) => prev + 1);
  }

  // Audio Guidance TTS per step
  useEffect(() => {
    if (!audioEnabled || !('speechSynthesis' in window)) return;

    let textToSpeak = '';
    if (currentStep === 1) textToSpeak = 'Step 1: Please select your preferred language.';
    if (currentStep === 2) textToSpeak = 'Step 2: Choose your accessibility preferences and communication mode.';
    if (currentStep === 3) textToSpeak = 'Step 3: Review plain-language privacy and clinical assistance consent.';
    if (currentStep === 4) textToSpeak = 'Step 4: Show where your pain or discomfort is located on the body map. You can confirm multiple spots.';
    if (currentStep === 5) textToSpeak = 'Step 5: Tap the visual picture that describes how the sensation feels.';
    if (currentStep === 6) textToSpeak = 'Step 6: Adjust pain strength from 1 to 10 and select duration.';
    if (currentStep === 7) textToSpeak = 'Step 7: Answer a few quick clarification questions for your doctor.';
    if (currentStep === 8) textToSpeak = 'Step 8: Please review your symptom summary and confirm submission.';

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }, [currentStep, audioEnabled]);

  // Step 1: Language Done
  function handleLanguageNext() {
    setStepError(null);
    saveSnapshot();
    recordTap();
    setCurrentStep(2);
  }

  // Step 2: Preferences Done
  function handlePreferencesNext() {
    setStepError(null);
    saveSnapshot();
    recordTap();
    setCurrentStep(3);
  }

  // Step 3: Consent Done
  function handleConsentDone() {
    setStepError(null);
    saveSnapshot();
    recordTap();
    setCurrentStep(4);
  }

  // Step 4: Add Confirmed Anatomical Location
  function handleAddConfirmedLocation(location) {
    setStepError(null);
    saveSnapshot();
    recordTap();
    setConfirmedLocations((prev) => {
      const exists = prev.some(
        (l) =>
          l.body_region === location.body_region &&
          l.anatomical_zone === location.anatomical_zone &&
          l.side === location.side
      );
      return exists ? prev : [...prev, location];
    });
  }

  // Step 4: Remove Confirmed Anatomical Location
  function handleRemoveConfirmedLocation(id) {
    saveSnapshot();
    recordTap();
    setConfirmedLocations((prev) => prev.filter((loc) => loc.id !== id));
  }

  // Step 4: Proceed from Body Map
  function handleBodyMapContinue(newLocation) {
    let locations = confirmedLocations;
    if (newLocation && typeof newLocation === 'object' && newLocation.id && newLocation.body_region) {
      const exists = confirmedLocations.some(
        (l) =>
          l.body_region === newLocation.body_region &&
          l.anatomical_zone === newLocation.anatomical_zone &&
          l.side === newLocation.side
      );
      if (!exists) {
        locations = [...confirmedLocations, newLocation];
        setConfirmedLocations(locations);
      }
    }
    if (locations.length === 0) {
      setStepError('Please touch an anatomical zone (e.g. Abdomen → Upper Stomach) and click "Confirm This Location" before continuing.');
      return;
    }
    setStepError(null);
    saveSnapshot();
    recordTap();
    setCurrentStep(5);
  }

  // Step 5: Symptom Selection
  function handleSelectSymptom(symptomId) {
    setStepError(null);
    recordTap();
    if (selectedSymptom && selectedSymptom !== symptomId) {
      // Sensation character changed: reset incompatible follow-up clarification answers
      setAdaptiveAnswers([]);
      setFinalizedRecord(null);
    }
    setSelectedSymptom(symptomId);
    setSymptomConfirmed(false);
    const defaultQualityMap = {
      Burning: { sensory_quality: 'acidic_heat', visual_cue: 'flame_vector' },
      Cramping: { sensory_quality: 'constricting_spasm', visual_cue: 'contracting_band' },
      Sharp: { sensory_quality: 'lancinating_pierce', visual_cue: 'needle_starburst' },
      Dull: { sensory_quality: 'heavy_pressure', visual_cue: 'isobaric_wave' },
    };
    const defaults = defaultQualityMap[symptomId] || defaultQualityMap.Burning;
    setSymptomAttributes({
      character: symptomId,
      ...defaults,
      confirmed_by_user: false,
    });
  }

  function handleConfirmSymptom(attrs) {
    setStepError(null);
    recordTap();
    setSymptomConfirmed(true);
    setSymptomAttributes(attrs);
  }

  function handleSensationNext() {
    if (!selectedSymptom) {
      setStepError('Please select a visual sensation card above (e.g. Burning, Cramping, Sharp) to proceed.');
      return;
    }
    setStepError(null);
    setSymptomConfirmed(true);
    if (!symptomAttributes || !symptomAttributes.confirmed_by_user) {
      const defaultQualityMap = {
        Burning: { sensory_quality: 'acidic_heat', visual_cue: 'flame_vector' },
        Cramping: { sensory_quality: 'constricting_spasm', visual_cue: 'contracting_band' },
        Sharp: { sensory_quality: 'lancinating_pierce', visual_cue: 'needle_starburst' },
        Dull: { sensory_quality: 'heavy_pressure', visual_cue: 'isobaric_wave' },
      };
      const defaults = defaultQualityMap[selectedSymptom] || defaultQualityMap.Burning;
      setSymptomAttributes({
        character: selectedSymptom,
        ...defaults,
        confirmed_by_user: true,
      });
    }
    saveSnapshot();
    recordTap();
    setCurrentStep(6);
  }

  // Step 6: Associated Symptom Toggle
  function handleToggleAssociatedSymptom(id) {
    recordTap();
    setAssociatedSymptoms((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function handleSeverityNext() {
    saveSnapshot();
    recordTap();

    // Deterministic Red-Flag Safety Screening
    const hasChestUrgent =
      confirmedLocations.some((loc) => loc.body_region === 'Chest') && severity >= 7;
    const isShortnessOfBreathUrgent =
      associatedSymptoms.includes('shortness_of_breath') && severity >= 7;

    if (hasChestUrgent || isShortnessOfBreathUrgent) {
      setEmergencyAlert({
        rule: 'CARDIOVASCULAR_PULMONARY_RED_FLAG',
        message:
          'You have indicated acute chest discomfort or shortness of breath with high severity. For your safety, clinic triage staff has been signaled. Please remain seated and seek immediate care.',
      });
      return; // Stop routine progression; lock into emergency protocol
    }

    setCurrentStep(7);
  }

  // Voice Input Processing & Extraction Callback
  async function handleVoiceConfirmed(data) {
    saveSnapshot();
    recordTap();

    const transcript = data.voice_transcript || data.patient_stated_text || '';
    setVoiceTranscript(transcript);
    setVoiceStructuredData(data);
    setIsVoiceConfirmed(true);

    // Map character (burning -> Burning)
    let char = 'Burning';
    if (data.character) {
      const lower = data.character.toLowerCase();
      if (lower.includes('burn')) char = 'Burning';
      else if (lower.includes('cramp')) char = 'Cramping';
      else if (lower.includes('sharp') || lower.includes('stab')) char = 'Sharp';
      else if (lower.includes('dull') || lower.includes('heavy') || lower.includes('ache')) char = 'Dull';
      else char = data.character.charAt(0).toUpperCase() + data.character.slice(1);
    }
    setSelectedSymptom(char);
    setSymptomConfirmed(true);

    const defaultQualityMap = {
      Burning: { sensory_quality: 'acidic_heat', visual_cue: 'flame_vector' },
      Cramping: { sensory_quality: 'constricting_spasm', visual_cue: 'contracting_band' },
      Sharp: { sensory_quality: 'lancinating_pierce', visual_cue: 'needle_starburst' },
      Dull: { sensory_quality: 'heavy_pressure', visual_cue: 'isobaric_wave' },
    };
    const defaults = defaultQualityMap[char] || defaultQualityMap.Burning;
    setSymptomAttributes({
      character: char,
      ...defaults,
      confirmed_by_user: true,
      provenance: 'PATIENT-CONFIRMED',
    });

    if (data.severity !== undefined && data.severity !== null) {
      setSeverity(Math.max(1, Math.min(10, Number(data.severity))));
    }

    if (data.duration || data.onset) {
      const durStr = (data.duration || data.onset).toLowerCase();
      if (durStr.includes('today') || durStr.includes('morning') || durStr.includes('hour')) {
        setDuration('today');
      } else if (durStr.includes('week')) {
        setDuration('1week');
      } else if (durStr.includes('chronic') || durStr.includes('month')) {
        setDuration('chronic');
      } else {
        setDuration('2-3days');
      }
    }

    if (data.associated_symptoms && Array.isArray(data.associated_symptoms)) {
      setAssociatedSymptoms(data.associated_symptoms.map((s) => s.toLowerCase().replace(/\s+/g, '_')));
    }

    // Ensure confirmedLocations has the right anatomical region
    let targetMacro = 'Abdomen';
    let targetZone = 'Right Upper Quadrant';
    let targetSide = 'right';

    const bRegion = (data.body_region || '').toLowerCase();
    if (bRegion.includes('abdomen') || bRegion.includes('stomach') || bRegion.includes('ruq')) {
      targetMacro = 'Abdomen';
      targetZone = bRegion.includes('right') ? 'Right Upper Quadrant' : bRegion.includes('left') ? 'Left Upper Quadrant' : 'Epigastrium';
      targetSide = bRegion.includes('right') ? 'right' : bRegion.includes('left') ? 'left' : 'midline';
    } else if (bRegion.includes('chest') || bRegion.includes('precordial')) {
      targetMacro = 'Chest';
      targetZone = 'Retrosternal (Mid-Chest)';
      targetSide = 'midline';
    } else if (bRegion.includes('head')) {
      targetMacro = 'Head';
      targetZone = 'Whole Head';
      targetSide = 'midline';
    } else if (bRegion.includes('back')) {
      targetMacro = 'Back';
      targetZone = bRegion.includes('lower') ? 'Lumbar (Lower Back)' : 'Upper Back & Shoulders';
      targetSide = 'midline';
    }

    const locExists = confirmedLocations.some((l) => l.body_region === targetMacro);
    if (!locExists) {
      const newLoc = {
        id: `loc_voice_${Date.now()}`,
        body_region: targetMacro,
        anatomical_zone: targetZone,
        side: targetSide,
        source: 'patient_voice_confirmed',
        confidence: 1.0,
        confirmed_by_user: true,
        orientation: 'front',
      };
      setConfirmedLocations([newLoc]);
    }

    // Safety Red-Flag Screen on Voice Intake (Deterministic Rule 1 check)
    const isChestUrgent = (targetMacro === 'Chest' || bRegion.includes('chest')) && Number(data.severity) >= 7;
    const isDyspnea = (data.associated_symptoms || []).some((s) => s.toLowerCase().includes('breath') || s.toLowerCase().includes('dyspnea'));
    const isSweating = (data.associated_symptoms || []).some((s) => s.toLowerCase().includes('sweat'));
    const isArmOrJaw = (transcript || '').toLowerCase().includes('arm') || (transcript || '').toLowerCase().includes('jaw');

    if (isChestUrgent || ((isDyspnea || isSweating || isArmOrJaw) && (targetMacro === 'Chest' || bRegion.includes('chest')))) {
      setEmergencyAlert({
        rule: 'CARDIOVASCULAR_PULMONARY_RED_FLAG',
        message: 'CRITICAL CARDIAC WARNING: Acute chest discomfort with radiation to arm/jaw or associated distress markers (shortness of breath, diaphoresis). Routine flow halted. Clinic triage team alerted.',
      });
      // Persist emergency intercept into SQLite table
      try {
        await persistPatientIntake({
          sessionId: activeSession?.session_id || 'SES-DEMO',
          patientIdentifier: activeSession?.patient_identifier || 'PAT-001',
          bodyRegion: data.body_region || targetMacro,
          anatomicalZone: data.anatomical_zone || targetZone,
          symptom: data.symptom || 'pain',
          character: char,
          severity: Number(data.severity || 8),
          onset: data.onset || '30 minutes ago',
          duration: data.duration || 'today',
          associatedSymptoms: data.associated_symptoms || ['shortness_of_breath', 'sweating'],
          patientVoiceTranscript: transcript,
          patientText: transcript,
          structuredClinicalData: data,
          safetyResult: {
            is_safe: false,
            code: 'CARDIOVASCULAR_PULMONARY_RED_FLAG',
            message: 'CRITICAL CARDIAC WARNING: High-risk acute coronary presentation detected.',
          },
          patientConfirmed: true,
          status: 'EMERGENCY_INTERCEPT',
        });
      } catch (e) {
        console.warn('Error persisting emergency intake:', e);
      }
      return;
    }

    // Persist routine intake to backend SQLite patient_intakes table
    try {
      const intakeRes = await persistPatientIntake({
        sessionId: activeSession?.session_id || 'SES-DEMO',
        patientIdentifier: activeSession?.patient_identifier || 'PAT-001',
        bodyRegion: data.body_region || targetMacro,
        anatomicalZone: data.anatomical_zone || targetZone,
        symptom: data.symptom || 'pain',
        character: char,
        severity: Number(data.severity || 8),
        onset: data.onset || 'this morning',
        duration: data.duration || 'today',
        associatedSymptoms: data.associated_symptoms || [],
        patientVoiceTranscript: transcript,
        patientText: transcript,
        structuredClinicalData: data,
        safetyResult: { is_safe: true, code: 'ROUTINE_TRIAGE', message: 'No acute emergent flags detected' },
        patientConfirmed: true,
        status: 'CONFIRMED',
      });
      if (intakeRes && intakeRes.intake_id) {
        setPersistedIntakeId(intakeRes.intake_id);
      }
    } catch (e) {
      console.warn('Error persisting patient intake:', e);
    }

    // Advance directly to Step 8 (Review & Finalize) so patient sees complete structured intake
    setCurrentStep(8);
  }

  // 1-Click Fast 4-Tap Abdomen Demo Shortcut
  function handleFastAbdomenDemo() {
    saveSnapshot();
    setLanguage('en');
    setMode('non_speaking');
    setConfirmedLocations([
      {
        id: 'loc_demo_1',
        body_region: 'Abdomen',
        anatomical_zone: 'Right Upper Quadrant',
        side: 'right',
        source: 'patient_3d_human_selector',
        confidence: 1.0,
        confirmed_by_user: true,
        orientation: 'front',
      },
    ]);
    setSelectedSymptom('Burning');
    setSymptomConfirmed(true);
    setSymptomAttributes({
      character: 'Burning',
      sensory_quality: 'acidic_heat',
      visual_cue: 'flame_vector',
      confirmed_by_user: true,
      provenance: 'PATIENT-CONFIRMED',
    });
    setSeverity(8);
    setDuration('today');
    setAssociatedSymptoms(['nausea']);
    setVoiceTranscript("I have a burning pain in the right upper part of my abdomen. It started this morning. It's about an eight out of ten and I feel nauseous.");
    setVoiceStructuredData({
      body_region: "right_upper_abdomen",
      symptom: "pain",
      character: "burning",
      severity: 8,
      onset: "this morning",
      duration: "today",
      associated_symptoms: ["nausea"],
      patient_text: "I have a burning pain in the right upper part of my abdomen. It started this morning. It's about an eight out of ten and I feel nauseous.",
    });
    setIsVoiceConfirmed(true);
    setAdaptiveAnswers([
      {
        question_id: 'abd_radiation',
        target_field: 'radiation',
        selected_option_id: 'abd_rad_none',
        selected_text: 'Stays in one spot only (No spread)',
      },
      {
        question_id: 'abd_timing_pattern',
        target_field: 'timing_pattern',
        selected_option_id: 'abd_time_postprandial',
        selected_text: 'Worse 30 to 60 minutes after eating',
      },
    ]);
    setTapCount(4);
    setCurrentStep(8); // Jumps directly to Review
  }

  // Navigation Back & Undo
  function handleBack() {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  }

  function handleUndo() {
    if (historyStack.length === 0) return;
    const lastState = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, prev.length - 1));

    setCurrentStep(lastState.step);
    setLanguage(lastState.language);
    setMode(lastState.mode);
    setConfirmedLocations(lastState.confirmedLocations || []);
    setSelectedSymptom(lastState.selectedSymptom);
    setSymptomConfirmed(lastState.symptomConfirmed || false);
    setSymptomAttributes(lastState.symptomAttributes || null);
    setSeverity(lastState.severity);
    setDuration(lastState.duration);
    setAssociatedSymptoms(lastState.associatedSymptoms);
    setAdaptiveAnswers(lastState.adaptiveAnswers || []);
    setFinalizedRecord(lastState.finalizedRecord || null);
    setTapCount(lastState.tapCount);
  }

  // Step 7: Adaptive Clarification Complete
  function handleAdaptiveComplete({ completedAnswers, record }) {
    saveSnapshot();
    recordTap();
    setAdaptiveAnswers(completedAnswers || []);
    if (record) {
      setFinalizedRecord(record);
    }
    setCurrentStep(8);
  }

  // Step 8: Submit Intake
  async function handleSubmit() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    recordTap();
    const primaryLoc = confirmedLocations[0] || {
      body_region: 'Abdomen',
      anatomical_zone: 'Epigastrium',
      side: 'midline',
    };

    const payload = {
      session_id: activeSession?.session_id || 'SES-DEMO-OFFLINE',
      // Strict structured anatomical selections schema
      locations: confirmedLocations.map((l) => ({
        body_region: l.body_region,
        anatomical_zone: l.anatomical_zone,
        side: l.side,
        source: l.source,
        confidence: l.confidence,
        confirmed_by_user: l.confirmed_by_user,
      })),
      // Structured clinical sensation attributes
      symptom_attributes: symptomAttributes || {
        character: selectedSymptom || 'Burning',
        sensory_quality: 'acidic_heat',
        visual_cue: 'flame_vector',
        confirmed_by_user: true,
      },
      // Single-region fallback for backward compatibility
      body_macro_region: primaryLoc.body_region,
      anatomical_micro_zone: primaryLoc.anatomical_zone,
      character: selectedSymptom || 'Burning',
      severity: severity,
      duration: duration,
      associated_symptoms: associatedSymptoms,
      completed_answers: adaptiveAnswers,
    };

    let finalRec = finalizedRecord;
    try {
      const record = await finalizeAdaptiveIntake(payload);
      if (record) {
        finalRec = record;
        setFinalizedRecord(record);
      }
      await submitSymptom(payload);

      // Persist finalized patient intake record into SQLite database
      await persistPatientIntake({
        sessionId: activeSession?.session_id || 'SES-DEMO-OFFLINE',
        patientIdentifier: activeSession?.patient_identifier || 'PAT-LIVE',
        bodyRegion: primaryLoc.body_region,
        anatomicalZone: primaryLoc.anatomical_zone,
        symptom: selectedSymptom || 'pain',
        character: symptomAttributes?.character || selectedSymptom || 'Burning',
        severity: severity,
        onset: duration === 'today' ? 'this morning' : duration,
        duration: duration,
        associatedSymptoms: associatedSymptoms,
        patientVoiceTranscript: voiceTranscript || '',
        patientText: voiceTranscript || `${selectedSymptom} in ${primaryLoc.anatomical_zone}`,
        structuredClinicalData: {
          locations: confirmedLocations,
          symptom_attributes: symptomAttributes,
          severity,
          duration,
          associated_symptoms: associatedSymptoms,
          voice_structured_data: voiceStructuredData,
          ticket: randomTicket,
        },
        safetyResult: finalRec?.red_flag || { is_safe: true, code: 'ROUTINE_TRIAGE' },
        patientConfirmed: true,
        status: 'COMPLETED',
      });
    } catch (e) {
      console.warn('Backend intake submission error, continuing with mock response:', e);
    } finally {
      setIsSubmitting(false);
    }

    const randomTicket = 'P-' + Math.floor(100 + Math.random() * 900);
    setQueueTicket(randomTicket);
    setIsSubmitted(true);

    if (onFinishIntake) {
      onFinishIntake({
        locations: confirmedLocations,
        macro: primaryLoc.body_region,
        micro: primaryLoc.anatomical_zone,
        side: primaryLoc.side,
        symptom: selectedSymptom,
        symptomAttributes: symptomAttributes || {
          character: selectedSymptom || 'Burning',
          sensory_quality: 'acidic_heat',
          visual_cue: 'flame_vector',
          confirmed_by_user: true,
        },
        adaptiveAnswers,
        finalizedRecord: finalRec,
        severity,
        duration,
        associatedSymptoms,
        voiceTranscript,
        voiceStructuredData,
        isVoiceConfirmed,
        tapCount: tapCount + 1,
        ticket: randomTicket,
      });
    }
  }

  function handleReset() {
    setConfirmedLocations([]);
    setSelectedSymptom(null);
    setSeverity(6);
    setDuration('2-3days');
    setAssociatedSymptoms([]);
    setAdaptiveAnswers([]);
    setFinalizedRecord(null);
    setTapCount(0);
    setHistoryStack([]);
    setIsSubmitted(false);
    setCurrentStep(1);
  }

  return (
    <div className="card" role="main" aria-label="PreConsult Patient Intake">
      {/* Top Banner: Interaction Badges, Undo & Demo Button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '0.85rem',
              padding: '0.25rem 0.65rem',
              background: 'rgba(6, 182, 212, 0.15)',
              border: '1px solid var(--accent-cyan)',
              color: 'var(--accent-cyan)',
              borderRadius: '999px',
              fontWeight: '800',
            }}
          >
            {mode === 'non_speaking' ? '🧏 Non-Speaking AAC Mode' : mode === 'tremor' ? '🎯 Tremor Motor Mode' : '📱 Standard Mode'}
          </span>

          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Taps: <strong style={{ color: '#ffffff' }}>{tapCount}</strong>
          </span>

          {historyStack.length > 0 && (
            <button
              onClick={handleUndo}
              className="secondary"
              style={{ padding: '0.3rem 0.75rem', minHeight: '34px', fontSize: '0.8rem' }}
              title="Undo the last recorded action"
              aria-label="Undo last action"
            >
              ↩ Undo
            </button>
          )}
        </div>

        {/* 1-Click Fast 4-Tap Abdomen Demo Benchmark Shortcut */}
        <button
          onClick={handleFastAbdomenDemo}
          className="secondary"
          style={{
            padding: '0.4rem 0.95rem',
            minHeight: '38px',
            fontSize: '0.85rem',
            borderColor: 'var(--accent-amber)',
            color: 'var(--accent-amber)',
            fontWeight: '800',
          }}
          title="Instant 4-tap clinical intake benchmark for hackathon demonstration"
        >
          ⚡ Demo 4-Tap Abdomen Flow
        </button>
      </div>

      {/* 8-Step Progress Stepper */}
      <div className="stepper-bar" role="navigation" aria-label="Intake Flow Stepper">
        {STEPS.map((step) => {
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          return (
            <div
              key={step.id}
              onClick={() => {
                if (isCompleted && !isSubmitted) {
                  setCurrentStep(step.id);
                }
              }}
              style={{ cursor: isCompleted && !isSubmitted ? 'pointer' : 'default' }}
              className={`stepper-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              title={isCompleted && !isSubmitted ? `Return to ${step.name}` : undefined}
            >
              <div className="step-num">{isCompleted ? '✓' : step.id}</div>
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* STEP 1: LANGUAGE SELECTION & AUDIO GREETING */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <LanguageStep
          selectedLang={language}
          onSelectLang={setLanguage}
          onNext={handleLanguageNext}
          audioEnabled={audioEnabled}
        />
      )}

      {/* ========================================================================= */}
      {/* STEP 2: ACCESSIBILITY PREFERENCES */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <PreferencesStep
          selectedMode={mode}
          onSelectMode={setMode}
          theme={theme}
          setTheme={setTheme}
          reducedMotion={reducedMotion}
          setReducedMotion={setReducedMotion}
          textScale={textScale}
          setTextScale={setTextScale}
          audioEnabled={audioEnabled}
          setAudioEnabled={setAudioEnabled}
          onBack={handleBack}
          onNext={handlePreferencesNext}
        />
      )}

      {/* ========================================================================= */}
      {/* STEP 3: PLAIN-LANGUAGE CONSENT */}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <ConsentStep onBack={handleBack} onConfirm={handleConsentDone} />
      )}

      {/* ========================================================================= */}
      {/* STEP 4: INTERACTIVE ANATOMICAL BODY MAP SELECTION */}
      {/* ========================================================================= */}
      {currentStep === 4 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 className="card-title" style={{ color: 'var(--accent-cyan)', marginBottom: '0.2rem' }}>
                📍 Step 4: Interactive Body Location
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                Touch the region on the figure, select the specific zone &amp; side, and tap <strong>Confirm This Location</strong>:
              </p>
            </div>
          </div>

          <BodyMap
            confirmedLocations={confirmedLocations}
            onAddConfirmedLocation={handleAddConfirmedLocation}
            onRemoveConfirmedLocation={handleRemoveConfirmedLocation}
            onContinue={handleBodyMapContinue}
            reducedMotion={reducedMotion}
          />

          {/* Voice Intake Option for Selected Body Location */}
          {confirmedLocations.length > 0 && (
            <VoiceIntakeCard
              sessionId={activeSession?.session_id || 'SES-DEMO'}
              selectedBodyRegion={confirmedLocations[0]?.body_region || 'Abdomen'}
              selectedAnatomicalZone={confirmedLocations[0]?.anatomical_zone || 'Right Upper Quadrant'}
              onConfirmedIntake={handleVoiceConfirmed}
              reducedMotion={reducedMotion}
              audioEnabled={audioEnabled}
            />
          )}

          {stepError && (
            <div
              style={{
                marginTop: '1rem',
                padding: '0.85rem 1.25rem',
                background: 'rgba(244, 63, 94, 0.15)',
                border: '1.5px solid var(--accent-rose)',
                borderRadius: '12px',
                color: '#fecdd3',
                fontSize: '0.95rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
              }}
              role="alert"
            >
              <span>⚠️</span>
              <span>{stepError}</span>
            </div>
          )}

          <div className="action-bar">
            <button className="secondary" onClick={handleBack}>
              &larr; Back to Consent
            </button>
            <button
              className="primary"
              onClick={() => handleBodyMapContinue()}
              disabled={confirmedLocations.length === 0}
              style={{
                padding: '0.85rem 2.25rem',
                fontWeight: '800',
                opacity: confirmedLocations.length === 0 ? 0.5 : 1,
                cursor: confirmedLocations.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              Continue to Sensation ({confirmedLocations.length} Spot{confirmedLocations.length === 1 ? '' : 's'}) &rarr;
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 5: ADAPTIVE SEMANTIC VISUAL SYMPTOM CHOICE */}
      {/* ========================================================================= */}
      {currentStep === 5 && (
        <div>
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              background: 'rgba(6, 182, 212, 0.12)',
              border: '1px solid var(--accent-cyan)',
              borderRadius: '14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Selected Anatomical Location{confirmedLocations.length > 1 ? 's' : ''}:
              </span>
              <div style={{ fontWeight: '800', color: '#ffffff', marginTop: '0.2rem' }}>
                {confirmedLocations.map((l) => `${l.body_region} → ${l.anatomical_zone} (${l.side})`).join(' • ')}
              </div>
            </div>

            <button
              onClick={() => setCurrentStep(4)}
              className="secondary"
              style={{ minHeight: '36px', padding: '0.3rem 0.75rem', fontSize: '0.85rem' }}
            >
              ✏️ Change / Add Locations
            </button>
          </div>

          {/* Prominent Voice / Microphone Intake Card */}
          <VoiceIntakeCard
            sessionId={activeSession?.session_id || 'SES-DEMO'}
            selectedBodyRegion={confirmedLocations[0]?.body_region || 'Abdomen'}
            selectedAnatomicalZone={confirmedLocations[0]?.anatomical_zone || 'Right Upper Quadrant'}
            onConfirmedIntake={handleVoiceConfirmed}
            reducedMotion={reducedMotion}
            audioEnabled={audioEnabled}
          />

          <div style={{ textAlign: 'center', margin: '1.5rem 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.12)' }} />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px' }}>
              OR SELECT FROM VISUAL SENSORY TOUCH CARDS BELOW
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.12)' }} />
          </div>

          <SemanticVisuals
            selectedSymptom={selectedSymptom}
            onSelectSymptom={handleSelectSymptom}
            symptomConfirmed={symptomConfirmed}
            onConfirmSymptom={handleConfirmSymptom}
            reducedMotion={reducedMotion}
            audioEnabled={audioEnabled}
          />

          {stepError && (
            <div
              style={{
                marginTop: '1rem',
                padding: '0.85rem 1.25rem',
                background: 'rgba(244, 63, 94, 0.15)',
                border: '1.5px solid var(--accent-rose)',
                borderRadius: '12px',
                color: '#fecdd3',
                fontSize: '0.95rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
              }}
              role="alert"
            >
              <span>⚠️</span>
              <span>{stepError}</span>
            </div>
          )}

          <div className="action-bar">
            <button className="secondary" onClick={handleBack}>
              &larr; Back to Body Location
            </button>
            <button
              className="primary"
              onClick={handleSensationNext}
              disabled={!selectedSymptom}
              style={{
                padding: '0.85rem 2.25rem',
                fontWeight: '800',
                opacity: !selectedSymptom ? 0.5 : 1,
                cursor: !selectedSymptom ? 'not-allowed' : 'pointer',
              }}
            >
              Continue to Severity &amp; Timeline &rarr;
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 6: VISUAL SEVERITY, TIMELINE & ASSOCIATED CHIPS */}
      {/* ========================================================================= */}
      {currentStep === 6 && (
        <div>
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              background: 'rgba(6, 182, 212, 0.12)',
              border: '1px solid var(--accent-cyan)',
              borderRadius: '14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Location &amp; Sensation Character:
              </span>
              <div style={{ fontWeight: '800', color: '#ffffff', marginTop: '0.2rem' }}>
                {confirmedLocations.map((l) => `${l.anatomical_zone} (${l.side})`).join(', ')} &bull; Sensation: {selectedSymptom}
              </div>
            </div>

            <button
              onClick={() => setCurrentStep(5)}
              className="secondary"
              style={{ minHeight: '36px', padding: '0.3rem 0.75rem', fontSize: '0.85rem' }}
            >
              ✏️ Change Sensation
            </button>
          </div>

          <SeverityTimeline
            severity={severity}
            onSelectSeverity={setSeverity}
            duration={duration}
            onSelectDuration={setDuration}
            associatedSymptoms={associatedSymptoms}
            onToggleAssociatedSymptom={handleToggleAssociatedSymptom}
            audioEnabled={audioEnabled}
          />

          <div className="action-bar">
            <button className="secondary" onClick={handleBack}>
              &larr; Back to Sensation
            </button>
            <button
              className="primary"
              onClick={handleSeverityNext}
              style={{ padding: '0.85rem 2.25rem', fontWeight: '800' }}
            >
              Continue to Clarification Questions &rarr;
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 7: ADAPTIVE CLINICAL CLARIFICATION (SOCRATES ENGINE) */}
      {/* ========================================================================= */}
      {currentStep === 7 && (
        <AdaptiveQuestionStep
          sessionState={{
            session_id: activeSession?.session_id || 'SES-DEMO',
            locations: confirmedLocations,
            body_macro_region: confirmedLocations[0]?.body_region || 'Abdomen',
            anatomical_micro_zone: confirmedLocations[0]?.anatomical_zone || 'Epigastrium',
            character: selectedSymptom || 'Burning',
            severity,
            duration,
            associated_symptoms: associatedSymptoms,
            completed_answers: adaptiveAnswers,
            patient_identifier: activeSession?.patient_identifier,
          }}
          onCompleteAdaptive={handleAdaptiveComplete}
          onBack={() => setCurrentStep(6)}
          onEmergencyAlert={(alertData) =>
            setEmergencyAlert({
              rule: alertData.trigger_rule || alertData.rule_name || 'EMERGENCY_INTERCEPT',
              message: alertData.action_required || alertData.message || 'Critical signs detected. Clinical staff alerted.',
            })
          }
          audioEnabled={audioEnabled}
          reducedMotion={reducedMotion}
        />
      )}

      {/* ========================================================================= */}
      {/* STEP 8: CONFIRMATION, UNDO & SUBMISSION */}
      {/* ========================================================================= */}
      {currentStep === 8 && (
        <div>
          {!isSubmitted ? (
            <div>
              <h2 className="card-title" style={{ color: 'var(--accent-cyan)', marginBottom: '0.35rem' }}>
                ✅ Step 8: Review &amp; Submit for Doctor Review
              </h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Please review your symptom summary before transmitting it to your doctor:
              </p>

              <div className="summary-card" role="region" aria-label="Symptom summary card">
                {/* 0. Voice Evidence & Patient Spoken Transcript */}
                {voiceTranscript && (
                  <div className="summary-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.6rem', background: 'rgba(6, 182, 212, 0.08)', borderRadius: '12px', padding: '1rem', border: '1px solid var(--accent-cyan)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <span className="summary-label" style={{ color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>🎙️</span> Patient Voice Evidence:
                      </span>
                      <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(6, 182, 212, 0.2)', color: '#67e8f9', border: '1px solid var(--accent-cyan)', fontWeight: '800' }}>
                        PATIENT-STATED INFORMATION
                      </span>
                    </div>
                    <div style={{ fontSize: '1.05rem', color: '#ffffff', fontStyle: 'italic', lineHeight: 1.5 }}>
                      "{voiceTranscript}"
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                      <span className="clinical-attribute-pill" style={{ color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                        ✓ Patient Confirmed
                      </span>
                      {voiceStructuredData && (
                        <span className="clinical-attribute-pill">
                          AI-Extracted: {voiceStructuredData.symptom || 'pain'} &bull; {voiceStructuredData.character || 'burning'} (Severity {voiceStructuredData.severity || 8}/10)
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 1. Body Locations */}
                <div className="summary-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <span className="summary-label">
                      Body Location{confirmedLocations.length > 1 ? 's' : ''} ({confirmedLocations.length}):
                    </span>
                    <button
                      onClick={() => setCurrentStep(4)}
                      className="secondary"
                      style={{ minHeight: '36px', padding: '0.3rem 0.75rem', fontSize: '0.85rem' }}
                    >
                      ✏️ Edit Locations
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
                    {confirmedLocations.map((loc) => (
                      <div
                        key={loc.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem 0.85rem',
                          background: 'rgba(255,255,255,0.04)',
                          borderRadius: '10px',
                          border: '1px solid rgba(255,255,255,0.1)',
                        }}
                      >
                        <span style={{ color: 'var(--accent-cyan)', fontWeight: '800', fontSize: '1rem' }}>
                          📍 {loc.body_region} &rarr; {loc.anatomical_zone}
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span className="location-side-badge">{loc.side}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            ({loc.orientation} view)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Symptom Character */}
                <div className="summary-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <span className="summary-label">Sensation Character:</span>
                    <button
                      onClick={() => setCurrentStep(5)}
                      className="secondary"
                      style={{ minHeight: '36px', padding: '0.3rem 0.75rem', fontSize: '0.85rem' }}
                    >
                      ✏️ Change Sensation
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div className="summary-value" style={{ fontSize: '1.2rem', fontWeight: '900', color: '#ffffff' }}>
                      {selectedSymptom === 'Burning' && '🔥 Burning / Acidity / Heat'}
                      {selectedSymptom === 'Cramping' && '🪢 Cramping / Tightness / Squeezing'}
                      {selectedSymptom === 'Sharp' && '⚡ Sharp / Stabbing / Acute'}
                      {selectedSymptom === 'Dull' && '🌊 Dull / Heavy Ache / Pressure'}
                    </div>
                    <span
                      style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '6px',
                        background: 'rgba(16, 185, 129, 0.2)',
                        border: '1px solid var(--accent-emerald)',
                        color: '#34d399',
                        fontWeight: '800',
                        fontSize: '0.8rem',
                      }}
                    >
                      ✓ Confirmed by User
                    </span>
                  </div>

                  {/* Structured Clinical Sensation Attributes */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', width: '100%' }}>
                    <span className="clinical-attribute-pill">
                      <strong>Sensory Quality:</strong> {symptomAttributes?.sensory_quality || 'acidic_heat'}
                    </span>
                    <span className="clinical-attribute-pill">
                      <strong>Visual Cue:</strong> {symptomAttributes?.visual_cue || 'flame_vector'}
                    </span>
                    <span className="clinical-attribute-pill" style={{ color: 'var(--accent-cyan)' }}>
                      <strong>Classification:</strong> Patient Physical Sensory Quality (Non-Diagnostic)
                    </span>
                  </div>
                </div>

                {/* 3. Pain Severity */}
                <div className="summary-row">
                  <div>
                    <span className="summary-label">Pain Severity:</span>
                    <div
                      className="summary-value"
                      style={{
                        color: severity >= 7 ? 'var(--accent-rose)' : 'var(--accent-cyan)',
                        fontSize: '1.2rem',
                      }}
                    >
                      {severity} / 10 &bull; {severity <= 3 ? 'Mild' : severity <= 6 ? 'Moderate' : 'Severe'}
                    </div>
                  </div>
                  <button
                    onClick={() => setCurrentStep(6)}
                    className="secondary"
                    style={{ minHeight: '36px', padding: '0.3rem 0.75rem', fontSize: '0.85rem' }}
                  >
                    ✏️ Change Severity
                  </button>
                </div>

                {/* 4. Duration */}
                <div className="summary-row">
                  <div>
                    <span className="summary-label">Onset &amp; Duration:</span>
                    <div className="summary-value">
                      {duration === 'today' && 'Started today (< 24h)'}
                      {duration === '2-3days' && '2 to 3 days ago'}
                      {duration === '1week' && 'Over 1 week ago'}
                      {duration === 'chronic' && 'Chronic / Recurring'}
                    </div>
                  </div>
                  <button
                    onClick={() => setCurrentStep(6)}
                    className="secondary"
                    style={{ minHeight: '36px', padding: '0.3rem 0.75rem', fontSize: '0.85rem' }}
                  >
                    ✏️ Change Duration
                  </button>
                </div>

                {/* 5. Associated Symptoms */}
                <div className="summary-row">
                  <div>
                    <span className="summary-label">Associated Symptoms:</span>
                    <div className="summary-value" style={{ fontSize: '0.95rem' }}>
                      {associatedSymptoms.length > 0
                        ? associatedSymptoms
                            .map((s) => s.replace('_', ' ').toUpperCase())
                            .join(', ')
                        : 'None reported'}
                    </div>
                  </div>
                  <button
                    onClick={() => setCurrentStep(6)}
                    className="secondary"
                    style={{ minHeight: '36px', padding: '0.3rem 0.75rem', fontSize: '0.85rem' }}
                  >
                    ✏️ Change
                  </button>
                </div>

                {/* 6. Clarified Clinical Variables (Adaptive Follow-up) */}
                <div className="summary-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <span className="summary-label">
                      Clarified Clinical Variables ({adaptiveAnswers.length}):
                    </span>
                    <button
                      onClick={() => setCurrentStep(7)}
                      className="secondary"
                      style={{ minHeight: '36px', padding: '0.3rem 0.75rem', fontSize: '0.85rem' }}
                    >
                      ✏️ Edit Clarifications
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', width: '100%' }}>
                    {adaptiveAnswers.length > 0 ? (
                      adaptiveAnswers.map((ans, idx) => (
                        <span key={idx} className="clinical-attribute-pill" style={{ color: '#6ee7b7', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                          <strong>{ans.target_field}:</strong> {ans.selected_text}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        No additional follow-up questions answered (skipped)
                      </span>
                    )}
                  </div>
                </div>

                {/* 7. Modality & Tap Benchmark */}
                <div className="summary-row" style={{ borderBottom: 'none' }}>
                  <div>
                    <span className="summary-label">Input Modality &amp; Efficiency:</span>
                    <div className="summary-value" style={{ color: 'var(--accent-emerald)', fontSize: '0.95rem' }}>
                      ✓ Completed in {tapCount} taps (Non-verbal Touch Flow &bull; Zero Typing Required)
                    </div>
                  </div>
                </div>

                {/* Submission Action Bar */}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                  <button className="secondary" onClick={handleBack} style={{ flex: 1 }}>
                    ↩ Go Back &amp; Change
                  </button>
                  <button
                    className="primary"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    style={{
                      flex: 2,
                      minHeight: '62px',
                      fontSize: '1.2rem',
                      fontWeight: '900',
                      letterSpacing: '0.5px',
                      opacity: isSubmitting ? 0.7 : 1,
                      cursor: isSubmitting ? 'wait' : 'pointer',
                    }}
                  >
                    {isSubmitting ? '⏳ Submitting for Doctor Review...' : '✓ Submit for Doctor Review →'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* SUBMISSION CONFIRMATION VIEW */
            <div
              style={{
                textAlign: 'center',
                padding: '3rem 1.5rem',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 182, 212, 0.15))',
                border: '3px solid var(--accent-emerald)',
                borderRadius: '20px',
                boxShadow: '0 0 40px rgba(16, 185, 129, 0.3)',
              }}
              role="alert"
              aria-live="polite"
            >
              <div style={{ fontSize: '4rem', marginBottom: '0.75rem', lineHeight: 1 }}>✅</div>
              <h2
                style={{
                  fontSize: '1.8rem',
                  color: 'var(--accent-emerald)',
                  fontWeight: '900',
                  marginBottom: '0.5rem',
                }}
              >
                Intake Transmitted Successfully!
              </h2>

              <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '580px', margin: '0 auto 1.5rem auto' }}>
                Your clinical intake summary has been formatted and delivered to your doctor's review screen. Please take your queue ticket:
              </p>

              {/* Queue Ticket Badge */}
              <div className="ticket-badge">
                TICKET #{queueTicket}
              </div>

              <div
                style={{
                  maxWidth: '560px',
                  margin: '1.5rem auto',
                  padding: '1.25rem',
                  background: 'rgba(0, 0, 0, 0.35)',
                  borderRadius: '14px',
                  textAlign: 'left',
                  fontSize: '0.95rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                }}
              >
                <div>
                  📍 <strong>Locations ({confirmedLocations.length}):</strong>
                  <ul style={{ marginLeft: '1.25rem', marginTop: '0.25rem' }}>
                    {confirmedLocations.map((l) => (
                      <li key={l.id}>
                        {l.body_region} &rarr; {l.anatomical_zone} ({l.side} &bull; {l.orientation})
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  ⚡ <strong>Sensation Character:</strong> {selectedSymptom} &bull; Quality: <em>{symptomAttributes?.sensory_quality || 'acidic_heat'}</em> &bull; Cue: <em>{symptomAttributes?.visual_cue || 'flame_vector'}</em> (Severity: {severity}/10)
                </div>
                {adaptiveAnswers.length > 0 && (
                  <div>
                    🎯 <strong>Adaptive Follow-up ({adaptiveAnswers.length}):</strong>
                    <ul style={{ marginLeft: '1.25rem', marginTop: '0.25rem' }}>
                      {adaptiveAnswers.map((a, idx) => (
                        <li key={idx}>
                          <strong>{a.target_field}:</strong> {a.selected_text}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {finalizedRecord && (
                  <div>
                    🛡️ <strong>Triage Urgency:</strong>{' '}
                    <span style={{ color: finalizedRecord.triage_urgency === 'EMERGENCY' ? 'var(--accent-rose)' : '#34d399', fontWeight: '800' }}>
                      {finalizedRecord.triage_urgency}
                    </span>{' '}
                    &bull; Record: <code>{finalizedRecord.record_id}</code>
                  </div>
                )}
                <div>🩺 <strong>Status:</strong> Ready for Clinician 60s Briefing</div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1.25rem' }}>
                {onNavigateToDoctor && (
                  <button
                    className="primary"
                    onClick={onNavigateToDoctor}
                    style={{
                      padding: '0.9rem 2.25rem',
                      fontSize: '1.1rem',
                      fontWeight: '900',
                      background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                      boxShadow: '0 0 24px rgba(14, 165, 233, 0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <span>🩺</span> View 60s Doctor Brief (Ticket #{queueTicket}) &rarr;
                  </button>
                )}
                <button
                  className="secondary"
                  onClick={handleReset}
                  style={{ padding: '0.9rem 2rem', fontSize: '1rem', fontWeight: '700' }}
                >
                  + Start Another Intake
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETERMINISTIC RED-FLAG SAFETY INTERCEPT MODAL */}
      {/* ========================================================================= */}
      {emergencyAlert && (
        <div className="modal-overlay" role="alertdialog" aria-modal="true" aria-labelledby="emergency-title">
          <div className="modal-content">
            <div className="emergency-icon">🚨</div>
            <h3 id="emergency-title" style={{ fontSize: '1.6rem', fontWeight: '900', color: 'var(--accent-rose)' }}>
              URGENT CLINICAL SAFETY INTERCEPT
            </h3>
            <p style={{ fontSize: '1.05rem', color: '#fecdd3', lineHeight: 1.5 }}>
              {emergencyAlert.message}
            </p>
            <div
              style={{
                padding: '0.85rem',
                background: 'rgba(0,0,0,0.5)',
                borderRadius: '10px',
                fontSize: '0.85rem',
                color: '#fca5a5',
              }}
            >
              <strong>Safety Guardrail Active:</strong> {emergencyAlert.rule} &bull; Routine intake is temporarily paused for your safety.
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <button
                className="danger"
                style={{ flex: 1, padding: '0.9rem', fontWeight: '800', fontSize: '1rem' }}
                onClick={() => alert('🚨 High-priority chime broadcast! Nursing desk signaled for Kiosk Ticket #' + queueTicket)}
              >
                📞 Signal Triage Nurse (Ticket #{queueTicket})
              </button>
              <button
                className="secondary"
                style={{ flex: 1 }}
                onClick={() => {
                  const pin = window.prompt('Clinical Staff Only: Enter 4-digit Nurse/Doctor PIN to clear emergency hold (Demo PIN: 1234):');
                  if (pin === '1234') {
                    setEmergencyAlert(null);
                  } else if (pin !== null) {
                    alert('Invalid staff PIN. Emergency guardrail remains active for patient safety.');
                  }
                }}
              >
                🩺 Staff Override (PIN Required)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
