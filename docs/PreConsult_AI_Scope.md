# PreConsult-AI Complete Project Scope & Product Requirements Document
**Accessible AI Pre-Consultation + AR Symptom Communication Platform**

*Consolidated from the PreConsult AI blueprint and PRDs.*

## 1. Executive Summary
PreConsult AI is a dual-sided healthcare communication platform:
1. An accessible patient interface converting speech, text, touch, gestures, body selection, visual symptom choices, and scanned medical documents into structured clinical information.
2. A clinician dashboard presenting a concise, reviewable 60-second pre-consultation brief.

### Key Safety Boundary
Assistive intake only. Human-in-the-loop. Red-flag interception. Clinicians remain the decision-makers; AI organizes, highlights, and summarizes information. Never invent diagnoses.

---

## 2. Product Vision & Accessibility Core
- **Non-speaking patient pathway**: Communicate symptoms without speech or typing using touch, visual choices, or supported gestures.
- **Deep abdominal symptom profile in <4 taps** without typing.
- **Adaptive Semantic Visuals**:
  - *Cramping / Tightness*: Animated contracting / tightening visual.
  - *Burning / Acidity*: Rising / flickering flame animation.
  - *Acute / Sharp Pain*: Pulsating needle / sharp geometric patterns.
  - *Severity Slider*: Color-coded tactile/visual scale (calm blue to high-intensity throbbing red).
- **Reduced-motion & static fallbacks** for all animations.

---

## 3. Baseline Intake & Clinical Engine
- **SOCRATES-based adaptive intake**: Site, Onset, Character, Radiation, Associated symptoms, Timing/duration, Exacerbating/relieving factors, Severity.
- Maximum 3–4 turns for common complaints.
- **Deterministic Red-Flag Intercept**: Immediately halts routine intake when high-urgency emergency patterns (e.g. chest pain + diaphoresis, stroke symptoms, acute abdomen with shock) are detected.
- **Medical Records & Prescription OCR**: Extracts medication tuples (name, dose, frequency, source, confidence) and flags abnormal lab values.

---

## 4. Clinician Dashboard (60-Second Brief)
- Chief complaint & HPI narrative.
- Visual anatomical map showing marked symptom sites.
- Structured symptom timeline and pertinent negatives.
- Normalized active medications list with provenance and confidence.
- Highlighted abnormal lab results with reference ranges.
- Red-flag status banner.
- Clinician actions: Edit, Verify, Confirm/Approve, Export (PDF/JSON/FHIR).

---

## 5. Phased Roadmap & Hackathon MVP Scope
- **MVP (Phase 1)**:
  - Touch-first interactive body selector (Front/Back).
  - 4 core semantic visuals (Cramping, Burning, Sharp, Severity).
  - Non-speaking intake flow (<4 taps).
  - Adaptive SOCRATES follow-up engine.
  - Deterministic red-flag safety guardrail.
  - Prescription & lab OCR ingestion with medication normalization.
  - Doctor review/approval dashboard.
  - Accessibility settings: large targets, high contrast, text scaling, speech audio output.
- **Deferred to Later Phases**:
  - Full mixed-pill camera geometry AR recognition.
  - Smart-glasses hardware deployment.
  - Live hospital HIS / ABDM writeback (mock / FHIR export in MVP).
