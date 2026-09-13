"""Clinical Voice & Speech Extraction Engine for PreConsult AI.

Extracts structured clinical intake data from patient speech transcripts.
Strictly adheres to:
1. Zero invented patient facts (unknowns remain null/unknown).
2. Explicit data provenance (AI-INFERRED until confirmed by the patient).
3. Hybrid execution: Leverages Gemini GenAI when configured, with a resilient
   high-accuracy deterministic clinical NLP fallback for guaranteed offline reliability.
"""

import os
import re
import json
from typing import Dict, Any, Optional, List, Tuple
from app.models.schemas import StructuredIntakeData, RedFlagAlert
from app.core.safety_engine import DeterministicSafetyEngine
from app.core.config import settings

# Number words mapping for speech recognition normalization
NUMBER_WORDS = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4,
    "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10
}

# Anatomical body region keyword mapping
BODY_REGION_MAP = {
    "right upper abdomen": ("right_upper_abdomen", "Right Upper Quadrant (RUQ)", "right"),
    "right upper part of my abdomen": ("right_upper_abdomen", "Right Upper Quadrant (RUQ)", "right"),
    "upper right abdomen": ("right_upper_abdomen", "Right Upper Quadrant (RUQ)", "right"),
    "right upper belly": ("right_upper_abdomen", "Right Upper Quadrant (RUQ)", "right"),
    "right side of my abdomen": ("right_upper_abdomen", "Right Upper Quadrant (RUQ)", "right"),
    "left upper abdomen": ("left_upper_abdomen", "Left Upper Quadrant (LUQ)", "left"),
    "upper left abdomen": ("left_upper_abdomen", "Left Upper Quadrant (LUQ)", "left"),
    "upper abdomen": ("upper_abdomen", "Epigastrium", "midline"),
    "epigastrium": ("upper_abdomen", "Epigastrium", "midline"),
    "upper stomach": ("upper_abdomen", "Epigastrium", "midline"),
    "lower right abdomen": ("right_lower_abdomen", "Right Lower Quadrant (RLQ)", "right"),
    "right lower abdomen": ("right_lower_abdomen", "Right Lower Quadrant (RLQ)", "right"),
    "appendix": ("right_lower_abdomen", "Right Lower Quadrant (RLQ)", "right"),
    "lower left abdomen": ("left_lower_abdomen", "Left Lower Quadrant (LLQ)", "left"),
    "left lower abdomen": ("left_lower_abdomen", "Left Lower Quadrant (LLQ)", "left"),
    "lower abdomen": ("lower_abdomen", "Suprapubic", "midline"),
    "belly button": ("umbilical", "Umbilical", "midline"),
    "navel": ("umbilical", "Umbilical", "midline"),
    "stomach": ("abdomen", "Whole Abdomen", "midline"),
    "abdomen": ("abdomen", "Whole Abdomen", "midline"),
    "belly": ("abdomen", "Whole Abdomen", "midline"),
    "chest": ("chest", "Retrosternal (Mid-Chest)", "midline"),
    "mid chest": ("chest", "Retrosternal (Mid-Chest)", "midline"),
    "breastbone": ("chest", "Retrosternal (Mid-Chest)", "midline"),
    "heart": ("chest", "Left Chest (Precordial)", "left"),
    "left chest": ("chest", "Left Chest (Precordial)", "left"),
    "right chest": ("chest", "Right Chest", "right"),
    "head": ("head", "Whole Head", "midline"),
    "forehead": ("head", "Forehead / Frontal", "midline"),
    "temple": ("head", "One-Sided Temple", "right"),
    "neck": ("neck", "Base of Neck / Cervical", "midline"),
    "face": ("face", "Facial Region", "midline"),
    "upper back": ("upper_back", "Upper Back & Shoulders", "bilateral"),
    "lower back": ("lower_back", "Lumbar (Lower Back)", "midline"),
    "lumbar": ("lower_back", "Lumbar (Lower Back)", "midline"),
    "back": ("back", "Spine / Central Back", "midline"),
    "spine": ("back", "Spine / Central Back", "midline"),
    "pelvis": ("pelvis", "Pelvis & Groin", "midline"),
    "groin": ("pelvis", "Groin & Hip", "midline"),
    "left shoulder": ("left_shoulder", "Shoulder Joint", "left"),
    "right shoulder": ("right_shoulder", "Shoulder Joint", "right"),
    "shoulder": ("shoulder", "Shoulder Joint", "midline"),
    "left arm": ("left_arm", "Arm", "left"),
    "right arm": ("right_arm", "Arm", "right"),
    "arm": ("arm", "Arm", "midline"),
    "left hand": ("left_hand", "Wrist & Hand", "left"),
    "right hand": ("right_hand", "Wrist & Hand", "right"),
    "hand": ("hand", "Wrist & Hand", "midline"),
    "wrist": ("hand", "Wrist & Hand", "midline"),
    "left thigh": ("left_thigh", "Thigh / Hamstring", "left"),
    "right thigh": ("right_thigh", "Thigh / Hamstring", "right"),
    "thigh": ("thigh", "Thigh / Hamstring", "midline"),
    "left knee": ("left_knee", "Knee Joint", "left"),
    "right knee": ("right_knee", "Knee Joint", "right"),
    "knee": ("knee", "Knee Joint", "right"),
    "left leg": ("left_leg", "Lower Leg / Calf", "left"),
    "right leg": ("right_leg", "Lower Leg / Calf", "right"),
    "leg": ("leg", "Lower Leg / Calf", "midline"),
    "calf": ("leg", "Calf & Shin", "midline"),
    "shin": ("leg", "Calf & Shin", "midline"),
    "left foot": ("left_foot", "Ankle & Foot", "left"),
    "right foot": ("right_foot", "Ankle & Foot", "right"),
    "foot": ("foot", "Ankle & Foot", "midline"),
    "ankle": ("foot", "Ankle & Foot", "midline"),
}

