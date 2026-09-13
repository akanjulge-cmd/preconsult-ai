"""HL7 FHIR Document Bundle Exporter for PreConsult AI.

Transforms a validated ClinicalPreConsultRecord into an HL7 FHIR Bundle
(Patient, Condition, Observation, MedicationStatement, Encounter, Provenance).
Preserves explicit data provenance tags for hospital EHR / HIS interoperability.
"""

from typing import Dict, Any, List
from datetime import datetime
from app.models.schemas import ClinicalPreConsultRecord, DataProvenance


def export_to_fhir_bundle(record: ClinicalPreConsultRecord) -> Dict[str, Any]:
    """Serializes a ClinicalPreConsultRecord to a standardized HL7 FHIR Bundle."""
    bundle_id = f"urn:uuid:bundle-{record.record_id}"
    timestamp_iso = record.timestamp.isoformat() if hasattr(record.timestamp, "isoformat") else str(record.timestamp)

    entries: List[Dict[str, Any]] = []

    # 1. Patient Resource
    patient_entry = {
        "fullUrl": f"urn:uuid:patient-{record.patient_id}",
        "resource": {
            "resourceType": "Patient",
            "id": record.patient_id,
            "identifier": [
                {
                    "system": "http://hospital.preconsult.ai/patients",
                    "value": record.patient_id,
                }
            ],
            "active": True,
            "meta": {
                "tag": [
                    {
                        "system": "http://preconsult.ai/provenance",
                        "code": "DATABASE-DERIVED",
                        "display": "Database Demographic Record",
                    }
                ]
            },
        },
    }
    entries.append(patient_entry)

    # 2. Encounter Resource
    encounter_id = f"enc-{record.record_id}"
    encounter_entry = {
        "fullUrl": f"urn:uuid:{encounter_id}",
        "resource": {
            "resourceType": "Encounter",
            "id": encounter_id,
            "status": "planned" if not record.clinician_approved else "in-progress",
            "class": {
                "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                "code": "AMB",
                "display": "Ambulatory Pre-Consultation",
            },
            "priority": {
                "coding": [
                    {
                        "system": "http://preconsult.ai/triage-urgency",
                        "code": record.triage_urgency.value,
                        "display": f"Triage Urgency: {record.triage_urgency.value}",
                    }
                ]
            },
            "subject": {"reference": f"urn:uuid:patient-{record.patient_id}"},
            "period": {"start": timestamp_iso},
        },
    }
    entries.append(encounter_entry)

    # 3. Chief Complaint & Primary Condition
    condition_id = f"cond-{record.record_id}"
    condition_entry = {
        "fullUrl": f"urn:uuid:{condition_id}",
        "resource": {
            "resourceType": "Condition",
            "id": condition_id,
            "clinicalStatus": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                        "code": "active",
                    }
                ]
            },
            "verificationStatus": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                        "code": "provisional" if not record.clinician_approved else "confirmed",
                    }
                ]
            },
            "code": {
                "text": record.chief_complaint,
            },
            "subject": {"reference": f"urn:uuid:patient-{record.patient_id}"},
            "note": [
                {
                    "text": record.history_of_present_illness,
                }
            ],
            "meta": {
                "tag": [
                    {
                        "system": "http://preconsult.ai/provenance",
                        "code": "AI-INFERRED" if not record.clinician_notes else "CLINICIAN-EDITED",
                        "display": "Pre-Consultation Synthesis",
                    }
                ]
            },
        },
    }
    entries.append(condition_entry)

    # 4. Symptom Observations
    for idx, sym in enumerate(record.symptoms):
        obs_id = f"obs-sym-{idx}-{sym.symptom_id}"
        obs_entry = {
            "fullUrl": f"urn:uuid:{obs_id}",
            "resource": {
                "resourceType": "Observation",
                "id": obs_id,
                "status": "final",
                "category": [
                    {
                        "coding": [
                            {
                                "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                                "code": "exam",
                                "display": "Symptom Observation",
                            }
                        ]
                    }
                ],
                "code": {
                    "text": f"{sym.character} in {sym.anatomical_micro_zone} ({sym.body_macro_region})",
                },
                "subject": {"reference": f"urn:uuid:patient-{record.patient_id}"},
                "valueInteger": sym.severity,
                "interpretation": [
                    {
                        "text": f"Severity: {sym.severity}/10",
                    }
                ],
                "bodySite": {
                    "text": f"{sym.body_macro_region} - {sym.anatomical_micro_zone}",
                },
                "meta": {
                    "tag": [
                        {
                            "system": "http://preconsult.ai/provenance",
                            "code": sym.provenance.value if hasattr(sym.provenance, "value") else str(sym.provenance),
                            "display": "Patient Touch Input",
                        }
                    ]
                },
            },
        }
        entries.append(obs_entry)

    # 5. Medication Statements (OCR-derived)
    for idx, med in enumerate(record.active_medications):
        med_id = f"med-{idx}-{med.name.replace(' ', '-').lower()}"
        med_entry = {
            "fullUrl": f"urn:uuid:{med_id}",
            "resource": {
                "resourceType": "MedicationStatement",
                "id": med_id,
                "status": "active",
                "medicationCodeableConcept": {
                    "text": f"{med.name} {med.dosage or ''}".strip(),
                },
                "subject": {"reference": f"urn:uuid:patient-{record.patient_id}"},
                "dosage": [
                    {
                        "text": med.frequency or "As directed",
                    }
                ],
                "meta": {
                    "tag": [
                        {
                            "system": "http://preconsult.ai/provenance",
                            "code": med.provenance.value if hasattr(med.provenance, "value") else str(med.provenance),
                            "display": f"{med.source} (Confidence: {int(med.confidence * 100)}%)",
                        }
                    ]
                },
            },
        }
        entries.append(med_entry)

    # 6. Lab Results Observations (OCR-derived)
    for idx, lab in enumerate(record.abnormal_labs):
        lab_id = f"lab-{idx}-{lab.test_name.replace(' ', '-').lower()}"
        lab_entry = {
            "fullUrl": f"urn:uuid:{lab_id}",
            "resource": {
                "resourceType": "Observation",
                "id": lab_id,
                "status": "final",
                "category": [
                    {
                        "coding": [
                            {
                                "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                                "code": "laboratory",
                            }
                        ]
                    }
                ],
                "code": {
                    "text": lab.test_name,
                },
                "subject": {"reference": f"urn:uuid:patient-{record.patient_id}"},
                "valueString": f"{lab.value} {lab.unit}",
                "referenceRange": [
                    {
                        "text": lab.reference_range,
                    }
                ],
                "interpretation": [
                    {
                        "coding": [
                            {
                                "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                                "code": "A" if lab.is_abnormal else "N",
                                "display": "Abnormal" if lab.is_abnormal else "Normal",
                            }
                        ]
                    }
                ],
                "meta": {
                    "tag": [
                        {
                            "system": "http://preconsult.ai/provenance",
                            "code": lab.provenance.value if hasattr(lab.provenance, "value") else str(lab.provenance),
                            "display": "Lab Report OCR Extraction",
                        }
                    ]
                },
            },
        }
        entries.append(lab_entry)

    # 7. FHIR Provenance Record (Tracking Decision Maker & Reviewer)
    prov_entry = {
        "fullUrl": f"urn:uuid:prov-{record.record_id}",
        "resource": {
            "resourceType": "Provenance",
            "id": f"prov-{record.record_id}",
            "target": [{"reference": f"urn:uuid:{condition_id}"}],
            "recorded": timestamp_iso,
            "activity": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/v3-DataOperation",
                        "code": "CREATE",
                        "display": "Pre-Consultation Intake Synthesis",
                    }
                ]
            },
            "agent": [
                {
                    "type": {
                        "coding": [
                            {
                                "system": "http://terminology.hl7.org/CodeSystem/provenance-participant-type",
                                "code": "author",
                                "display": "PreConsult AI Clinical Intake Engine",
                            }
                        ]
                    },
                    "who": {"display": "PreConsult AI v1.0.0"},
                },
                {
                    "type": {
                        "coding": [
                            {
                                "system": "http://terminology.hl7.org/CodeSystem/provenance-participant-type",
                                "code": "verifier",
                                "display": "Attending Clinician (Final Decision-Maker)",
                            }
                        ]
                    },
                    "who": {
                        "display": record.clinician_id or "Attending Physician, MD",
                    },
                },
            ],
            "meta": {
                "tag": [
                    {
                        "system": "http://preconsult.ai/provenance",
                        "code": "CLINICIAN-EDITED" if record.clinician_approved else "AI-INFERRED",
                        "display": f"Review Status: {record.review_status}",
                    }
                ]
            },
        },
    }
    entries.append(prov_entry)

    return {
        "resourceType": "Bundle",
        "id": record.record_id,
        "type": "document",
        "timestamp": timestamp_iso,
        "meta": {
            "lastUpdated": timestamp_iso,
            "profile": ["http://hl7.org/fhir/StructureDefinition/document"],
        },
        "total": len(entries),
        "entry": entries,
    }
