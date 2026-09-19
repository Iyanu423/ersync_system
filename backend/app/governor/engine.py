from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from app.models.entities import Hospital, Emergency, EmergencyRequirement, Match
from app.governor.scoring import GovernorScoring
from app.routing.service import routing_service
from app.core.config import settings

class CandidateEvaluation:
    def __init__(self, hospital: Hospital):
        self.hospital = hospital
        self.eligible: bool = True
        self.rejection_reasons: List[str] = []
        self.positive_factors: List[str] = []
        self.distance_km: float = 0.0
        self.eta_minutes: float = 0.0
        self.score_breakdown: Dict[str, Any] = {}
        self.final_score: float = 0.0
        self.rank: int = 0

class GovernorDecisionEngine:
    """
    Deterministic Governor Decision Engine for Emergency Medical Coordination.
    Enforces absolute safety constraints, evaluates hard filters, calculates travel routes,
    computes explainable multi-factor scores, and ranks candidate hospitals.
    """

    @classmethod
    def evaluate_emergency(
        cls,
        db: Session,
        emergency: Emergency,
        hospitals: Optional[List[Hospital]] = None,
        target_hospital_id: Optional[str] = None
    ) -> List[CandidateEvaluation]:
        if hospitals is None:
            hospitals = db.query(Hospital).all()

        emergency_origin = (emergency.latitude, emergency.longitude)
        requirements = db.query(EmergencyRequirement).filter(EmergencyRequirement.emergency_id == emergency.id).all()

        # Extract required specialties and facilities
        mandatory_specialties = [r.requirement_name for r in requirements if r.requirement_type == "SPECIALTY" and r.mandatory]
        mandatory_facilities = [r.requirement_name for r in requirements if r.requirement_type == "FACILITY" and r.mandatory]

        candidates: List[CandidateEvaluation] = []
        now = datetime.now(timezone.utc)

        for hosp in hospitals:
            eval_res = CandidateEvaluation(hosp)
            
            # 1. Routing calculation
            hosp_dest = (hosp.latitude, hosp.longitude)
            eval_res.distance_km = routing_service.calculate_distance(emergency_origin, hosp_dest)
            eval_res.eta_minutes = routing_service.calculate_eta(emergency_origin, hosp_dest)

            # Available emergency beds
            available_beds = sum(1 for b in hosp.beds if b.status == "AVAILABLE")
            total_beds = len(hosp.beds)

            # Check specialty readiness
            hosp_spec_map = {s.specialty_name.lower(): s for s in hosp.specialties}
            available_spec_count = sum(1 for s in hosp.specialties if s.status == "AVAILABLE" and s.available_count > 0)

            # Check facility readiness
            hosp_fac_map = {f.facility_name.lower(): f for f in hosp.facilities}

            # ================= HARD FILTERS =================

            # Rule 1: Emergency department operational status
            if hosp.emergency_status == "CLOSED":
                eval_res.eligible = False
                eval_res.rejection_reasons.append("Emergency department is currently CLOSED")

            # Rule 2: Accepting emergencies toggle
            if not hosp.accepting_emergencies:
                eval_res.eligible = False
                eval_res.rejection_reasons.append("Hospital is not accepting emergency admissions")

            # Rule 3: Staleness check
            last_up = hosp.last_status_update
            if last_up.tzinfo is None:
                last_up = last_up.replace(tzinfo=timezone.utc)
            elapsed_minutes = (now - last_up).total_seconds() / 60.0
            
            if elapsed_minutes > settings.EXCLUDE_CRITICALLY_STALE_MINUTES and emergency.severity in ("CRITICAL", "HIGH"):
                eval_res.eligible = False
                eval_res.rejection_reasons.append(f"Hospital status data is critically stale ({int(elapsed_minutes)}m since last update)")

            # Rule 4: Mandatory Bed check for Critical emergencies
            if emergency.severity in ["CRITICAL", "HIGH"] and available_beds < 1:
                eval_res.eligible = False
                eval_res.rejection_reasons.append("No emergency beds currently available")

            # Rule 5: Mandatory Specialties check
            for req_spec in mandatory_specialties:
                spec_obj = hosp_spec_map.get(req_spec.lower())
                if not spec_obj or spec_obj.status != "AVAILABLE" or spec_obj.available_count <= 0:
                    eval_res.eligible = False
                    eval_res.rejection_reasons.append(f"Required specialist unavailable: {req_spec}")
                else:
                    eval_res.positive_factors.append(f"Specialist available: {req_spec}")

            # Rule 6: Mandatory Facilities check
            for req_fac in mandatory_facilities:
                fac_obj = hosp_fac_map.get(req_fac.lower())
                if not fac_obj or not fac_obj.available or fac_obj.status != "OPERATIONAL":
                    eval_res.eligible = False
                    eval_res.rejection_reasons.append(f"Required facility unavailable: {req_fac}")
                else:
                    eval_res.positive_factors.append(f"Facility operational: {req_fac}")

            # Calculate capability match percentage
            total_reqs = len(mandatory_specialties) + len(mandatory_facilities)
            if total_reqs == 0:
                capability_score = 100.0
            else:
                matched = len(eval_res.positive_factors)
                capability_score = round(min(matched / float(total_reqs) * 100.0, 100.0), 1)

            # Calculate Scoring Breakdown
            breakdown = GovernorScoring.compute_breakdown(
                capability_score=capability_score,
                eta_minutes=eval_res.eta_minutes,
                available_beds=available_beds,
                total_beds=total_beds,
                overall_capacity_pct=hosp.overall_capacity,
                available_specialists_count=available_spec_count,
                total_specialties=len(hosp.specialties),
                last_update=last_up
            )
            
            # Format positive factors
            if hosp.accepting_emergencies:
                eval_res.positive_factors.insert(0, "Accepting emergency patients")
            if available_beds > 0:
                eval_res.positive_factors.append(f"{available_beds} emergency bed(s) available")
            eval_res.positive_factors.append(f"Estimated travel time is {eval_res.eta_minutes} min ({eval_res.distance_km} km)")

            final_score = breakdown["final_score"]
            # LIMITED ED status = reduced capacity: still eligible, but ranked lower
            if hosp.emergency_status == "LIMITED":
                final_score = round(final_score * settings.LIMITED_STATUS_SCORE_MULTIPLIER, 1)
                breakdown["final_score"] = final_score
                breakdown["limited_status_multiplier"] = settings.LIMITED_STATUS_SCORE_MULTIPLIER
                eval_res.positive_factors.append("Emergency department is operating at LIMITED capacity (score reduced)")

            if target_hospital_id and hosp.id == target_hospital_id:
                eval_res.eligible = True
                eval_res.rejection_reasons = []
                final_score = 1000.0
                eval_res.positive_factors.append("Manually targeted for demonstration")
                breakdown["final_score"] = final_score

            breakdown["explanations"] = eval_res.positive_factors if eval_res.eligible else eval_res.rejection_reasons

            eval_res.score_breakdown = breakdown
            # If ineligible, final score is zeroed out for clean ranking separation
            eval_res.final_score = final_score if eval_res.eligible else 0.0

            candidates.append(eval_res)

        # Sort eligible candidates by final_score descending; ineligibles sorted by distance
        eligible_candidates = [c for c in candidates if c.eligible]
        ineligible_candidates = [c for c in candidates if not c.eligible]

        eligible_candidates.sort(key=lambda x: x.final_score, reverse=True)
        ineligible_candidates.sort(key=lambda x: x.eta_minutes)

        ranked_all = eligible_candidates + ineligible_candidates
        for i, c in enumerate(ranked_all, 1):
            c.rank = i

        return ranked_all
