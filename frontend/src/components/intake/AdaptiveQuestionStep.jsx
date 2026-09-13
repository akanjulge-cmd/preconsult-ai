import React, { useState, useEffect } from 'react';
import { getNextAdaptiveQuestion } from '../../services/api';

export default function AdaptiveQuestionStep({
  sessionState,
  onCompleteAdaptive,
  onBack,
  onEmergencyAlert,
  audioEnabled = false,
  reducedMotion = false,
}) {
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [completedAnswers, setCompletedAnswers] = useState(sessionState.completed_answers || []);
  const [turnNumber, setTurnNumber] = useState(1);
  const [maxTurns, setMaxTurns] = useState(3);
  const [resolvedVars, setResolvedVars] = useState([]);
  const [unresolvedVars, setUnresolvedVars] = useState([]);

  // Fetch next question when component mounts or answers change
  useEffect(() => {
    let isMounted = true;

    async function fetchNext() {
      setLoading(true);
      try {
        const payload = {
          session_id: sessionState.session_id || 'SES-DEMO',
          locations: sessionState.locations || [],
          body_macro_region: sessionState.body_macro_region || 'Abdomen',
          anatomical_micro_zone: sessionState.anatomical_micro_zone || 'Epigastrium',
          character: sessionState.character || 'Burning',
          severity: sessionState.severity || 6,
          duration: sessionState.duration || '2-3days',
          associated_symptoms: sessionState.associated_symptoms || [],
          completed_answers: completedAnswers,
          patient_identifier: sessionState.patient_identifier,
        };

        const res = await getNextAdaptiveQuestion(payload);

        if (!isMounted) return;

        if (res.red_flag_alert && res.red_flag_alert.is_active) {
          if (onEmergencyAlert) {
            onEmergencyAlert(res.red_flag_alert);
          }
          return;
        }

        if (res.is_complete || !res.next_question) {
          // Intake resolved or capped - set question to null so user can review or change answers
          setCurrentQuestion(null);
          setResolvedVars(res.resolved_variables || []);
          if (res.record) {
            setResolvedVars((prev) => prev);
          }
        } else {
          setCurrentQuestion(res.next_question);
          setTurnNumber(res.turn_number || completedAnswers.length + 1);
          setMaxTurns(res.max_turns || 3);
          setResolvedVars(res.resolved_variables || []);
          setUnresolvedVars(res.unresolved_variables || []);
          setSelectedOptionId(null);

          // Audio Guidance read-aloud
          if (audioEnabled && 'speechSynthesis' in window && res.next_question.audio_prompt) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(res.next_question.audio_prompt);
            utterance.rate = 0.95;
            window.speechSynthesis.speak(utterance);
          }
        }
      } catch (err) {
        console.error('Failed to load adaptive question:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchNext();

    return () => {
      isMounted = false;
    };
  }, [completedAnswers]);

  function handleSelectOption(option) {
    setSelectedOptionId(option.id);

    if (audioEnabled && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(option.label);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }

  function handleConfirmAnswer() {
    if (!selectedOptionId || !currentQuestion) return;

    const selectedOpt = currentQuestion.options.find((o) => o.id === selectedOptionId);
    if (!selectedOpt) return;

    // Check emergency red-flag client-side safeguard
    if (selectedOpt.is_red_flag && onEmergencyAlert) {
      onEmergencyAlert({
        rule_name: 'CRITICAL_CLINICAL_SIGN',
        message: `You indicated: "${selectedOpt.label}". Triage staff has been notified. Please remain seated.`,
      });
    }

    const newAnswer = {
      question_id: currentQuestion.question_id,
      target_field: currentQuestion.target_field,
      selected_option_id: selectedOpt.id,
      selected_text: selectedOpt.label,
    };

    setCompletedAnswers((prev) => [...prev, newAnswer]);
  }

  function handleUndoLastAnswer() {
    if (completedAnswers.length === 0) {
      if (onBack) onBack();
      return;
    }
    setCompletedAnswers((prev) => prev.slice(0, prev.length - 1));
  }

  function handleSkipAll() {
    onCompleteAdaptive({
      completedAnswers,
      record: null,
      resolvedVariables: resolvedVars,
    });
  }

  function handleReplayAudio() {
    if ('speechSynthesis' in window && currentQuestion?.audio_prompt) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentQuestion.audio_prompt);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: reducedMotion ? 'none' : 'spin 1.5s linear infinite' }}>
          ⏳
        </div>
        <h3 style={{ color: 'var(--accent-cyan)', fontSize: '1.25rem', fontWeight: '800' }}>
          Evaluating Next High-Value Question...
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          SOCRATES Clinical Engine analyzing confirmed variables.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner: Progress and Cognitive Load Guardrail */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div>
          <h2 className="card-title" style={{ color: 'var(--accent-cyan)', marginBottom: '0.2rem' }}>
            ⚡ Step 7: Adaptive Clinical Clarification
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            SOCRATES Clinical Engine asks only high-value follow-ups (capped at 3 turns to prevent fatigue):
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="turn-progress-badge">
            Question {turnNumber} of {maxTurns}
          </span>
          <button
            onClick={handleReplayAudio}
            className="secondary"
            style={{ minHeight: '36px', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
            title="Read question aloud"
            aria-label="Read question aloud"
          >
            🔊 Audio
          </button>
        </div>
      </div>

      {/* Answered Turns Tray (Preserves previous answers) */}
      {completedAnswers.length > 0 && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
          }}
          role="region"
          aria-label="Previous answered questions"
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>
            ✓ Clarified Variables:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {completedAnswers.map((ans, i) => (
              <span
                key={ans.question_id || i}
                style={{
                  fontSize: '0.85rem',
                  padding: '0.25rem 0.7rem',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#6ee7b7',
                  borderRadius: '8px',
                  fontWeight: '600',
                }}
              >
                {ans.target_field}: {ans.selected_text}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Current Question Container */}
      {currentQuestion && (
        <div className="adaptive-question-card" role="region" aria-labelledby="adaptive-q-title">
          {/* Clinical Context Pill */}
          {currentQuestion.clinical_context && (
            <div className="clinical-context-tag">
              🩺 {currentQuestion.clinical_context}
            </div>
          )}

          <h3
            id="adaptive-q-title"
            style={{
              fontSize: '1.35rem',
              fontWeight: '900',
              color: '#ffffff',
              lineHeight: 1.4,
              marginTop: '0.5rem',
              marginBottom: '1.25rem',
            }}
          >
            {currentQuestion.prompt_text}
          </h3>

          {/* Large Non-Speaking AAC Response Options Grid */}
          <div
            className="aac-option-grid"
            role="radiogroup"
            aria-label={currentQuestion.prompt_text}
          >
            {currentQuestion.options.map((opt) => {
              const isSelected = selectedOptionId === opt.id;
              return (
                <button
                  key={opt.id}
                  className={`aac-option-card ${isSelected ? 'selected' : ''} ${opt.is_red_flag ? 'is-red-flag' : ''}`}
                  onClick={() => handleSelectOption(opt)}
                  role="radio"
                  aria-checked={isSelected}
                  type="button"
                >
                  <span className="aac-icon" role="img" aria-hidden="true">
                    {opt.icon}
                  </span>
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: '800', color: isSelected ? '#ffffff' : 'var(--text-primary)' }}>
                      {opt.label}
                    </div>
                    {opt.is_pertinent_negative && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: '700' }}>
                        ✓ Pertinent Negative Finding
                      </span>
                    )}
                    {opt.is_red_flag && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-rose)', fontWeight: '800' }}>
                        ⚠️ Urgent Clinical Sign
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <span
                      style={{
                        padding: '0.2rem 0.6rem',
                        background: 'var(--accent-cyan)',
                        color: '#000000',
                        fontWeight: '900',
                        borderRadius: '999px',
                        fontSize: '0.8rem',
                      }}
                    >
                      ✓ Selected
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed Clarification State */}
      {!currentQuestion && (
        <div className="adaptive-question-card" style={{ textAlign: 'center', padding: '2.25rem 1.5rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🎯</div>
          <h3 style={{ fontSize: '1.4rem', fontWeight: '900', color: '#ffffff', marginBottom: '0.5rem' }}>
            {completedAnswers.length > 0 ? 'All Clarification Questions Completed' : 'No Additional Questions Needed'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '520px', margin: '0 auto 1.5rem auto', lineHeight: 1.5 }}>
            The SOCRATES Clinical Engine has gathered all priority variables needed for your doctor. You can proceed to the final review or change any answer below.
          </p>

          <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="primary"
              onClick={handleSkipAll}
              style={{ padding: '0.9rem 2.5rem', fontWeight: '900', fontSize: '1.1rem' }}
            >
              ✓ Review Symptom Summary &rarr;
            </button>
            {completedAnswers.length > 0 && (
              <button
                className="secondary"
                onClick={handleUndoLastAnswer}
                style={{ padding: '0.9rem 1.5rem', fontSize: '0.95rem', fontWeight: '700' }}
              >
                ↩ Change Last Answer
              </button>
            )}
            {completedAnswers.length > 0 && (
              <button
                className="secondary"
                onClick={() => setCompletedAnswers([])}
                style={{ padding: '0.9rem 1.25rem', fontSize: '0.9rem' }}
              >
                🔄 Restart Questions
              </button>
            )}
          </div>
        </div>
      )}

      {/* Action Bar (When Question is Active) */}
      {currentQuestion && (
        <div className="action-bar" style={{ marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="secondary" onClick={handleUndoLastAnswer}>
              ↩ {completedAnswers.length > 0 ? 'Previous Question' : 'Back to Severity'}
            </button>
            <button
              className="secondary"
              onClick={handleSkipAll}
              style={{ fontSize: '0.85rem' }}
              title="Skip further questions and proceed directly to summary"
            >
              ⏭️ Skip to Review
            </button>
          </div>

          <button
            className="primary"
            onClick={handleConfirmAnswer}
            disabled={!selectedOptionId}
            style={{
              padding: '0.85rem 2.5rem',
              fontWeight: '900',
              fontSize: '1.1rem',
              opacity: selectedOptionId ? 1 : 0.45,
              cursor: selectedOptionId ? 'pointer' : 'not-allowed',
            }}
          >
            Confirm &amp; Next &rarr;
          </button>
        </div>
      )}
    </div>
  );
}
