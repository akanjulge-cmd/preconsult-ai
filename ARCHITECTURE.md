# PreConsult AI — System Architecture & Technical Specification

> **Version:** 1.0.0 (Hackathon MVP)  
> **Source Documents:** `/docs/PreConsult_AI_Scope.md`, `/docs/Visual_Symptom_PRD.md`, `/docs/MediKiosk_Hackathon_Plan.md`  
> **Guiding Principle:** *"Voice when you can speak. Touch when you can't. Show where it hurts. Scan what you already have. We prepare the doctor — not replace the doctor."*

---

## 1. Executive Architecture Overview

PreConsult AI is a dual-sided healthcare communication platform engineered for high clinical reliability, rapid execution, and deep accessibility. It bridges the critical communication gap between patients (especially non-verbal, speech-impaired, elderly, or low-literacy individuals) and clinicians under severe time pressure.

```
+---------------------------------------------------------------------------------------------------+
|                                      PATIENT INTAKE CLIENT                                        |
|  +---------------------------+  +--------------------------+  +--------------------------------+  |
|  |   Interactive Body Map    |  |  Adaptive Semantic Art   |  |   Non-Speaking Intake (<4 taps)|  |
|  |  (Front/Back Macro->Micro)|  | (Cramp, Burn, Sharp, Sev)|  | (Touch, Audio TTS, Voice ASR)  |  |
|  +---------------------------+  +--------------------------+  +--------------------------------+  |
|  +---------------------------------------------------------+  +--------------------------------+  |
|  |             Document & Prescription Scanner             |  |   Emergency Red-Flag Modal     |  |
|  +---------------------------------------------------------+  +--------------------------------+  |
+--------------------------------------------------+------------------------------------------------+
                                                   | JSON over HTTPS
                                                   v
+---------------------------------------------------------------------------------------------------+
|                                      FASTAPI BACKEND CORE                                         |
|  +-----------------------+   +--------------------------+   +----------------------------------+  |
|  | Intake Session Manager|   | Deterministic Safety Rule|   |     SOCRATES Question Engine     |  |
|  | (Preferences, Consent)|   |   (Concurrent Screening) |   |    (3-4 Turn Clinical Ontology)  |  |
|  +-----------------------+   +--------------------------+   +----------------------------------+  |
|  +------------------------------------------------------+   +----------------------------------+  |
|  |               Clinical Synthesizer                   |   |        Document AI & OCR         |  |
|  |   (Gemini API + Strict Pydantic v2 Serialization)    |   | (Prescription Tuples & Lab Flags)|  |
|  +------------------------------------------------------+   +----------------------------------+  |
+--------------------------------------------------+------------------------------------------------+
             |                                     |                                   |
             v                                     v                                   v
+-----------------------+             +-----------------------+             +-----------------------+
|  SQLite / SQLModel    |             | FHIR / JSON Exporter  |             |   DOCTOR DASHBOARD    |
| (Sessions, Audit Logs,|             | (HL7 FHIR Resources   |             | (60s Brief, HPI, Labs,|
|  Records, Provenance) |             |  Patient/Observation) |             |  Medications, Approve)|
+-----------------------+             +-----------------------+             +-----------------------+
```

### Safety & Clinical Guardrails
1. **Assistive, Not Diagnostic:** PreConsult AI collects, organizes, and highlights clinical history. It never issues diagnoses or dictates treatment.
2. **Human-in-the-Loop:** Clinical notes remain in "Draft" status until explicitly verified, edited, and approved by a licensed clinician.
3. **Deterministic Emergency Intercept:** Critical red flags (e.g. crushing chest pain with diaphoresis, acute peritoneal signs, acute neurological deficits) are evaluated via deterministic code rules, immediately halting intake and directing the patient to emergency care.
4. **Data Provenance:** Every single datum carries its provenance tag (`patient-selected`, `ocr-extracted`, `clinician-entered`, `ai-inferred`). AI inferences are never disguised as patient-stated facts.

