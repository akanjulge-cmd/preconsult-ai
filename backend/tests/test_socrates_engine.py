import pytest
from app.core.socrates_engine import SocratesEngine, MAX_TURNS
from app.models.schemas import (
    AdaptiveStateRequest,
    AdaptiveAnswer,
    DataProvenance,
    TriageUrgency,
    ClinicalPreConsultRecord,
)

def test_socrates_initial_question():
    """Initial state should return Question 1 targeting the first unresolved field (radiation for Abdomen)."""
    state = AdaptiveStateRequest(
        session_id="SES-TEST-001",
        locations=[{"body_region": "Abdomen", "anatomical_zone": "Epigastrium", "side": "midline"}],
        character="Burning",
        severity=6,
        duration="2-3days",
        associated_symptoms=["nausea"],
        completed_answers=[],
    )
    res = SocratesEngine.evaluate_next_step(state)
    assert res.is_complete is False
    assert res.turn_number == 1
    assert res.next_question is not None
    assert res.next_question.target_field == "radiation"
    assert len(res.next_question.options) >= 3
    assert res.next_question.audio_prompt != ""

def test_socrates_second_question_branching():
    """After answering radiation, the engine should advance to timing_pattern."""
    state = AdaptiveStateRequest(
        session_id="SES-TEST-001",
        locations=[{"body_region": "Abdomen", "anatomical_zone": "Epigastrium", "side": "midline"}],
        character="Burning",
        severity=6,
        duration="2-3days",
        associated_symptoms=["nausea"],
        completed_answers=[
            AdaptiveAnswer(
                question_id="abd_radiation",
                target_field="radiation",
                selected_option_id="abd_rad_none",
                selected_text="Stays in one spot only (No spread)",
            )
        ],
    )
    res = SocratesEngine.evaluate_next_step(state)
    assert res.is_complete is False
    assert res.turn_number == 2
    assert res.next_question is not None
    assert res.next_question.target_field == "timing_pattern"

def test_socrates_max_turns_enforced():
    """Engine must strictly terminate when max turns (3) are reached."""
    state = AdaptiveStateRequest(
        session_id="SES-TEST-001",
        locations=[{"body_region": "Abdomen", "anatomical_zone": "Epigastrium", "side": "midline"}],
        character="Burning",
        severity=6,
        duration="2-3days",
        associated_symptoms=["nausea"],
        completed_answers=[
            AdaptiveAnswer(
                question_id="abd_radiation",
                target_field="radiation",
                selected_option_id="abd_rad_none",
                selected_text="Stays in one spot only (No spread)",
            ),
            AdaptiveAnswer(
                question_id="abd_timing_pattern",
                target_field="timing_pattern",
                selected_option_id="abd_time_postprandial",
                selected_text="Worse 30 to 60 minutes after eating",
            ),
            AdaptiveAnswer(
                question_id="abd_aggravating_relieving",
                target_field="aggravating_relieving",
                selected_option_id="abd_rel_antacids",
                selected_text="Better with antacids or drinking milk",
            ),
        ],
    )
    res = SocratesEngine.evaluate_next_step(state)
    assert res.is_complete is True
    assert res.next_question is None
    assert res.record is not None
    assert isinstance(res.record, ClinicalPreConsultRecord)

def test_socrates_grounding_and_provenance():
    """All symptoms must carry PATIENT_SELECTED provenance and only assert confirmed facts."""
    state = AdaptiveStateRequest(
        session_id="SES-TEST-PROV",
        locations=[
            {"body_region": "Abdomen", "anatomical_zone": "Epigastrium", "side": "midline"},
            {"body_region": "Abdomen", "anatomical_zone": "Right Upper Quadrant (RUQ)", "side": "right"},
        ],
        character="Burning",
        severity=7,
        duration="1week",
        associated_symptoms=["nausea"],
        completed_answers=[
            AdaptiveAnswer(
                question_id="abd_radiation",
                target_field="radiation",
                selected_option_id="abd_rad_none",
                selected_text="Stays in one spot only (No spread)",
            )
        ],
        patient_identifier="PAT-VERIFIED-99",
    )
    record = SocratesEngine.synthesize_clinical_record(state)

    # 1. Check patient identification
    assert record.patient_id == "PAT-VERIFIED-99"

    # 2. Check chief complaint
    assert "Burning" in record.chief_complaint
    assert "Epigastrium" in record.chief_complaint

    # 3. Check symptoms & provenance
    assert len(record.symptoms) == 2
    for sym in record.symptoms:
        assert sym.provenance == DataProvenance.PATIENT_SELECTED
        assert sym.confidence == 1.0
        assert sym.character == "Burning"

    # 4. Check pertinent negatives grounded in user selection
    assert any("denies" in neg.lower() for neg in record.pertinent_negatives)

    # 5. Check Pydantic model validity
    dumped = record.model_dump()
    revalidated = ClinicalPreConsultRecord.model_validate(dumped)
    assert revalidated.record_id == record.record_id

def test_pydantic_validation_fallback():
    """If malformed record dictionary is supplied, validate_with_safe_fallback must recover without crashing."""
    corrupted_data = {
        "record_id": "REC-BAD",
        "patient_id": "PAT-CORRUPT",
        "chief_complaint": "Valid complaint",
        "symptoms": "NOT_A_LIST",  # Invalid type to test recovery
        "pertinent_negatives": None,
        "triage_urgency": "INVALID_URGENCY",
    }
    recovered = SocratesEngine.validate_with_safe_fallback(corrupted_data)
    assert isinstance(recovered, ClinicalPreConsultRecord)
    assert isinstance(recovered.symptoms, list)
    assert recovered.triage_urgency in [TriageUrgency.ROUTINE, TriageUrgency.PRIORITY, TriageUrgency.EMERGENCY]
