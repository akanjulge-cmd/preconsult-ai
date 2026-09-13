import React from 'react';
import { t } from '../../services/translations';

export default function ConsentStep({ onBack, onConfirm, language = 'en' }) {
  const isHi = language === 'hi';
  const isTe = language === 'te';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 className="card-title" style={{ color: 'var(--accent-cyan)', marginBottom: '0.25rem' }}>
          🛡️ {t(language, 'consentTitle', 'Step 3: Plain-Language Clinical Consent')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          {t(language, 'consentSubtitle', 'Please review the following simple principles before beginning your symptom report:')}
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
              {isHi ? 'चिकित्सक की सहायता' : isTe ? 'వైద్యునికి సహాయం' : 'Prepares Your Doctor'}
            </h3>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {isHi
              ? 'प्रीकंसल्ट एआई आपके लक्षणों को आपके डॉक्टर की समीक्षा के लिए व्यवस्थित करता है। यह स्वयं निदान नहीं करता है।'
              : isTe
              ? 'ప్రీకన్సల్ట్ AI మీ లక్షణాలను వైద్యుల సమీక్ష కోసం ఒక నిర్దిష్ట పద్ధతిలో సిద్ధం చేస్తుంది. ఇది రోగ నిర్ధారణ చేయదు.'
              : 'PreConsult AI organizes your symptoms into a structured draft for your doctor to review. It does not make diagnoses or replace clinical examinations.'}
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
              {isHi ? 'गोपनीय और सुरक्षित' : isTe ? 'రహస్యమైనది & భద్రమైనది' : 'Confidential & Secure'}
            </h3>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {isHi
              ? 'आपकी जानकारी एन्क्रिप्टेड है और इस परामर्श सत्र के दौरान केवल आपकी स्वास्थ्य टीम द्वारा देखी जा सकती है।'
              : isTe
              ? 'మీ వివరాలు ఎన్‌క్రిప్ట్ చేయబడతాయి మరియు ఈ సంప్రదింపు సమయంలో మీ వైద్య బృందానికి మాత్రమే అందుబాటులో ఉంటాయి.'
              : 'Your health responses are encrypted and accessible only by your treating healthcare team during this consultation session.'}
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
              {isHi ? 'आपातकालीन सुरक्षा गार्डरेल' : isTe ? 'అత్యవసర భద్రతా వ్యవస్థ' : 'Emergency Safety Guardrails'}
            </h3>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {isHi
              ? 'यदि सीने में दर्द या सांस लेने में तकलीफ जैसे आपातकालीन लक्षण पाए जाते हैं, तो सिस्टम तुरंत अलर्ट करता है।'
              : isTe
              ? 'ఛాతీ నొప్పి లేదా శ్వాస తీసుకోవడంలో ఇబ్బంది వంటి ప్రాణాంతక లక్షణాలు నమోదైతే, వెంటనే అత్యవసర హెచ్చరిక జారీ అవుతుంది.'
              : 'If life-threatening symptoms (such as acute chest tightness or difficulty breathing) are reported, routine intake immediately pauses to connect you to urgent clinical staff.'}
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
          {isHi
            ? 'नीचे टैप करके, आप अपने लक्षणों को डॉक्टर की नैदानिक समीक्षा के लिए साझा करने की सहमति देते हैं।'
            : isTe
            ? 'కింద బటన్‌పై నొక్కడం ద్వారా, మీ లక్షణాలను వైద్యుల సమీక్షకు సమర్పించడానికి మీరు అంగీకరిస్తున్నారు.'
            : "By tapping below, you agree to submit your symptom details for your physician's clinical review."}
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
          ✓ {isHi ? 'मैं समझता हूँ और प्रारंभ करें →' : isTe ? 'నేను అర్థం చేసుకున్నాను & ప్రారంభించండి →' : 'I Understand & Begin Intake →'}
        </button>
      </div>

      <div className="action-bar">
        <button className="secondary" onClick={onBack}>
          {t(language, 'back', '← Back')}
        </button>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {isHi ? 'चरण ३ - रोगी सहमति और गोपनीयता' : isTe ? 'దశ 3 - రోగి సమ్మతి & గోప్యత' : 'Step 3 of 8 • Patient Consent & Privacy Notice'}
        </span>
      </div>
    </div>
  );
}