---

## 2. Technology Choices & Justification

| Layer | Chosen Technology | Rationale & Tradeoffs |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 18 + Vite** | Fast compilation, reactive UI state for dynamic body zoning, robust ecosystem for accessibility. Avoids heavy SSR overhead for a kiosk/mobile web demo. |
| **Styling & Design System** | **Vanilla CSS + Modern Design Tokens** | Maximum control over high-contrast accessibility themes, WCAG touch target sizes (>=48px), and custom micro-animations (e.g. tightening rope, flickering flame) with strict `@media (prefers-reduced-motion)` fallbacks. |
| **Interactive Anatomy Map** | **SVG/Canvas-based Dynamic Body Map** | Highly performant, responsive across mobile, tablet, and kiosk screens. Supports clean front/back flipping and macro-to-micro click targets without fragile 3D WebGL bundle bloat or device GPU crashes during a live hackathon demo. |
| **Speech & Audio** | **Web Speech API (`SpeechRecognition` & `SpeechSynthesis`)** | Native browser support for voice dictation and read-aloud question guidance. Zero latency, zero external API key requirements for speech, with graceful fallbacks to visual cards. |
| **Backend Framework** | **Python 3.10+ & FastAPI** | Native asynchronous execution, sub-second latency, self-documenting OpenAPI schemas, and seamless integration with Python clinical packages and AI SDKs. |
| **Schema Validation** | **Pydantic v2** | Enforces the strict `ClinicalPreConsultRecord` schema specified in the project blueprint. Guarantees that AI-generated clinical outputs never crash downstream consumers. |
| **AI Orchestration & OCR** | **Google Gemini API (`google-genai` SDK)** | High multimodal accuracy for prescription and lab report OCR, structured JSON extraction mode, and rapid clinical HPI synthesis with sub-2-second response times. |
| **Database & Persistence** | **SQLite with SQLModel / SQLAlchemy** | Zero configuration, zero external service dependency, reliable transactional persistence for sessions, symptoms, medications, documents, and audit logs during the demo. |
| **Interoperability** | **HL7 FHIR JSON Exporter** | Standardized JSON export format (`Patient`, `Condition`, `MedicationStatement`, `Observation`, `Encounter`) proving hospital HIS/EMR readiness without getting bogged down in external sandbox outages. |

---

## 3. System Architecture Components

### 3.1 Patient Kiosk & Mobile Client
- **Accessibility Engine:** Supports 4 interaction modalities:
  1. *Touch / AAC Cards:* Large hit targets (minimum 48x48px, 12px padding).
  2. *Adaptive Semantic Visuals:* Animated SVG/CSS graphics representing pain quality (Cramping, Burning, Sharp) with visual severity sliders (1-10 color gradient blue-to-red).
  3. *Voice:* Dictation with real-time text transcription.
  4. *Audio Guidance:* Screen-reader style audio prompts for low-literacy/elderly users.
- **Dynamic Body Selector:**
  - Macro-regions: Head, Chest, Abdomen, Pelvis, Arms, Hands, Legs, Feet, Spine/Back.
  - Micro-anatomical zoning (e.g. Abdomen -> Epigastrium, RUQ, LUQ, Umbilical, RLQ, LLQ).
  - Front / Back anatomical flip toggle with clear persistent left/right orientation indicators.
- **4-Tap Abdominal Pain Fast Path:**
  - Tap 1: Select "Abdomen" macro-region.
  - Tap 2: Select "Epigastric / Upper Abdomen" zone.
  - Tap 3: Select "Burning" semantic visual card.
  - Tap 4: Confirm severity (e.g. 7/10) on visual slider.
  - Immediate structured draft generation.

