"""Deterministic Safety Engine for PreConsult AI.

Executes synchronous, rule-based screening on patient intake selections
to intercept life-threatening emergencies without unconstrained LLM delay.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from app.models.schemas import RedFlagAlert

class DeterministicSafetyEngine:
    """Evaluates clinical red flags deterministically based on hardcoded clinical rules."""

    @classmethod
    def evaluate_safety(
        cls,
        locations: List[Dict[str, Any]],
        character: Optional[str],
        severity: int,
        associated_symptoms: List[str],
        completed_answers: Optional[List[Dict[str, Any]]] = None,
    ) -> RedFlagAlert:
        """Evaluates patient inputs against clinical emergency criteria."""
        completed_answers = completed_answers or []
        
        # Normalize inputs for keyword matching
        regions = {loc.get("body_region", "").lower() for loc in locations}
        zones = {loc.get("anatomical_zone", "").lower() for loc in locations}
        assoc = {s.lower().replace(" ", "_") for s in associated_symptoms}
        
        # Collect answers and selected option IDs
        answer_values = set()
        for ans in completed_answers:
            if isinstance(ans, dict):
                answer_values.add(str(ans.get("selected_option_id", "")).lower())
                answer_values.add(str(ans.get("selected_text", "")).lower())
            else:
                answer_values.add(str(getattr(ans, "selected_option_id", "")).lower())
                answer_values.add(str(getattr(ans, "selected_text", "")).lower())

        is_chest = "chest" in regions or any("chest" in z or "retrosternal" in z or "precordial" in z for z in zones)
        is_abdomen = "abdomen" in regions or any("abdomen" in z or "epigastr" in z or "umbilical" in z or "quadrant" in z for z in zones)
        is_head = "head" in regions or any("head" in z or "temple" in z or "occipital" in z for z in zones)

        # -------------------------------------------------------------
        # 1. CARDIAC RED FLAG
        # Chest pain + radiation to arm/jaw OR diaphoresis OR dyspnea OR severe crushing
        # -------------------------------------------------------------
        cardiac_radiation = any("jaw" in a or "arm" in a or "rad_arm_jaw" in a for a in answer_values)
        cardiac_dyspnea = "shortness_of_breath" in assoc or any("breath" in a for a in answer_values)
        cardiac_sweating = "sweating" in assoc or any("sweat" in a for a in answer_values)

        if is_chest and (cardiac_radiation or cardiac_dyspnea or cardiac_sweating or severity >= 8):
            triggers = ["Chest Pain Location"]
            if cardiac_radiation:
                triggers.append("Radiation to Left Arm / Jaw")
            if cardiac_dyspnea:
                triggers.append("Shortness of Breath")
            if cardiac_sweating:
                triggers.append("Diaphoresis / Cold Sweating")
            if severity >= 8:
                triggers.append(f"High Severity ({severity}/10)")

            return RedFlagAlert(
                is_active=True,
                trigger_criteria=triggers,
                alert_message=(
                    "CRITICAL CARDIAC WARNING: Chest discomfort with high-risk radiation or distress markers. "
                    "Emergency protocol initiated. Clinical triage team notified immediately."
                ),
                intercept_timestamp=datetime.utcnow(),
            )

        # -------------------------------------------------------------
        # 2. GI HEMORRHAGE RED FLAG
        # Abdominal pain + dark/black tarry stools (melena) or vomiting blood (hematemesis)
        # -------------------------------------------------------------
        has_melena = any("melena" in a or "black_stool" in a or "blood" in a or "tarry" in a for a in answer_values)
        if is_abdomen and has_melena:
            return RedFlagAlert(
                is_active=True,
                trigger_criteria=["Abdominal Pain", "Gastrointestinal Bleeding / Melena / Hematemesis"],
                alert_message=(
                    "CRITICAL GI WARNING: Suspected upper or lower gastrointestinal hemorrhage. "
                    "Routine questionnaire halted for urgent clinical evaluation."
                ),
                intercept_timestamp=datetime.utcnow(),
            )

        # -------------------------------------------------------------
        # 3. ACUTE PERITONEAL CRISIS
        # Severe abdominal pain (>=8) with rigidity, inability to touch/stand
        # -------------------------------------------------------------
        has_peritonitis = any("rigid" in a or "periton" in a or "guarding" in a or "cannot_stand" in a for a in answer_values)
        if is_abdomen and severity >= 8 and has_peritonitis:
            return RedFlagAlert(
                is_active=True,
                trigger_criteria=["Severe Abdominal Pain", "Peritoneal Signs / Abdominal Rigidity"],
                alert_message=(
                    "SURGICAL ALERT: Signs of acute peritonitis or abdominal wall guarding. "
                    "Requires immediate surgical consult and vital sign stabilization."
                ),
                intercept_timestamp=datetime.utcnow(),
            )

        # -------------------------------------------------------------
        # 4. STROKE / NEUROLOGICAL CRISIS
        # Slurred speech, facial droop, sudden unilateral weakness
        # -------------------------------------------------------------
        has_stroke_signs = any("slurr" in a or "facial_droop" in a or "weakness" in a or "paralysis" in a for a in answer_values)
        if has_stroke_signs:
            return RedFlagAlert(
                is_active=True,
                trigger_criteria=["Acute Neurological Deficit", "FAST Stroke Protocol Triggered"],
                alert_message=(
                    "STROKE ALERT: Suspected acute cerebrovascular event. "
                    "Emergency team alerted for rapid stroke assessment."
                ),
                intercept_timestamp=datetime.utcnow(),
            )

        # -------------------------------------------------------------
        # 5. MENINGEAL INFECTION / SUBARACHNOID CRISIS
        # Severe headache + stiff neck + high fever
        # -------------------------------------------------------------
        has_stiff_neck = any("stiff_neck" in a or "mening" in a for a in answer_values)
        has_fever = "fever" in assoc or any("fever" in a for a in answer_values)
        has_thunderclap = any("thunderclap" in a or "sudden_explosive" in a for a in answer_values)

        if is_head and ((has_stiff_neck and has_fever) or (has_thunderclap and severity >= 8)):
            triggers = ["Acute Headache"]
            if has_stiff_neck:
                triggers.append("Nuchal Rigidity / Stiff Neck")
            if has_fever:
                triggers.append("Systemic Fever")
            if has_thunderclap:
                triggers.append("Thunderclap Sudden Onset")

            return RedFlagAlert(
                is_active=True,
                trigger_criteria=triggers,
                alert_message=(
                    "NEUROLOGICAL/INFECTION ALERT: Suspected meningeal irritation or intracranial hemorrhage. "
                    "Emergency care required."
                ),
                intercept_timestamp=datetime.utcnow(),
            )

        # Default: Safe routine path
        return RedFlagAlert(
            is_active=False,
            trigger_criteria=[],
            alert_message="",
            intercept_timestamp=None,
        )