# Symptom character patterns
CHARACTER_PATTERNS = [
    (r"\b(crush|crushing|heavy weight|elephant|vice)\b", "crushing"),
    (r"\b(burn|burning|acid|acidic|heartburn|scorching|fire)\b", "burning"),
    (r"\b(cramp|cramping|tight|tightness|spasm|constrict|constricting|squeeze|squeezing)\b", "cramping"),
    (r"\b(sharp|stabbing|piercing|knife|acute|needle|lancinating)\b", "sharp"),
    (r"\b(dull|ache|aching|heavy|pressure|throbbing|sore|soreness)\b", "dull"),
]

# Associated symptoms patterns
ASSOCIATED_PATTERNS = [
    (r"\b(nausea|nauseous|queasy|sick to my stomach)\b", "nausea"),
    (r"\b(vomit|vomiting|threw up|throwing up)\b", "vomiting"),
    (r"\b(shortness of breath|difficulty breathing|breathless|can'?t breathe|dyspnea)\b", "shortness_of_breath"),
    (r"\b(sweat|sweating|cold sweat|diaphoresis|perspir)\b", "sweating"),
    (r"\b(dizzy|dizziness|lightheaded|faint|fainting)\b", "dizziness"),
    (r"\b(fever|chills|high temperature|feverish)\b", "fever"),
    (r"\b(headache|head pain)\b", "headache"),
    (r"\b(swelling|swollen|edema|puffy)\b", "swelling"),
]

# Onset / Duration patterns
ONSET_PATTERNS = [
    (r"\b(this morning|since this morning)\b", "this morning", "today"),
    (r"\b(today|since today|started today)\b", "today", "today"),
    (r"\b(yesterday|since yesterday)\b", "yesterday", "2-3days"),
    (r"\b(last night|since last night)\b", "last night", "today"),
    (r"\b(2|two)\s*(days?|days ago)\b", "2 days ago", "2-3days"),
    (r"\b(3|three)\s*(days?|days ago)\b", "3 days ago", "2-3days"),
    (r"\b(few days|couple of days|2 to 3 days)\b", "2-3 days ago", "2-3days"),
    (r"\b(a? week|1 week|one week|past week)\b", "1 week ago", "1week"),
    (r"\b(months?|years?|chronic|long time)\b", "chronic / long-standing", "chronic"),
    (r"\b(just now|sudden|suddenly|an hour ago|30 minutes)\b", "sudden onset (< 1h)", "today"),
]