### 3.2 Backend Service Layers
1. **`DeterministicSafetyEngine`**:
   - Executes synchronously on every user input event.
   - Evaluates keyword tuples, anatomical site combinations, and severity thresholds against a hardcoded emergency matrix (e.g., `["chest_pain", "shortness_of_breath"]`, `["abdominal_pain", "rigid_abdomen", "fainting"]`).
   - If triggered: Returns `EmergencyInterceptResponse` with status `TRIGGERED`, recommended immediate triage level, audio alert, and pauses routine questionnaire.
2. **`AdaptiveQuestionEngine` (SOCRATES Logic)**:
   - Evaluates current intake state against clinical variables:
     - **S**ite (anatomical zone)
     - **O**nset (when it started)
     - **C**haracter (burning, cramping, sharp, dull)
     - **R**adiation (moves elsewhere)
     - **A**ssociations (nausea, fever, breathlessness)
     - **T**ime course (constant vs episodic)
     - **E**xacerbating / Relieving factors (food, posture)
     - **S**everity (1-10 scale)
   - Max-turn cap: Maximum 3 to 4 turns for common complaints to prevent user cognitive fatigue.
3. **`DocumentOcrEngine`**:
   - Ingests uploaded camera images of prescriptions and lab reports.
   - Leverages Gemini Multimodal Vision to extract:
     - Medication tuples: `name`, `dosage`, `frequency`, `duration`, `prescriber`, `confidence`.
     - Lab investigations: `test_name`, `measured_value`, `unit`, `reference_range`, `abnormal_flag`.
   - Normalizes entities into a unified medical timeline.
4. **`ClinicalSynthesizer`**:
   - Aggregates symptom points, answers to SOCRATES turns, and scanned medical records.
   - Generates the standard `ClinicalPreConsultRecord` adhering strictly to Pydantic v2 data models.
   - Formats the 60-Second Clinician Brief (Chief Complaint, HPI narrative, pertinent negatives, active medications, abnormal labs, red-flag status).

### 3.3 Clinician Dashboard
- **Patient Queue & Triage Status:** Clean overview of waiting patients with color-coded urgency badges (Routine, Priority, Emergency Flag).
- **60-Second Briefing View:**
  - Top Banner: Patient ID, Age, Language, Chief Complaint, Triage Urgency.
  - Left Column: Anatomical Body Map highlighting user-selected zones with pain character badges.
  - Middle Column: HPI narrative, timeline, and pertinent negatives.
  - Right Column: Normalized medication list (with provenance badges: `OCR` vs `Patient-Stated`) and abnormal lab result callouts.
- **Clinician Action Bar:**
  - `Edit Record`: Inline editable fields for all AI-generated text.
  - `Approve & Sign`: Converts draft into approved pre-consultation record.
  - `Export FHIR / PDF`: Downloads standardized clinical exchange bundle.

---

## 4. Complete Folder & File Structure

