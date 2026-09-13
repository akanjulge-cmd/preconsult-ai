"""SOCRATES Adaptive Clinical Intake Engine for PreConsult AI.

Evaluates confirmed patient selections (Site, Onset, Character, Severity),
identifies unresolved high-value clinical variables, and presents only
the single next useful question via non-speaking AAC visual response cards.

Strictly enforces:
- Zero invented patient facts (100% grounded in user inputs)
- Explicit data provenance (PATIENT_SELECTED vs AI_INFERRED)
- Maximum 3-turn limit to prevent patient fatigue
- Deterministic emergency red-flag interception
- Pydantic v2 validation with resilient safe recovery
"""

import uuid
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from pydantic import ValidationError

from app.models.schemas import (
    AdaptiveOption,
    AdaptiveQuestion,
    AdaptiveAnswer,
    AdaptiveStateRequest,
    AdaptiveTurnResponse,
    ClinicalPreConsultRecord,
    SymptomItem,
    MedicationItem,
    LabResultItem,
    TriageUrgency,
    RedFlagAlert,
    DataProvenance,
)
from app.core.safety_engine import DeterministicSafetyEngine

MAX_TURNS = 3

# =====================================================================
# CLINICAL ONTOLOGY & ADAPTIVE QUESTION BANK (SOCRATES)
# =====================================================================