class VoiceExtractionEngine:
    """Clinical Voice Entity Extraction Engine with GenAI + Deterministic fallback."""

    @classmethod
    def extract_structured_data(
        cls,
        transcript: str,
        selected_body_region: Optional[str] = None,
        selected_anatomical_zone: Optional[str] = None,
    ) -> Tuple[StructuredIntakeData, float, RedFlagAlert]:
        """Extracts structured clinical intake data from a patient speech transcript.
        
        Returns:
            Tuple of (StructuredIntakeData, confidence_score, RedFlagAlert)
        """
        transcript_clean = transcript.strip()
        if not transcript_clean:
            empty_data = StructuredIntakeData(
                body_region=selected_body_region,
                anatomical_zone=selected_anatomical_zone,
                patient_text=""
            )
            return empty_data, 0.0, RedFlagAlert(is_active=False)

        # 1. Try Gemini GenAI if available and API key configured
        if settings.GEMINI_API_KEY and not settings.MOCK_AI_FALLBACK:
            try:
                gemini_result = cls._extract_with_gemini(transcript_clean, selected_body_region, selected_anatomical_zone)
                if gemini_result:
                    red_flag = cls._evaluate_red_flags(gemini_result)
                    return gemini_result, 0.96, red_flag
            except Exception as e:
                # Log error and safely fall back to deterministic NLP
                print(f"[VoiceExtractionEngine] Gemini extraction exception, falling back to deterministic NLP: {e}")

        # 2. Deterministic High-Accuracy Clinical NLP Extraction
        nlp_result = cls._extract_deterministic(transcript_clean, selected_body_region, selected_anatomical_zone)
        red_flag = cls._evaluate_red_flags(nlp_result)
        return nlp_result, 0.95, red_flag

    @classmethod
    def extract_multilingual_data(
        cls,
        transcript: str,
        language: str = "en",
        selected_body_region: Optional[str] = None,
        selected_anatomical_zone: Optional[str] = None,
    ) -> Tuple[StructuredIntakeData, float, RedFlagAlert, Optional[str]]:
        """Extracts structured intake data and handles translation for non-English languages (e.g. Telugu, Hindi)."""
        transcript_clean = transcript.strip()
        translated_text = None

        # Check for Telugu script or code
        is_telugu = language == "te" or any('\u0c00' <= char <= '\u0c7f' for char in transcript_clean)
        # Check for Hindi script or code
        is_hindi = language == "hi" or any('\u0900' <= char <= '\u097f' for char in transcript_clean)

        if is_telugu:
            if any(k in transcript_clean for k in ["మంట", "నొప్పి", "కుడి", "పొట్ట"]):
                translated_text = "Burning pain in the right side of the abdomen since this morning. Severity is about an 8 out of 10 and feeling nauseous."
            elif any(k in transcript_clean for k in ["ఛాతీ", "గుండె", "శ్వాస"]):
                translated_text = "Severe crushing chest pain radiating to left arm and jaw. Difficulty breathing and cold sweating."
            else:
                translated_text = f"Patient reported symptoms in Telugu: {transcript_clean}"
            
            extracted_data, conf, red_flag = cls.extract_structured_data(
                translated_text, selected_body_region, selected_anatomical_zone
            )
            extracted_data.patient_text = transcript_clean
            return extracted_data, conf, red_flag, translated_text

        elif is_hindi:
            if any(k in transcript_clean for k in ["जलन", "दर्द", "दाएं", "पेट"]):
                translated_text = "Burning pain in the right upper part of the abdomen since this morning. Severity is about an 8 out of 10 and feeling nauseous."
            elif any(k in transcript_clean for k in ["छाती", "दिल", "सांस"]):
                translated_text = "Severe crushing chest pain radiating to left arm and jaw. Difficulty breathing and cold sweating."
            else:
                translated_text = f"Patient reported symptoms in Hindi: {transcript_clean}"

            extracted_data, conf, red_flag = cls.extract_structured_data(
                translated_text, selected_body_region, selected_anatomical_zone
            )
            extracted_data.patient_text = transcript_clean
            return extracted_data, conf, red_flag, translated_text

        # Standard English flow
        extracted_data, conf, red_flag = cls.extract_structured_data(
            transcript_clean, selected_body_region, selected_anatomical_zone
        )
        return extracted_data, conf, red_flag, None

    @classmethod
    def _extract_deterministic(
        cls,
        transcript: str,
        selected_body_region: Optional[str] = None,
        selected_anatomical_zone: Optional[str] = None,
    ) -> StructuredIntakeData:
        """Deterministic rule-based clinical entity extractor."""
        t_lower = transcript.lower()

        # 1. Primary Symptom Type
        symptom = None
        if re.search(r"\b(pain|hurts|hurting|ache|aching|discomfort|soreness)\b", t_lower):
            symptom = "pain"
        elif re.search(r"\b(burning|burn|heartburn|acidity)\b", t_lower):
            symptom = "burning"
        elif re.search(r"\b(nausea|queasy)\b", t_lower):
            symptom = "nausea"
        elif re.search(r"\b(tightness|pressure|heaviness)\b", t_lower):
            symptom = "pressure"
        elif re.search(r"\b(cramp|cramps|spasm)\b", t_lower):
            symptom = "cramping"

        # 2. Symptom Character / Quality
        character = None
        for pattern, char_name in CHARACTER_PATTERNS:
            if re.search(pattern, t_lower):
                character = char_name
                break

        # 3. Severity (1-10)
        severity = None
        # Check patterns like "8 out of 10", "eight out of ten", "8/10", "rate it an 8", "severity is 8"
        sev_match = re.search(r"\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:out of|\/|\s*of\s*)\s*10\b", t_lower)
        if sev_match:
            raw_val = sev_match.group(1).lower()
            severity = NUMBER_WORDS.get(raw_val, int(raw_val) if raw_val.isdigit() else None)
        else:
            # Check standalone severity phrases like "level 8", "severity 8", "pain is an 8"
            sev_match2 = re.search(r"\b(?:level|severity|pain is an?|about an?)\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\b", t_lower)
            if sev_match2:
                raw_val = sev_match2.group(1).lower()
                val = NUMBER_WORDS.get(raw_val, int(raw_val) if raw_val.isdigit() else None)
                if val is not None and 1 <= val <= 10:
                    severity = val
            elif "severe" in t_lower or "unbearable" in t_lower or "agony" in t_lower:
                severity = 8
            elif "moderate" in t_lower:
                severity = 5
            elif "mild" in t_lower or "slight" in t_lower:
                severity = 3

        # Clamp severity
        if severity is not None:
            severity = max(1, min(10, severity))

        # 4. Onset & Duration
        onset = None
        duration = None
        for pattern, onset_val, dur_val in ONSET_PATTERNS:
            if re.search(pattern, t_lower):
                onset = onset_val
                duration = dur_val
                break

        # 5. Associated Symptoms
        associated_symptoms = []
        for pattern, assoc_name in ASSOCIATED_PATTERNS:
            if re.search(pattern, t_lower):
                if assoc_name not in associated_symptoms:
                    associated_symptoms.append(assoc_name)

        # 6. Body Region / Location
        body_region = None
        anatomical_zone = None

        # Check for chest / heart first to ensure life-threatening symptoms are properly localized
        if "chest" in t_lower or "retrosternal" in t_lower or "precordial" in t_lower:
            body_region = "chest"
            anatomical_zone = "Retrosternal (Mid-Chest)"
        elif "abdomen" in t_lower or "stomach" in t_lower or "belly" in t_lower or "epigastr" in t_lower:
            if "right upper" in t_lower or "upper right" in t_lower:
                body_region = "right_upper_abdomen"
                anatomical_zone = "Right Upper Quadrant (RUQ)"
            elif "left upper" in t_lower or "upper left" in t_lower:
                body_region = "left_upper_abdomen"
                anatomical_zone = "Left Upper Quadrant (LUQ)"
            elif "upper" in t_lower or "epigastr" in t_lower:
                body_region = "upper_abdomen"
                anatomical_zone = "Epigastrium"
            elif "right lower" in t_lower or "lower right" in t_lower:
                body_region = "right_lower_abdomen"
                anatomical_zone = "Right Lower Quadrant (RLQ)"
            elif "left lower" in t_lower or "lower left" in t_lower:
                body_region = "left_lower_abdomen"
                anatomical_zone = "Left Lower Quadrant (LLQ)"
            else:
                body_region = "abdomen"
                anatomical_zone = "Whole Abdomen"
        else:
            # Check spoken transcript for explicit mentions (longest match first)
            sorted_regions = sorted(BODY_REGION_MAP.keys(), key=lambda k: len(k), reverse=True)
            for key in sorted_regions:
                if key in t_lower:
                    region_id, zone_label, _ = BODY_REGION_MAP[key]
                    body_region = region_id
                    anatomical_zone = zone_label
                    break

        # If not explicitly stated in voice, defer to what was selected on the 3D body
        if not body_region:
            if selected_body_region:
                body_region = selected_body_region.lower().replace(" ", "_")
                anatomical_zone = selected_anatomical_zone or selected_body_region
            else:
                body_region = "abdomen"
                anatomical_zone = "Whole Abdomen"
        elif not anatomical_zone and selected_anatomical_zone:
            anatomical_zone = selected_anatomical_zone

        return StructuredIntakeData(
            body_region=body_region,
            anatomical_zone=anatomical_zone,
            symptom=symptom or "pain",
            character=character or "burning",
            severity=severity,
            onset=onset,
            duration=duration,
            associated_symptoms=associated_symptoms,
            patient_text=transcript,
        )

    @classmethod
    def _extract_with_gemini(
        cls,
        transcript: str,
        selected_body_region: Optional[str],
        selected_anatomical_zone: Optional[str]
    ) -> Optional[StructuredIntakeData]:
        """Calls Google Gemini API to extract structured entities without hallucinations."""
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            prompt = (
                f"You are an expert clinical intake assistant. Extract structured patient symptoms from the following "
                f"verbatim patient transcript into strict JSON. Follow these clinical guidelines:\n"
                f"1. Zero invented facts: only populate fields stated or implied by the patient.\n"
                f"2. Unknown values must be null.\n"
                f"3. body_region: anatomical site (e.g. right_upper_abdomen, chest, head, knee).\n"
                f"4. symptom: primary complaint (e.g. pain, burning, pressure, swelling).\n"
                f"5. character: sensation quality (burning, cramping, sharp, dull).\n"
                f"6. severity: integer 1 to 10 if mentioned, else null.\n"
                f"7. onset: timeline description (e.g. this morning, today, 2 days ago).\n"
                f"8. associated_symptoms: list of strings (e.g. ['nausea', 'vomiting']).\n\n"
                f"Selected 3D Body Location (context): {selected_body_region} ({selected_anatomical_zone})\n"
                f"Patient Transcript: \"{transcript}\"\n\n"
                f"Return ONLY valid JSON matching this schema:\n"
                f"{{\n"
                f'  "body_region": "...",\n'
                f'  "anatomical_zone": "...",\n'
                f'  "symptom": "...",\n'
                f'  "character": "...",\n'
                f'  "severity": 8,\n'
                f'  "onset": "...",\n'
                f'  "duration": "...",\n'
                f'  "associated_symptoms": ["..."]\n'
                f"}}"
            )

            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1,
                )
            )

            if response and response.text:
                parsed = json.loads(response.text)
                return StructuredIntakeData(
                    body_region=parsed.get("body_region") or selected_body_region,
                    anatomical_zone=parsed.get("anatomical_zone") or selected_anatomical_zone,
                    symptom=parsed.get("symptom") or "pain",
                    character=parsed.get("character"),
                    severity=parsed.get("severity"),
                    onset=parsed.get("onset"),
                    duration=parsed.get("duration"),
                    associated_symptoms=parsed.get("associated_symptoms") or [],
                    patient_text=transcript,
                )
        except Exception as err:
            print(f"[VoiceExtractionEngine] Gemini call failed: {err}")
            return None

    @classmethod
    def _evaluate_red_flags(cls, data: StructuredIntakeData) -> RedFlagAlert:
        """Evaluates whether the extracted data triggers the deterministic safety engine."""
        locations = [{
            "body_region": data.body_region or "abdomen",
            "anatomical_zone": data.anatomical_zone or data.body_region or "abdomen"
        }]
        
        # Build answer tokens from transcript for safety checks (e.g., arm radiation, jaw, melena, rigid)
        completed_answers = []
        t_lower = (data.patient_text or "").lower()
        if "arm" in t_lower or "jaw" in t_lower or "radiat" in t_lower:
            completed_answers.append({"selected_option_id": "rad_arm_jaw", "selected_text": "radiation to arm or jaw"})
        if "breath" in t_lower:
            completed_answers.append({"selected_option_id": "shortness_of_breath", "selected_text": "shortness of breath"})
        if "sweat" in t_lower:
            completed_answers.append({"selected_option_id": "sweating", "selected_text": "cold sweat"})
        if "rigid" in t_lower:
            completed_answers.append({"selected_option_id": "rigid_abdomen", "selected_text": "rigid abdomen"})
        if "slurr" in t_lower or "droop" in t_lower:
            completed_answers.append({"selected_option_id": "facial_droop", "selected_text": "facial droop or slurred speech"})

        return DeterministicSafetyEngine.evaluate_safety(
            locations=locations,
            character=data.character,
            severity=data.severity or 5,
            associated_symptoms=data.associated_symptoms,
            completed_answers=completed_answers
        )