```
PreConsult-AI/
├── ARCHITECTURE.md                  # This architectural specification
├── README.md                        # Quickstart, setup instructions, hackathon demo guide
├── docs/                            # Source documentation & PRDs
│   ├── PreConsult_AI_Scope.md       # Consolidated complete project requirements
│   ├── Visual_Symptom_PRD.md        # VSTE accessibility PRD
│   └── MediKiosk_Hackathon_Plan.md  # Step-by-step hackathon guide
├── backend/                         # FastAPI Backend Application
│   ├── requirements.txt             # Python dependencies (fastapi, uvicorn, pydantic, google-genai, sqlmodel)
│   ├── main.py                      # FastAPI entrypoint, middleware, CORS, lifecycle
│   ├── app/
│   │   ├── __init__.py
│   │   ├── core/
│   │   │   ├── config.py            # Environment settings & API keys
│   │   │   ├── safety_engine.py     # Deterministic red-flag screening engine
│   │   │   ├── socrates_engine.py   # Adaptive clinical questionnaire branching logic
│   │   │   ├── synthesizer.py       # Clinical brief & HPI LLM synthesis service
│   │   │   └── ocr_engine.py        # Document AI prescription/lab extraction pipeline
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── schemas.py           # Pydantic v2 schemas (ClinicalPreConsultRecord, etc.)
│   │   │   └── db_models.py         # SQLModel database entity definitions
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── session.py           # SQLite connection & session management
│   │   │   └── seed_data.py         # Synthetic demo patient records & red-flag scenarios
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── router.py            # Master API router
│   │   │   └── routes/
│   │   │       ├── intake.py        # Session start, body region, symptom selection, questions
│   │   │       ├── documents.py     # Prescription/lab image upload & OCR parsing
│   │   │       ├── summary.py       # Brief generation, clinician edit, approve, FHIR export
│   │   │       └── safety.py        # Safety check status & emergency log endpoints
│   │   └── services/
│   │       ├── fhir_exporter.py     # Converts clinical record to HL7 FHIR Bundle JSON
│   │       └── ai_service.py        # Gemini API client wrapper with fallback mock mode
│   └── tests/
│       ├── test_safety_engine.py    # Unit tests for deterministic emergency interception
│       ├── test_socrates_logic.py   # Unit tests for adaptive questionnaire limits
│       └── test_schemas.py          # Validation tests for Pydantic clinical records
├── frontend/                        # React + Vite Application
│   ├── package.json                 # Frontend dependencies
│   ├── vite.config.js               # Vite configuration with proxy to backend
│   ├── index.html                   # HTML5 entry with accessibility meta tags
│   ├── src/
│   │   ├── main.jsx                 # React root render
│   │   ├── App.jsx                  # Application routing & layout shell
│   │   ├── index.css                # Accessible design system (tokens, contrast, large hit targets)
│   │   ├── assets/                  # Icons, anatomical body graphics, demo assets
│   │   ├── components/
│   │   │   ├── common/              # Buttons, Cards, Modals, AudioControls, Alerts
│   │   │   ├── body_map/            # Interactive Body Map (Front/Back, Macro & Micro zones)
│   │   │   ├── symptoms/            # Semantic Visual Animations (Cramp, Burn, Sharp, Severity)
│   │   │   ├── intake/              # Adaptive SOCRATES Question Stepper & Non-speaking cards
│   │   │   ├── documents/           # Prescription/Lab Upload & OCR Extraction Preview
│   │   │   ├── safety/              # Emergency Red-Flag Intercept Modal & Triage Alert
│   │   │   └── doctor/              # Clinician Dashboard, 60s Brief, Inline Editor, Approval Bar
│   │   ├── context/
│   │   │   ├── IntakeContext.jsx    # Active patient intake session state
│   │   │   └── AccessibilityContext.jsx # Text scale, contrast mode, audio TTS toggle, reduced motion
│   │   └── services/
│   │       └── api.js               # Axios / Fetch client calling FastAPI backend
└── demo_data/                       # Curated synthetic samples for hackathon demonstration
    ├── sample_prescriptions/        # Mock prescription images
    ├── sample_lab_reports/          # Mock abnormal CBC / metabolic panel reports
    └── demo_scenarios.json          # Pre-recorded demonstration profiles (Fast 4-tap demo, Red-flag demo)
```

---

## 5. Clinical Data Schema (Pydantic v2 Definition)

The system output strictly enforces the `ClinicalPreConsultRecord` schema:

