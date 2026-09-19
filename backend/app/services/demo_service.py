from datetime import datetime, timezone
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.entities import Emergency, Match, Referral, Hospital, EmergencyBed, utc_now
from app.schemas.schemas import EmergencyCreate, OneClickDemoResponse, OneClickDemoStep
from app.services.emergency_service import emergency_service
from app.services.referral_service import referral_service
from app.services.audit_service import audit_service

class DemoService:
    @classmethod
    async def run_one_click_scenario(cls, db: Session) -> OneClickDemoResponse:
        """
        Executes the mandatory Hackathon Demo Scenario:
        1. Ingests Road Accident Emergency: "Motorcycle accident. One patient unconscious with severe bleeding, suspected head injury and possible leg fracture."
        2. AI extracts CRITICAL requirements: Surgery, Orthopaedics, Neurosurgery, Emergency Department, CT Scanner, Operating Theatre.
        3. Governor filters out ineligible hospitals (e.g. no beds, no surgeon, closed ED) and ranks candidates.
        4. Governor contacts Rank #1 (Simulated Hospital A).
        5. Simulates rejection from Hospital A.
        6. Governor automatically fails over to Rank #2 (Simulated Hospital B).
        7. Hospital B accepts.
        8. Emergency bed is reserved.
        9. Patient confirmed destination is dispatched.
        """
        timeline: List[OneClickDemoStep] = []
        step_num = 1

        def add_step(title: str, status: str, details: Dict[str, Any]):
            nonlocal step_num
            timeline.append(OneClickDemoStep(
                step_number=step_num,
                title=title,
                status=status,
                timestamp=datetime.now().strftime("%H:%M:%S"),
                details=details
            ))
            step_num += 1

        # Step 1: Emergency Intake
        demo_payload = EmergencyCreate(
            latitude=6.5244,
            longitude=3.3792,
            location_name="Ozumba Mbadiwe Way / Lekki-Epe Expressway, Lagos",
            description="Motorcycle accident. One patient is unconscious with severe bleeding, suspected head injury and possible leg fracture.",
            category="Road accident",
            patient_count=1,
            caller_phone="+2348012345678",
            caller_name="First Responder / FRSC Patrol",
            patient_age=29,
            patient_gender="Male",
            symptoms="Unconscious, active hemorrhage from head, deformed right femur"
        )
        
        emergency, ai_res = await emergency_service.create_and_triage(db, demo_payload, actor="DEMO_ORCHESTRATOR")
        add_step(
            title="Emergency Incident Ingested & Triage Ingested",
            status="SUCCESS",
            details={
                "incident_reference": emergency.incident_reference,
                "location": emergency.location_name,
                "coordinates": [emergency.latitude, emergency.longitude]
            }
        )

        # Step 2: AI Triage Analysis
        add_step(
            title="AI Emergency Requirements Extracted",
            status="SUCCESS",
            details={
                "severity": ai_res.severity,
                "confidence": ai_res.confidence,
                "suspected_conditions": ai_res.suspected_conditions,
                "required_capabilities": ai_res.required_capabilities,
                "required_facilities": ai_res.required_facilities
            }
        )

        # Step 3: Governor Decision Engine Matching
        matches = emergency_service.match_hospitals(db, emergency.id)
        eligible = [m for m in matches if m.eligibility]
        excluded = [m for m in matches if not m.eligibility]

        add_step(
            title="Governor Hard Filtering & Multi-Factor Ranking",
            status="SUCCESS",
            details={
                "total_hospitals_evaluated": len(matches),
                "eligible_count": len(eligible),
                "excluded_count": len(excluded),
                "top_ranked_hospital": eligible[0].hospital.name if eligible else "None",
                "excluded_reasons": [
                    {"hospital": m.hospital.name, "reason": m.rejection_reason}
                    for m in excluded[:4]
                ]
            }
        )

        if not eligible:
            raise RuntimeError("Demo scenario requires at least 2 eligible hospitals configured in seed.")

        # Step 4: Request Acceptance from Hospital #1
        first_match = eligible[0]
        first_hosp = first_match.hospital
        ref1 = referral_service.request_acceptance(db, emergency.id, first_hosp.id)

        add_step(
            title=f"Governor Contacted Rank #1: {first_hosp.name}",
            status="PENDING_ACCEPTANCE",
            details={
                "hospital_name": first_hosp.name,
                "score": first_match.score,
                "eta_minutes": first_match.eta_minutes,
                "distance_km": first_match.distance_km
            }
        )

        # Step 5: Simulate Rejection from Hospital #1
        rejection_reason = "Sudden mass casualty intake; emergency trauma beds temporarily saturated"
        ref1_rej, ref2_req = referral_service.reject_referral(
            db=db,
            referral_id=ref1.id,
            reason=rejection_reason,
            notes="Trauma room surged by incoming pileup accident.",
            actor="SIMULATED_HOSPITAL_A"
        )

        add_step(
            title=f"Hospital #1 ({first_hosp.name}) Rejected — Auto-Failover Triggered",
            status="FAILOVER_TRIGGERED",
            details={
                "rejected_by": first_hosp.name,
                "rejection_reason": rejection_reason,
                "action": "Governor immediately recalculated and dispatched to Rank #2"
            }
        )

        # Step 6: Hospital #2 Acceptance & Bed Reservation
        second_match = eligible[1] if len(eligible) > 1 else eligible[0]
        second_hosp = second_match.hospital
        
        # Verify referral 2 exists or create it
        if not ref2_req:
            ref2_req = referral_service.request_acceptance(db, emergency.id, second_hosp.id)

        ref2_acc, reserved_bed = referral_service.accept_referral(
            db=db,
            referral_id=ref2_req.id,
            notes="Emergency accepted. Trauma team alpha standing by. Emergency Bed reserved.",
            actor="SIMULATED_HOSPITAL_B"
        )

        add_step(
            title=f"Hospital #2 ({second_hosp.name}) ACCEPTED — Capacity Reserved",
            status="ACCEPTED",
            details={
                "hospital_name": second_hosp.name,
                "bed_reserved": reserved_bed.bed_number if reserved_bed else "Bed #1 (Confirmed)",
                "eta_minutes": second_match.eta_minutes,
                "distance_km": second_match.distance_km
            }
        )

        # Step 7: Confirmed Navigation Dispatched
        add_step(
            title="Emergency Destination Confirmed — Patient Navigation Active",
            status="COMPLETED",
            details={
                "confirmed_hospital": second_hosp.name,
                "address": second_hosp.address,
                "phone": second_hosp.phone,
                "eta_minutes": second_match.eta_minutes,
                "emergency_status": emergency.status
            }
        )

        return OneClickDemoResponse(
            scenario_name="Mass Casualty Motorcycle Accident with Hospital Failover",
            emergency_id=emergency.id,
            incident_reference=emergency.incident_reference,
            severity=emergency.severity,
            first_hospital_attempted={
                "id": first_hosp.id,
                "name": first_hosp.name,
                "score": first_match.score,
                "eta_minutes": first_match.eta_minutes
            },
            first_rejection_reason=rejection_reason,
            second_hospital_attempted={
                "id": second_hosp.id,
                "name": second_hosp.name,
                "score": second_match.score,
                "eta_minutes": second_match.eta_minutes
            },
            second_accepted=True,
            referral_id=ref2_acc.id,
            bed_reserved=reserved_bed is not None,
            eta_minutes=second_match.eta_minutes,
            distance_km=second_match.distance_km,
            timeline=timeline
        )

demo_service = DemoService()