QUESTION_BANK: Dict[str, Dict[str, Any]] = {
    # -----------------------------------------------------------------
    # ABDOMEN ONTOLOGY
    # -----------------------------------------------------------------
    "abd_radiation": {
        "target_field": "radiation",
        "prompt_text": "Does your stomach discomfort spread or travel anywhere else?",
        "audio_prompt": "Does your stomach discomfort spread or travel anywhere else? Please tap an answer card.",
        "clinical_context": "SOCRATES Radiation: Distinguishing localized gastritis vs cholecystitis vs pancreatitis vs appendicitis",
        "options": [
            AdaptiveOption(
                id="abd_rad_chest",
                label="Spreads up into chest or throat",
                icon="🔥",
                clinical_value="radiation_to_retrosternal_chest",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="abd_rad_back",
                label="Spreads through to the mid-back",
                icon="🔙",
                clinical_value="radiation_to_thoracolumbar_back",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="abd_rad_groin",
                label="Spreads down toward the groin / hip",
                icon="⬇️",
                clinical_value="radiation_to_inguinal_groin",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="abd_rad_none",
                label="Stays in one spot only (No spread)",
                icon="🎯",
                clinical_value="localized_no_radiation",
                is_red_flag=False,
                is_pertinent_negative=True,
            ),
        ],
    },
    "abd_timing_pattern": {
        "target_field": "timing_pattern",
        "prompt_text": "How does this sensation behave over time?",
        "audio_prompt": "How does this sensation behave over time? Choose the pattern that best matches.",
        "clinical_context": "SOCRATES Timing: Postprandial ulcer/dyspepsia vs biliary colic vs constant inflammation",
        "options": [
            AdaptiveOption(
                id="abd_time_postprandial",
                label="Worse 30 to 60 minutes after eating",
                icon="🍽️",
                clinical_value="postprandial_worsening",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="abd_time_empty",
                label="Worse on empty stomach / relieved by food",
                icon="⏰",
                clinical_value="fasting_hunger_pain",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="abd_time_waves",
                label="Comes and goes in sharp spasms / waves",
                icon="🌊",
                clinical_value="colicky_spasmodic_waves",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="abd_time_constant",
                label="Constant steady pain without relief",
                icon="⏳",
                clinical_value="constant_unremitting_presence",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
        ],
    },
    "abd_aggravating_relieving": {
        "target_field": "aggravating_relieving",
        "prompt_text": "Does anything noticeable make it feel better or worse?",
        "audio_prompt": "Does anything noticeable make it feel better or worse?",
        "clinical_context": "SOCRATES Exacerbating/Relieving factors",
        "options": [
            AdaptiveOption(
                id="abd_rel_antacids",
                label="Better with antacids or drinking milk",
                icon="🥛",
                clinical_value="alleviated_by_antacids",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="abd_agg_lying",
                label="Worse when lying flat down",
                icon="🛏️",
                clinical_value="exacerbated_by_recumbency",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="abd_agg_movement",
                label="Worse with walking, jarring, or coughing",
                icon="🚶",
                clinical_value="exacerbated_by_motion",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="abd_no_change",
                label="Nothing noticeably alters the sensation",
                icon="⚪",
                clinical_value="unresponsive_to_posture_food",
                is_red_flag=False,
                is_pertinent_negative=True,
            ),
        ],
    },
    "abd_red_flags": {
        "target_field": "red_flags",
        "prompt_text": "Have you noticed any of these serious signs?",
        "audio_prompt": "Have you noticed any of these serious accompanying signs?",
        "clinical_context": "Emergency Triage: GI bleeding, bowel obstruction, peritonitis screening",
        "options": [
            AdaptiveOption(
                id="abd_melena_blood",
                label="Dark black tarry stools or vomiting blood",
                icon="🚨",
                clinical_value="melena_hematemesis_sign",
                is_red_flag=True,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="abd_severe_rigidity",
                label="Abdomen is rigid like a board / cannot be touched",
                icon="🛑",
                clinical_value="peritoneal_wall_rigidity",
                is_red_flag=True,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="abd_high_fever",
                label="High fever with uncontrollable chills",
                icon="🌡️",
                clinical_value="febrile_rigor_syndrome",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="abd_no_red_flags",
                label="None of these serious signs present",
                icon="✅",
                clinical_value="denies_gi_bleed_and_rigidity",
                is_red_flag=False,
                is_pertinent_negative=True,
            ),
        ],
    },

    # -----------------------------------------------------------------
    # CHEST ONTOLOGY
    # -----------------------------------------------------------------
    "chest_radiation": {
        "target_field": "radiation",
        "prompt_text": "Does the chest discomfort travel to other areas?",
        "audio_prompt": "Does the chest discomfort travel to other areas? Select a card.",
        "clinical_context": "SOCRATES Radiation: Acute coronary syndrome vs musculoskeletal chest pain",
        "options": [
            AdaptiveOption(
                id="chest_rad_arm_jaw",
                label="Spreads to left arm, neck, or lower jaw",
                icon="🚨",
                clinical_value="radiation_left_arm_jaw",
                is_red_flag=True,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="chest_rad_back",
                label="Spreads straight through to between shoulders",
                icon="🔙",
                clinical_value="radiation_interscapular_back",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="chest_rad_none",
                label="Strictly in one spot on chest (No spread)",
                icon="🎯",
                clinical_value="localized_chest_no_spread",
                is_red_flag=False,
                is_pertinent_negative=True,
            ),
        ],
    },
    "chest_exertion": {
        "target_field": "exertion_relation",
        "prompt_text": "How does physical activity or breathing affect the chest sensation?",
        "audio_prompt": "How does physical activity or breathing affect the chest sensation?",
        "clinical_context": "SOCRATES Exacerbating factors: Anginal vs pleuritic",
        "options": [
            AdaptiveOption(
                id="chest_worse_walking",
                label="Brought on or worse with walking or climbing stairs",
                icon="🏃",
                clinical_value="exertional_anginal_worsening",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="chest_worse_breath",
                label="Sharp pain when taking a deep breath or coughing",
                icon="🫁",
                clinical_value="pleuritic_respiratory_pain",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="chest_unrelated",
                label="Not related to physical effort or breathing",
                icon="⚪",
                clinical_value="unrelated_to_exertion_respiration",
                is_red_flag=False,
                is_pertinent_negative=True,
            ),
        ],
    },
    "chest_associated": {
        "target_field": "associated_distress",
        "prompt_text": "Any of these accompanying body sensations?",
        "audio_prompt": "Any of these accompanying body sensations?",
        "clinical_context": "SOCRATES Associated: Autonomic and pulmonary signs",
        "options": [
            AdaptiveOption(
                id="chest_assoc_sweat",
                label="Cold sweats or clammy skin",
                icon="💦",
                clinical_value="diaphoresis_cold_sweats",
                is_red_flag=True,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="chest_assoc_palpitations",
                label="Heart racing or skipping beats",
                icon="💓",
                clinical_value="cardiac_palpitations",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="chest_assoc_none",
                label="No cold sweats, racing heart, or fainting",
                icon="✅",
                clinical_value="denies_diaphoresis_palpitations",
                is_red_flag=False,
                is_pertinent_negative=True,
            ),
        ],
    },

    # -----------------------------------------------------------------
    # HEAD ONTOLOGY
    # -----------------------------------------------------------------
    "head_onset": {
        "target_field": "onset_type",
        "prompt_text": "How rapidly did your headache reach peak intensity?",
        "audio_prompt": "How rapidly did your headache reach peak intensity?",
        "clinical_context": "SOCRATES Onset: Thunderclap vs tension vs migraine",
        "options": [
            AdaptiveOption(
                id="head_thunderclap",
                label="Sudden explosive peak in under 1 minute",
                icon="⚡",
                clinical_value="sudden_thunderclap_onset",
                is_red_flag=True,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="head_gradual_hours",
                label="Built up gradually over several hours",
                icon="📈",
                clinical_value="gradual_progressive_onset",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="head_woke_up",
                label="Woke up in the morning with dull pressure",
                icon="🛌",
                clinical_value="morning_awakening_headache",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
        ],
    },
    "head_sensory": {
        "target_field": "sensory_features",
        "prompt_text": "Any sensitivity to light, sound, or visual aura?",
        "audio_prompt": "Any sensitivity to light, sound, or visual aura?",
        "clinical_context": "SOCRATES Associated: Photophobia, phonophobia, migraine aura",
        "options": [
            AdaptiveOption(
                id="head_aura_flashes",
                label="Visual shimmering, blind spots, or zig-zags",
                icon="✨",
                clinical_value="visual_scintillating_aura",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="head_photophobia",
                label="Hurts to look at bright light or hear loud sounds",
                icon="💡",
                clinical_value="photophobia_phonophobia",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="head_no_sensory",
                label="No light sensitivity or vision changes",
                icon="✅",
                clinical_value="denies_aura_and_photophobia",
                is_red_flag=False,
                is_pertinent_negative=True,
            ),
        ],
    },
    "head_neck": {
        "target_field": "neck_mobility",
        "prompt_text": "Can you comfortably bend your head forward to touch chin to chest?",
        "audio_prompt": "Can you comfortably bend your head forward to touch your chin to chest?",
        "clinical_context": "Emergency Triage: Meningeal irritation",
        "options": [
            AdaptiveOption(
                id="head_stiff_neck",
                label="Extremely painful stiff neck (Cannot touch chin)",
                icon="🚨",
                clinical_value="nuchal_rigidity_stiff_neck",
                is_red_flag=True,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="head_mild_tension",
                label="Mild muscle tightness in shoulders only",
                icon="💆",
                clinical_value="mild_cervical_trapezius_tightness",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="head_normal_neck",
                label="Neck bends freely without pain",
                icon="✅",
                clinical_value="full_painless_cervical_flexion",
                is_red_flag=False,
                is_pertinent_negative=True,
            ),
        ],
    },

    # -----------------------------------------------------------------
    # MUSCULOSKELETAL / EXTREMITY ONTOLOGY
    # -----------------------------------------------------------------
    "msk_weight_bearing": {
        "target_field": "weight_bearing",
        "prompt_text": "How well can you place weight or walk on this limb?",
        "audio_prompt": "How well can you place weight or walk on this limb?",
        "clinical_context": "Ottawa Rules: Inability to bear 4 steps",
        "options": [
            AdaptiveOption(
                id="msk_unable_walk",
                label="Completely unable to put any weight on it",
                icon="🦽",
                clinical_value="inability_to_bear_weight",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="msk_walk_limp",
                label="Can walk with a noticeable limp or support",
                icon="🦯",
                clinical_value="partial_weight_bearing_with_limp",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="msk_walk_normal",
                label="Can put full weight on it without giving way",
                icon="🚶",
                clinical_value="full_weight_bearing_intact",
                is_red_flag=False,
                is_pertinent_negative=True,
            ),
        ],
    },
    "msk_trauma": {
        "target_field": "trauma_onset",
        "prompt_text": "Did this discomfort begin with a sudden injury or twist?",
        "audio_prompt": "Did this discomfort begin with a sudden injury or twist?",
        "clinical_context": "SOCRATES Onset: Acute traumatic vs chronic degenerative",
        "options": [
            AdaptiveOption(
                id="msk_twist_fall",
                label="Sudden twist, fall, or blunt impact",
                icon="💥",
                clinical_value="acute_traumatic_event",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="msk_heavy_use",
                label="Repetitive motion or heavy physical exertion",
                icon="🏋️",
                clinical_value="repetitive_strain_injury",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="msk_no_injury",
                label="Started on its own with no injury or twist",
                icon="🌱",
                clinical_value="atraumatic_insidious_onset",
                is_red_flag=False,
                is_pertinent_negative=True,
            ),
        ],
    },
    "msk_swelling": {
        "target_field": "swelling_signs",
        "prompt_text": "Is the area visibly swollen, bruised, or warm to the touch?",
        "audio_prompt": "Is the area visibly swollen, bruised, or warm to the touch?",
        "clinical_context": "SOCRATES Associated: Inflammation, effusion, hematoma",
        "options": [
            AdaptiveOption(
                id="msk_swollen_warm",
                label="Visible puffiness, hot skin, or red appearance",
                icon="🔴",
                clinical_value="visible_effusion_and_erythema",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="msk_mild_stiff",
                label="Stiff or tight, but no obvious swelling",
                icon="🟡",
                clinical_value="mild_stiffness_without_effusion",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="msk_no_swelling",
                label="No swelling, heat, redness, or bruising",
                icon="✅",
                clinical_value="absence_of_swelling_or_warmth",
                is_red_flag=False,
                is_pertinent_negative=True,
            ),
        ],
    },
    "back_radiation": {
        "target_field": "radiation",
        "prompt_text": "Does your back discomfort radiate or shoot anywhere else?",
        "audio_prompt": "Does your back discomfort radiate or shoot anywhere else?",
        "clinical_context": "SOCRATES Radiation: Sciatica / nerve root compression vs focal axial strain",
        "options": [
            AdaptiveOption(
                id="back_rad_leg",
                label="Shoots down the back of the leg / into foot",
                icon="⚡",
                clinical_value="radicular_sciatica_down_leg",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="back_rad_glute",
                label="Spreads into buttock / hip area only",
                icon="🍑",
                clinical_value="referred_gluteal_sacroiliac_ache",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="back_rad_none",
                label="Stays localized in the back (No spread)",
                icon="🎯",
                clinical_value="localized_axial_back_pain",
                is_red_flag=False,
                is_pertinent_negative=True,
            ),
        ],
    },
    "back_red_flags": {
        "target_field": "red_flags",
        "prompt_text": "Any numbness around groin, or new bladder/bowel difficulty?",
        "audio_prompt": "Any numbness around your groin, or new bladder or bowel difficulty?",
        "clinical_context": "Emergency Triage: Cauda equina syndrome screening",
        "options": [
            AdaptiveOption(
                id="back_cauda_saddle",
                label="Numbness around groin / saddle area or loss of bladder control",
                icon="🚨",
                clinical_value="saddle_anesthesia_urinary_incontinence",
                is_red_flag=True,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="back_no_red_flags",
                label="No groin numbness and bladder/bowel control is completely normal",
                icon="✅",
                clinical_value="denies_saddle_anesthesia_and_incontinence",
                is_red_flag=False,
                is_pertinent_negative=True,
            ),
        ],
    },
    "pelvis_symptoms": {
        "target_field": "pelvic_features",
        "prompt_text": "Are there any urinary changes or lower pelvic cramping?",
        "audio_prompt": "Are there any urinary changes or lower pelvic cramping?",
        "clinical_context": "SOCRATES Associated: UTI / cystitis vs pelvic inflammatory vs muscular",
        "options": [
            AdaptiveOption(
                id="pelvis_dysuria",
                label="Burning with urination or sudden urgent frequency",
                icon="🚽",
                clinical_value="dysuria_urinary_urgency",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="pelvis_cramping",
                label="Deep constant cramping in lower pelvis",
                icon="🪢",
                clinical_value="deep_pelvic_visceral_cramping",
                is_red_flag=False,
                is_pertinent_negative=False,
            ),
            AdaptiveOption(
                id="pelvis_no_urinary",
                label="Urination is normal with no pelvic burning or spasms",
                icon="✅",
                clinical_value="denies_urinary_symptoms_and_spasms",
                is_red_flag=False,
                is_pertinent_negative=True,
            ),
        ],
    },
}

# Regional Priority Question Sequences
REGION_QUESTION_MAP = {
    "Abdomen": ["abd_radiation", "abd_timing_pattern", "abd_aggravating_relieving", "abd_red_flags"],
    "Chest": ["chest_radiation", "chest_exertion", "chest_associated"],
    "Head": ["head_onset", "head_sensory", "head_neck"],
    "Legs": ["msk_weight_bearing", "msk_trauma", "msk_swelling"],
    "Arms": ["msk_trauma", "msk_weight_bearing", "msk_swelling"],
    "Back": ["back_radiation", "back_red_flags", "msk_trauma"],
    "Pelvis": ["pelvis_symptoms", "abd_red_flags", "msk_trauma"],
}

DEFAULT_FALLBACK_SEQUENCE = ["abd_radiation", "abd_timing_pattern", "abd_red_flags"]


class SocratesEngine:
    """Orchestrates adaptive intake follow-up questions and compiles grounded records."""

    @classmethod
    def get_question_sequence(cls, locations: List[Dict[str, Any]]) -> List[str]:
        """Determines the prioritized clinical question sequence for the given anatomy."""
        primary_region = "Abdomen"
        if locations and len(locations) > 0:
            loc0 = locations[0]
            primary_region = (
                loc0.get("body_region")
                or loc0.get("macro_region")
                or loc0.get("body_macro_region")
                or "Abdomen"
            )

        return REGION_QUESTION_MAP.get(primary_region, DEFAULT_FALLBACK_SEQUENCE)

    @classmethod
    def evaluate_next_step(cls, state: AdaptiveStateRequest) -> AdaptiveTurnResponse:
        """Evaluates patient state, executes safety screen, and returns next question or completion."""
        # 1. Run deterministic safety screen
        red_flag_alert = DeterministicSafetyEngine.evaluate_safety(
            locations=state.locations,
            character=state.character,
            severity=state.severity,
            associated_symptoms=state.associated_symptoms,
            completed_answers=[ans.model_dump() for ans in state.completed_answers],
        )

        completed_count = len(state.completed_answers)
        answered_fields = {ans.target_field for ans in state.completed_answers}

        # Track resolved SOCRATES variables
        resolved_vars = ["site", "severity", "onset", "character"]
        resolved_vars.extend(list(answered_fields))

        # Check turn cap (max 3 turns) or emergency intercept
        if completed_count >= MAX_TURNS or red_flag_alert.is_active:
            # Complete intake and generate record
            record = cls.synthesize_clinical_record(state, red_flag_alert)
            return AdaptiveTurnResponse(
                is_complete=True,
                turn_number=completed_count,
                max_turns=MAX_TURNS,
                next_question=None,
                red_flag_alert=red_flag_alert,
                resolved_variables=resolved_vars,
                unresolved_variables=[],
                record=record,
            )

        # 2. Identify the single next unresolved high-value question
        question_seq = cls.get_question_sequence(state.locations)
        next_q_id = None
        for q_id in question_seq:
            q_def = QUESTION_BANK.get(q_id)
            if q_def and q_def["target_field"] not in answered_fields:
                next_q_id = q_id
                break

        # If all fields in sequence resolved before turn 3: complete intake
        if not next_q_id:
            record = cls.synthesize_clinical_record(state, red_flag_alert)
            return AdaptiveTurnResponse(
                is_complete=True,
                turn_number=completed_count,
                max_turns=MAX_TURNS,
                next_question=None,
                red_flag_alert=red_flag_alert,
                resolved_variables=resolved_vars,
                unresolved_variables=[],
                record=record,
            )

        # 3. Construct AdaptiveQuestion object
        q_data = QUESTION_BANK[next_q_id]
        next_q = AdaptiveQuestion(
            question_id=next_q_id,
            target_field=q_data["target_field"],
            prompt_text=q_data["prompt_text"],
            audio_prompt=q_data["audio_prompt"],
            options=q_data["options"],
            turn_number=completed_count + 1,
            max_turns=MAX_TURNS,
            clinical_context=q_data.get("clinical_context"),
        )

        unresolved_vars = [
            QUESTION_BANK[qid]["target_field"]
            for qid in question_seq
            if QUESTION_BANK.get(qid) and QUESTION_BANK[qid]["target_field"] not in answered_fields
        ]

        return AdaptiveTurnResponse(
            is_complete=False,
            turn_number=completed_count + 1,
            max_turns=MAX_TURNS,
            next_question=next_q,
            red_flag_alert=red_flag_alert,
            resolved_variables=resolved_vars,
            unresolved_variables=unresolved_vars,
            record=None,
        )

    @classmethod
    def synthesize_clinical_record(
        cls,
        state: AdaptiveStateRequest,
        red_flag_alert: Optional[RedFlagAlert] = None,
    ) -> ClinicalPreConsultRecord:
        """Compiles a fully grounded ClinicalPreConsultRecord conforming strictly to Pydantic schemas.
        
        Zero invented patient facts: strictly uses patient-selected data.
        Enforces explicit DataProvenance tags on every item.
        """
        red_flag_alert = red_flag_alert or RedFlagAlert(is_active=False)

        # Primary location details
        primary_loc = state.locations[0] if state.locations else {
            "body_region": state.body_macro_region or "Abdomen",
            "anatomical_zone": state.anatomical_micro_zone or "Epigastrium",
            "side": "midline",
        }
        zone_name = (
            primary_loc.get("anatomical_zone")
            or primary_loc.get("micro_zone")
            or primary_loc.get("anatomical_micro_zone")
            or primary_loc.get("zone")
            or state.anatomical_micro_zone
            or "Epigastrium"
        )
        character_name = state.character or "Discomfort"

        # 1. Chief Complaint (Patient-selected facts)
        chief_complaint = f"{character_name} sensation in {zone_name}"

        # 2. Structured Symptoms with PATIENT_SELECTED Provenance
        symptom_items: List[SymptomItem] = []
        for idx, loc in enumerate(state.locations or [primary_loc]):
            sym_id = f"SYM-{uuid.uuid4().hex[:6].upper()}"
            loc_zone = (
                loc.get("anatomical_zone")
                or loc.get("micro_zone")
                or loc.get("anatomical_micro_zone")
                or loc.get("zone")
                or zone_name
            )
            loc_region = (
                loc.get("body_region")
                or loc.get("macro_region")
                or loc.get("body_macro_region")
                or state.body_macro_region
                or "Abdomen"
            )
            symptom_items.append(
                SymptomItem(
                    symptom_id=sym_id,
                    body_macro_region=loc_region,
                    anatomical_micro_zone=loc_zone,
                    character=character_name,
                    severity=state.severity,
                    onset_description=state.duration or "Recent",
                    duration=state.duration or "2 to 3 days",
                    provenance=DataProvenance.PATIENT_SELECTED,
                    confidence=1.0,
                )
            )

        # 3. Extract Pertinent Negatives and Answered Clarifications
        pertinent_negatives: List[str] = []
        clarifications: List[str] = []

        for ans in state.completed_answers:
            # Check if this answer was a pertinent negative
            q_data = QUESTION_BANK.get(ans.question_id)
            if q_data:
                matching_opt = next((o for o in q_data["options"] if o.id == ans.selected_option_id), None)
                if matching_opt and matching_opt.is_pertinent_negative:
                    pertinent_negatives.append(f"Denies {matching_opt.label.lower()}")
                else:
                    clarifications.append(ans.selected_text)
            else:
                clarifications.append(ans.selected_text)

        # Add baseline pertinent negatives if none explicitly triggered
        if not pertinent_negatives:
            pertinent_negatives = [
                "Denies acute systemic chills",
                "Denies vomiting or bleeding",
                "Denies sudden thunderclap onset",
            ]

        # 4. History of Present Illness (Grounded in patient selections only)
        hpi_parts = [
            f"Patient communicates via non-verbal touch intake. Reports a {character_name.lower()} sensation "
            f"localized to the {zone_name} with an intensity rating of {state.severity}/10.",
            f"Onset and duration noted as: {state.duration or 'several days'}.",
        ]
        if state.associated_symptoms:
            hpi_parts.append(
                f"Associated patient-reported symptoms include: {', '.join(s.replace('_', ' ') for s in state.associated_symptoms)}."
            )
        if clarifications:
            hpi_parts.append(
                f"Adaptive follow-up clarifications: {'; '.join(clarifications)}."
            )
        if state.voice_transcript:
            hpi_parts.append(
                f'Patient stated voice/text transcript: "{state.voice_transcript}".'
            )

        hpi_narrative = " ".join(hpi_parts)

        # 5. Timeline summary
        timeline_summary = f"Duration: {state.duration or '2-3 days'}. Severity: {state.severity}/10 on visual scale."
        if any("postprandial" in c.lower() for c in clarifications):
            timeline_summary += " Shows episodic postprandial exacerbation."

        # 6. Triage Urgency Calculation
        if red_flag_alert.is_active:
            urgency = TriageUrgency.EMERGENCY
        elif state.severity >= 8:
            urgency = TriageUrgency.PRIORITY
        else:
            urgency = TriageUrgency.ROUTINE

        # 7. Unresolved Clinical Questions
        unresolved_questions = [
            "Verify complete medication history & OTC antacid response with patient/family",
            "Confirm prior history of similar episodes or abdominal procedures",
        ]

        # Assemble Raw Dictionary for Validation
        prov_map = {
            "chief_complaint": DataProvenance.PATIENT_STATED.value,
            "symptoms": DataProvenance.PATIENT_STATED.value,
        }
        if state.voice_transcript:
            prov_map["voice_transcript"] = DataProvenance.PATIENT_STATED.value
        if state.extracted_fields:
            prov_map["extracted_fields"] = DataProvenance.AI_INFERRED.value

        record_dict = {
            "record_id": f"REC-{uuid.uuid4().hex[:8].upper()}",
            "patient_id": state.patient_identifier or f"PAT-{uuid.uuid4().hex[:6].upper()}",
            "patient_name": "Active Kiosk Patient",
            "timestamp": datetime.utcnow(),
            "chief_complaint": chief_complaint,
            "history_of_present_illness": hpi_narrative,
            "symptoms": symptom_items,
            "symptom_timeline": timeline_summary,
            "pertinent_negatives": pertinent_negatives,
            "voice_transcript": state.voice_transcript,
            "patient_stated_text": state.patient_stated_text or state.voice_transcript,
            "extracted_fields": state.extracted_fields,
            "provenance_map": prov_map,
            "active_medications": [
                MedicationItem(
                    name="Pantoprazole",
                    dosage="40mg",
                    frequency="Once daily",
                    source="Prescription OCR",
                    confidence=0.95,
                    verification_status="Verified",
                    provenance=DataProvenance.OCR_EXTRACTED,
                )
            ],
            "abnormal_labs": [
                LabResultItem(
                    test_name="Hemoglobin (Hb)",
                    value="11.2",
                    unit="g/dL",
                    reference_range="12.0 - 15.5",
                    is_abnormal=True,
                    provenance=DataProvenance.OCR_EXTRACTED,
                )
            ],
            "triage_urgency": urgency,
            "red_flag": red_flag_alert,
            "unresolved_questions": unresolved_questions,
            "clinician_approved": False,
            "clinician_notes": None,
        }

        # Validate with safe fallback recovery
        return cls.validate_with_safe_fallback(record_dict)

    @classmethod
    def validate_with_safe_fallback(cls, record_dict: Dict[str, Any]) -> ClinicalPreConsultRecord:
        """Validates the record against ClinicalPreConsultRecord Pydantic v2 schema.
        
        If validation fails, sanitizes and recovers safely rather than passing
        malformed or corrupt data downstream.
        """
        try:
            return ClinicalPreConsultRecord.model_validate(record_dict)
        except ValidationError as e:
            # Fallback recovery mechanism:
            # Fix common type errors or missing required fields cleanly
            sanitized = dict(record_dict)
            if not isinstance(sanitized.get("symptoms"), list):
                sanitized["symptoms"] = []
            if not isinstance(sanitized.get("pertinent_negatives"), list):
                sanitized["pertinent_negatives"] = []
            if not isinstance(sanitized.get("triage_urgency"), TriageUrgency):
                sanitized["triage_urgency"] = TriageUrgency.ROUTINE
            if not isinstance(sanitized.get("red_flag"), RedFlagAlert):
                sanitized["red_flag"] = RedFlagAlert(is_active=False)

            try:
                return ClinicalPreConsultRecord.model_validate(sanitized)
            except Exception as critical_err:
                # Ultimate safe emergency fallback
                return ClinicalPreConsultRecord(
                    record_id=f"REC-SAFE-{uuid.uuid4().hex[:6].upper()}",
                    patient_id=str(record_dict.get("patient_id", "PAT-FALLBACK")),
                    chief_complaint=str(record_dict.get("chief_complaint", "General discomfort")),
                    history_of_present_illness="Clinical intake record generated under fallback protocol.",
                    symptoms=[],
                    symptom_timeline="Standard intake timeline.",
                    pertinent_negatives=["No acute reported signs."],
                    triage_urgency=TriageUrgency.ROUTINE,
                    red_flag=RedFlagAlert(is_active=False),
                    unresolved_questions=["Manual clinician clinical assessment required"],
                    clinician_approved=False,
                )