```python
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime

class TriageUrgency(str, Enum):
    ROUTINE = "ROUTINE"
    PRIORITY = "PRIORITY"
    EMERGENCY = "EMERGENCY"

class DataProvenance(str, Enum):
    PATIENT_SELECTED = "PATIENT_SELECTED"
    OCR_EXTRACTED = "OCR_EXTRACTED"
    CLINICIAN_ENTERED = "CLINICIAN_ENTERED"
    AI_INFERRED = "AI_INFERRED"

class SymptomItem(BaseModel):
    symptom_id: str
    body_macro_region: str
    anatomical_micro_zone: str
    character: str = Field(description="e.g. Burning, Cramping, Sharp, Dull")
    severity: int = Field(ge=1, le=10)
    onset_description: Optional[str] = None
    duration: Optional[str] = None
    provenance: DataProvenance = DataProvenance.PATIENT_SELECTED
    confidence: float = 1.0

class MedicationItem(BaseModel):
    name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    source: str = "Prescription OCR"
    confidence: float = Field(ge=0.0, le=1.0)
    verification_status: str = "Unconfirmed"
    provenance: DataProvenance = DataProvenance.OCR_EXTRACTED

class LabResultItem(BaseModel):
    test_name: str
    value: str
    unit: str
    reference_range: str
    is_abnormal: bool
    provenance: DataProvenance = DataProvenance.OCR_EXTRACTED

class RedFlagAlert(BaseModel):
    is_active: bool
    trigger_criteria: List[str]
    alert_message: str
    intercept_timestamp: Optional[datetime] = None

class ClinicalPreConsultRecord(BaseModel):
    record_id: str
    patient_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    chief_complaint: str
    history_of_present_illness: str
    symptoms: List[SymptomItem]
    symptom_timeline: str
    pertinent_negatives: List[str]
    active_medications: List[MedicationItem]
    abnormal_labs: List[LabResultItem]
    triage_urgency: TriageUrgency
    red_flag: RedFlagAlert
    unresolved_questions: List[str]
    clinician_approved: bool = False
    clinician_notes: Optional[str] = None
```

---

## 6. Hackathon Minimum Viable Product (MVP) Scope

To achieve a flawless, prize-winning 5-minute hackathon presentation, the MVP scope is strictly disciplined:

### In Scope for MVP
1. **Interactive Body Map:** Rotatable/flippable Front & Back human figure with macro regions (Abdomen, Chest, Head, Knee) and micro-anatomical zoom (e.g. Abdominal Quadrants).
2. **Adaptive Semantic Visuals:** Custom CSS/SVG animated representations of pain:
   - *Cramping:* Tightening band/organ animation.
   - *Burning:* Rising flame simulation.
   - *Sharp:* Pulsating needle geometry.
   - *Severity Slider:* 1–10 tactile color gradient slider.
   - Accessible static fallbacks respecting `prefers-reduced-motion`.
3. **Non-Speaking 4-Tap Flow:** A patient can complete a full clinical complaint in <4 taps without typing a single character.
4. **Adaptive SOCRATES Follow-up:** Complaint-focused branching engine with a 3–4 turn maximum limit.
5. **Deterministic Red-Flag Safety Engine:** Instant emergency interception and triage alert triggered when red-flag combinations are reported.
6. **Prescription & Lab OCR Pipeline:** Upload sample prescription/lab report with Gemini multimodal entity extraction (medication tuples + abnormal lab flags).
7. **Doctor 60-Second Briefing Dashboard:** Clean clinical dashboard displaying chief complaint, HPI, anatomical map preview, normalized medication list, abnormal lab tags, inline text editing, and one-click clinical sign-off.
8. **FHIR JSON Export:** Generate standard HL7 FHIR bundle JSON to demonstrate hospital system interoperability.
9. **Pre-Seeded Synthetic Demo Scenarios:** 3 one-click scenarios (Acute GERD Abdomen, Cardiac Red-Flag Intercept, Post-Op Knee Pain with Labs).

### Explicitly Out of Scope for Hackathon MVP
- Physical AR smart-glasses hardware integration (mocked/conceptualized via mobile web).
- Live camera 3D mixed-pill geometry segmentation (replaced by high-reliability prescription & blister OCR).
- Real-time webcam eye-gaze tracking calibration hardware (AAC tap & large touch targets used instead).
- Production EHR / hospital HIS live network integration (mocked with authentic FHIR JSON output).
- Autonomous clinical diagnosis (strictly barred by clinical safety rules).

---

## 7. Implementation Tasks & Phased Development Order

The implementation is broken into 6 tightly ordered, bite-sized tasks:

