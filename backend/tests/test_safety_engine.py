import pytest
from app.core.safety_engine import DeterministicSafetyEngine
from app.models.schemas import AdaptiveAnswer

def test_cardiac_red_flag_radiation():
    locations = [{"body_region": "Chest", "anatomical_zone": "Precordial Left Chest", "side": "left"}]
    answers = [
        AdaptiveAnswer(
            question_id="chest_radiation",
            target_field="radiation",
            selected_option_id="chest_rad_arm_jaw",
            selected_text="Spreads to left arm, neck, or lower jaw"
        )
    ]
    alert = DeterministicSafetyEngine.evaluate_safety(
        locations=locations,
        character="Sharp",
        severity=7,
        associated_symptoms=[],
        completed_answers=[a.model_dump() for a in answers]
    )
    assert alert.is_active is True
    assert any("Radiation" in c for c in alert.trigger_criteria)
    assert "CARDIAC" in alert.alert_message

def test_cardiac_red_flag_high_severity():
    locations = [{"body_region": "Chest", "anatomical_zone": "Retrosternal", "side": "midline"}]
    alert = DeterministicSafetyEngine.evaluate_safety(
        locations=locations,
        character="Pressure",
        severity=9,
        associated_symptoms=["shortness_of_breath"],
        completed_answers=[]
    )
    assert alert.is_active is True
    assert "High Severity (9/10)" in alert.trigger_criteria

def test_gi_hemorrhage_red_flag():
    locations = [{"body_region": "Abdomen", "anatomical_zone": "Epigastrium", "side": "midline"}]
    answers = [
        AdaptiveAnswer(
            question_id="abd_red_flags",
            target_field="red_flags",
            selected_option_id="abd_melena_blood",
            selected_text="Dark black tarry stools or vomiting blood"
        )
    ]
    alert = DeterministicSafetyEngine.evaluate_safety(
        locations=locations,
        character="Burning",
        severity=6,
        associated_symptoms=[],
        completed_answers=[a.model_dump() for a in answers]
    )
    assert alert.is_active is True
    assert "GI Bleeding" in alert.trigger_criteria[1] or "Gastrointestinal" in alert.trigger_criteria[1]

def test_safe_routine_path():
    locations = [{"body_region": "Abdomen", "anatomical_zone": "Epigastrium", "side": "midline"}]
    answers = [
        AdaptiveAnswer(
            question_id="abd_radiation",
            target_field="radiation",
            selected_option_id="abd_rad_none",
            selected_text="Stays in one spot only (No spread)"
        )
    ]
    alert = DeterministicSafetyEngine.evaluate_safety(
        locations=locations,
        character="Burning",
        severity=5,
        associated_symptoms=["nausea"],
        completed_answers=[a.model_dump() for a in answers]
    )
    assert alert.is_active is False
    assert len(alert.trigger_criteria) == 0
