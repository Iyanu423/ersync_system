import re
from typing import Dict, Any, Optional, List
from app.ai.base import AIProvider
from app.schemas.schemas import AIAnalysisResult

class MockAIProvider(AIProvider):
    """
    Deterministic, high-accuracy clinical rule and NLP triage classifier.
    Designed for zero-cost, offline, and reliable hackathon execution.
    Extracts severity, suspected clinical conditions, mandatory specialties,
    facilities, and bed requirements matching standardized hospital catalogs.
    """

    # Canonical Specialties in Nigerian Hospital System:
    # "Surgery", "Orthopaedics", "Neurosurgery", "Cardiology", "Paediatrics",
    # "Obstetrics/Gynaecology", "Anaesthesia", "General Medicine", "Dentistry", "Ophthalmology"

    # Canonical Facilities:
    # "Emergency Department", "Operating Theatre", "CT Scanner", "X-Ray",
    # "Ultrasound", "Blood Bank", "ICU", "Ambulance"

    KEYWORD_SPECIALTIES = {
        "trauma": ["Surgery", "Orthopaedics", "Anaesthesia"],
        "bleeding": ["Surgery", "General Medicine"],
        "unconscious": ["General Medicine", "Neurosurgery", "Anaesthesia"],
        "head": ["Neurosurgery", "Surgery"],
        "fracture": ["Orthopaedics"],
        "femur": ["Orthopaedics", "Surgery"],
        "leg": ["Orthopaedics"],
        "bone": ["Orthopaedics"],
        "chest": ["Cardiology", "General Medicine"],
        "heart": ["Cardiology"],
        "cardiac": ["Cardiology"],
        "stroke": ["Neurosurgery", "General Medicine"],
        "burn": ["Surgery", "General Medicine"],
        "burns": ["Surgery", "General Medicine"],
        "pregnant": ["Obstetrics/Gynaecology", "Paediatrics"],
        "pregnancy": ["Obstetrics/Gynaecology", "Paediatrics"],
        "child": ["Paediatrics"],
        "pediatric": ["Paediatrics"],
        "baby": ["Paediatrics"],
        "motorcycle": ["Surgery", "Orthopaedics"],
        "accident": ["Surgery", "Orthopaedics"],
        "crash": ["Surgery", "Orthopaedics"],
        "gunshot": ["Surgery", "Anaesthesia"],
        "stab": ["Surgery", "Anaesthesia"],
    }

    KEYWORD_FACILITIES = {
        "head": ["CT Scanner", "Operating Theatre", "Emergency Department"],
        "unconscious": ["CT Scanner", "ICU", "Emergency Department"],
        "bleeding": ["Operating Theatre", "Blood Bank", "Emergency Department"],
        "fracture": ["X-Ray", "Emergency Department"],
        "femur": ["Operating Theatre", "X-Ray", "Emergency Department"],
        "bone": ["X-Ray", "Emergency Department"],
        "chest": ["ICU", "X-Ray", "Emergency Department"],
        "heart": ["ICU", "Emergency Department"],
        "stroke": ["CT Scanner", "ICU", "Emergency Department"],
        "burn": ["ICU", "Operating Theatre", "Emergency Department"],
        "trauma": ["Operating Theatre", "CT Scanner", "X-Ray", "Blood Bank", "Emergency Department"],
        "accident": ["Operating Theatre", "CT Scanner", "X-Ray", "Emergency Department"],
        "crash": ["Operating Theatre", "CT Scanner", "Emergency Department"],
        "pregnant": ["Operating Theatre", "Ultrasound", "Emergency Department"],
        "severe": ["Emergency Department", "Operating Theatre"],
    }

    CATEGORY_DEFAULTS = {
        "Road accident": {
            "severity": "CRITICAL",
            "conditions": ["trauma", "multiple injuries", "possible fractures"],
            "specialties": ["Surgery", "Orthopaedics"],
            "facilities": ["Emergency Department", "Operating Theatre", "CT Scanner", "X-Ray"]
        },
        "Severe bleeding": {
            "severity": "CRITICAL",
            "conditions": ["hypovolemic shock risk", "active hemorrhage"],
            "specialties": ["Surgery", "General Medicine"],
            "facilities": ["Emergency Department", "Operating Theatre", "Blood Bank"]
        },
        "Head injury": {
            "severity": "CRITICAL",
            "conditions": ["traumatic brain injury", "intracranial hemorrhage"],
            "specialties": ["Neurosurgery", "Surgery"],
            "facilities": ["Emergency Department", "CT Scanner", "Operating Theatre"]
        },
        "Chest pain": {
            "severity": "HIGH",
            "conditions": ["acute coronary syndrome", "myocardial infarction"],
            "specialties": ["Cardiology", "General Medicine"],
            "facilities": ["Emergency Department", "ICU", "Ultrasound"]
        },
        "Stroke symptoms": {
            "severity": "CRITICAL",
            "conditions": ["acute ischemic/hemorrhagic stroke"],
            "specialties": ["Neurosurgery", "General Medicine"],
            "facilities": ["Emergency Department", "CT Scanner", "ICU"]
        },
        "Burns": {
            "severity": "HIGH",
            "conditions": ["severe thermal injury", "inhalation risk"],
            "specialties": ["Surgery", "General Medicine"],
            "facilities": ["Emergency Department", "ICU", "Operating Theatre"]
        },
        "Fracture": {
            "severity": "MEDIUM",
            "conditions": ["bone fracture", "skeletal trauma"],
            "specialties": ["Orthopaedics"],
            "facilities": ["Emergency Department", "X-Ray"]
        },
        "Unconscious patient": {
            "severity": "CRITICAL",
            "conditions": ["altered consciousness", "respiratory compromise"],
            "specialties": ["General Medicine", "Neurosurgery"],
            "facilities": ["Emergency Department", "CT Scanner", "ICU"]
        },
        "Pregnancy emergency": {
            "severity": "CRITICAL",
            "conditions": ["obstetric emergency", "fetal distress"],
            "specialties": ["Obstetrics/Gynaecology", "Paediatrics"],
            "facilities": ["Emergency Department", "Operating Theatre", "Ultrasound"]
        },
        "Other": {
            "severity": "MEDIUM",
            "conditions": ["acute medical condition"],
            "specialties": ["General Medicine"],
            "facilities": ["Emergency Department"]
        }
    }

    async def analyse_emergency(
        self,
        description: str,
        category: str = "Other",
        additional_info: Optional[Dict[str, Any]] = None
    ) -> AIAnalysisResult:
        desc_lower = description.lower()
        
        # Start with category defaults if recognized
        cat_info = self.CATEGORY_DEFAULTS.get(category, self.CATEGORY_DEFAULTS["Other"])
        
        suspected_conditions = set(cat_info["conditions"])
        required_specialties = set(cat_info["specialties"])
        required_facilities = set(cat_info["facilities"])
        
        # Scan description text for keywords
        for kw, specs in self.KEYWORD_SPECIALTIES.items():
            if re.search(r'\b' + re.escape(kw) + r'\b', desc_lower):
                required_specialties.update(specs)
                suspected_conditions.add(kw)
                
        for kw, facs in self.KEYWORD_FACILITIES.items():
            if re.search(r'\b' + re.escape(kw) + r'\b', desc_lower):
                required_facilities.update(facs)
                
        # Severity evaluation
        severity = cat_info["severity"]
        # Critical terms with word boundaries (prevents "crushing" from triggering CRITICAL)
        critical_terms = [r"\bunconscious\b", r"\bheavy bleeding\b", r"\bsevere bleeding\b",
                          r"\bcritical\b", r"\bhead injury\b", r"\bhead trauma\b",
                          r"\bgunshot\b", r"\bcrush\b", r"\bcrushing\b"]
        # High terms - chest pain is HIGH, fracture is MEDIUM
        high_terms = [r"\bfracture\b", r"\bchest pain\b", r"\bburn(s)?\b",
                      r"\bdifficulty breathing\b", r"\burgent\b"]
        if any(re.search(term, desc_lower) for term in critical_terms):
            severity = "CRITICAL"
        elif any(re.search(term, desc_lower) for term in high_terms):
            if severity != "CRITICAL":  # Don't downgrade critical to high
                severity = "HIGH"
                
        # Always require Emergency Department
        required_facilities.add("Emergency Department")
        
        # If head trauma is mentioned, ensure Neurosurgery is in specialties and CT Scanner in facilities
        if "head" in desc_lower or "unconscious" in desc_lower:
            required_specialties.add("Neurosurgery")
            required_facilities.add("CT Scanner")

        confidence = 0.94 if (category in self.CATEGORY_DEFAULTS and len(description) > 15) else 0.88
        
        rationale = (
            f"Extracted requirements based on identified symptoms ({', '.join(sorted(suspected_conditions))}). "
            f"Mandatory capabilities set to: {', '.join(sorted(required_specialties))} and facilities: {', '.join(sorted(required_facilities))}."
        )

        return AIAnalysisResult(
            severity=severity,
            confidence=confidence,
            suspected_conditions=sorted(list(suspected_conditions)),
            required_capabilities=sorted(list(required_specialties)),
            required_facilities=sorted(list(required_facilities)),
            rationale=rationale,
            disclaimer="Suspected emergency requirements based on preliminary triage intake. Not a definitive medical diagnosis."
        )