### Task 1: Backend Foundation & Clinical Schemas
- Initialize FastAPI project structure, dependencies (`fastapi`, `uvicorn`, `pydantic`, `sqlmodel`, `google-genai`).
- Implement Pydantic v2 schemas (`ClinicalPreConsultRecord`, `SymptomItem`, `MedicationItem`, `LabResultItem`, `RedFlagAlert`).
- Setup SQLite database with SQLModel for local session and audit log persistence.
- Configure CORS, error handling, and health check endpoints.

### Task 2: Deterministic Safety Engine & SOCRATES Question Logic
- Implement `DeterministicSafetyEngine` with rules for chest pain, stroke, and acute abdomen emergencies.
- Implement `AdaptiveQuestionEngine` with clinical ontology for Abdomen, Chest, and Musculoskeletal complaints.
- Ensure strict maximum 3–4 turn termination rule.
- Create automated unit tests verifying safety intercepts fire reliably.

### Task 3: AI Synthesis & OCR Ingestion Service
- Implement Gemini API integration wrapper with structured JSON response schema enforcement.
- Implement `DocumentOcrEngine` for prescription parsing (extracting drug name, dose, frequency, confidence) and lab report parsing (flagging abnormal values).
- Add synthetic offline fallback modes for OCR and synthesis to guarantee demo reliability if Wi-Fi degrades.
- Implement FHIR bundle JSON exporter (`services/fhir_exporter.py`).

### Task 4: Frontend Design System & Interactive Body Map
- Initialize React + Vite project.
- Implement accessibility-first design system in Vanilla CSS (WCAG AAA contrast, >=48px touch targets, fluid typography, dark/light clinical themes).
- Build the Interactive Body Map component (Front/Back flip, SVG macro-regions, micro-anatomical zoom).
- Build the Semantic Visual Symptom Library (Cramping, Burning, Sharp, Severity slider) with reduced-motion fallback toggles.

### Task 5: Non-Speaking Intake Flow & Accessibility Controls
- Build the intake wizard integrating Body Map -> Semantic Visual -> Adaptive Questions -> Confirmation.
- Verify the 4-tap abdominal symptom fast path works seamlessly without keyboard input.
- Integrate Web Speech API for voice dictation and audio TTS read-aloud guidance.
- Build the Emergency Red-Flag Intercept modal that immediately takes over the UI if triggered.
- Build the Prescription/Lab Document Upload and preview component.

### Task 6: 60-Second Clinician Dashboard & Demo Polish
- Build the Clinician Dashboard displaying the 60-second brief, anatomical pain pins, medication list, and abnormal lab chips.
- Add inline editable fields and "Approve & Sign" workflow.
- Add "Export FHIR" and "Export PDF" functionality.
- Integrate pre-seeded synthetic demo scenarios (One-click GERD intake, Cardiac emergency intercept, Document OCR showcase).
- Rehearse the 5-minute hackathon pitch flow.

---

## 8. Key Risks & Technical Mitigations

1. **Risk:** Unreliable Hackathon Wi-Fi / Cloud API rate-limiting during the presentation.  
   **Mitigation:** The architecture includes a deterministic local fallback mode in `ai_service.py` that serves high-fidelity pre-computed synthetic Gemini clinical outputs if the network times out (>2.5s).
2. **Risk:** LLM Hallucination or Invented Clinical Data.  
   **Mitigation:** Strict Pydantic v2 schema validation rejects any unvalidated fields; every datum retains an explicit `provenance` tag; doctors must review and approve drafts before finalization.
3. **Risk:** Missed Medical Emergencies.  
   **Mitigation:** The `DeterministicSafetyEngine` runs independently of and prior to any LLM calls; it halts intake immediately upon detecting hardcoded emergency criteria.
4. **Risk:** Cluttered UI on Mobile/Tablet Kiosk screens.  
   **Mitigation:** Dynamic zoning hides off-target anatomy; touch targets are strictly sized >=48px with generous spacing to accommodate hand tremors and low-dexterity users.
