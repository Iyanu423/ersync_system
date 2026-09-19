import random
import time
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.models.entities import Emergency, EmergencyRequirement, Match, Referral, utc_now
from app.schemas.schemas import EmergencyCreate, AIAnalysisResult
from app.ai.service import ai_service
from app.governor.engine import GovernorDecisionEngine, CandidateEvaluation
from app.services.audit_service import audit_service
from app.services.notification_service import notification_service

class EmergencyService:
    @staticmethod
    def generate_incident_ref() -> str:
        num = random.randint(1000, 9999)
        year = datetime.now().year
        return f"EMG-{year}-{num}"

    @classmethod
    async def create_and_triage(
        cls,
        db: Session,
        payload: EmergencyCreate,
        actor: str = "PATIENT_APP"
    ) -> Tuple[Emergency, AIAnalysisResult]:
        incident_ref = cls.generate_incident_ref()
        
        emergency = Emergency(
            incident_reference=incident_ref,
            latitude=payload.latitude,
            longitude=payload.longitude,
            location_name=payload.location_name or "Reported Location",
            description=payload.description,
            category=payload.category,
            patient_count=payload.patient_count,
            caller_phone=payload.caller_phone,
            caller_name=payload.caller_name,
            patient_age=payload.patient_age,
            patient_gender=payload.patient_gender,
            symptoms=payload.symptoms,
            status="ANALYSING"
        )
        db.add(emergency)
        db.commit()
        db.refresh(emergency)

        audit_service.log(
            db=db,
            action="EMERGENCY_REPORTED",
            entity_type="EMERGENCY",
            entity_id=emergency.id,
            actor=actor,
            metadata={"incident_reference": incident_ref, "description": payload.description}
        )

        # 1. AI Understanding Layer
        ai_result = await ai_service.analyse(
            description=payload.description,
            category=payload.category,
            additional_info={
                "patient_count": payload.patient_count,
                "symptoms": payload.symptoms,
                "location": payload.location_name
            }
        )

        emergency.severity = ai_result.severity
        emergency.status = "MATCHING"
        
        # 2. Persist Emergency Requirements
        # Specialties
        for spec in ai_result.required_capabilities:
            req = EmergencyRequirement(
                emergency_id=emergency.id,
                requirement_type="SPECIALTY",
                requirement_name=spec,
                required_quantity=1,
                mandatory=True
            )
            db.add(req)

        # Facilities
        for fac in ai_result.required_facilities:
            req = EmergencyRequirement(
                emergency_id=emergency.id,
                requirement_type="FACILITY",
                requirement_name=fac,
                required_quantity=1,
                mandatory=True
            )
            db.add(req)

        # Bed requirement for critical / high
        if ai_result.severity in ["CRITICAL", "HIGH"]:
            req = EmergencyRequirement(
                emergency_id=emergency.id,
                requirement_type="BED",
                requirement_name="Emergency Bed",
                required_quantity=payload.patient_count,
                mandatory=True
            )
            db.add(req)

        db.commit()
        db.refresh(emergency)

        audit_service.log(
            db=db,
            action="AI_TRIAGE_COMPLETED",
            entity_type="EMERGENCY",
            entity_id=emergency.id,
            actor="AI_TRIAGE_LAYER",
            metadata={
                "severity": ai_result.severity,
                "confidence": ai_result.confidence,
                "capabilities": ai_result.required_capabilities,
                "facilities": ai_result.required_facilities
            }
        )

        return emergency, ai_result

    @classmethod
    def match_hospitals(
        cls,
        db: Session,
        emergency_id: str
    ) -> List[Match]:
        started = time.perf_counter()
        emergency = db.query(Emergency).filter(Emergency.id == emergency_id).first()
        if not emergency:
            return []

        # Clear existing matches for this emergency
        db.query(Match).filter(Match.emergency_id == emergency_id).delete()
        db.commit()

        # Run Governor Decision Engine
        candidates = GovernorDecisionEngine.evaluate_emergency(db, emergency)

        created_matches: List[Match] = []
        for cand in candidates:
            match = Match(
                emergency_id=emergency.id,
                hospital_id=cand.hospital.id,
                score=cand.final_score,
                distance_km=cand.distance_km,
                eta_minutes=cand.eta_minutes,
                eligibility=cand.eligible,
                rejection_reason="; ".join(cand.rejection_reasons) if cand.rejection_reasons else None,
                score_breakdown=cand.score_breakdown,
                rank=cand.rank
            )
            db.add(match)
            created_matches.append(match)

            audit_service.log(
                db=db,
                action="HOSPITAL_FILTERED" if not cand.eligible else "HOSPITAL_RANKED",
                entity_type="HOSPITAL",
                entity_id=cand.hospital.id,
                actor="GOVERNOR_DECISION_ENGINE",
                metadata={
                    "emergency_id": emergency.id,
                    "hospital_name": cand.hospital.name,
                    "eligible": cand.eligible,
                    "rank": cand.rank,
                    "score": cand.final_score,
                    "rejection_reason": match.rejection_reason
                }
            )

        db.commit()
        for m in created_matches:
            db.refresh(m)

        # Update emergency status
        eligible_matches = [m for m in created_matches if m.eligibility]
        if eligible_matches:
            emergency.status = "MATCHING"
        else:
            emergency.status = "NO_MATCH"
            notification_service.send(
                db=db,
                recipient_type="ADMIN",
                type="NO_MATCH_ALERT",
                title=f"No Eligible Hospital for {emergency.incident_reference}",
                message="All hospitals in the network failed mandatory requirements or capacity filters.",
                metadata={"emergency_id": emergency.id}
            )
            
        db.commit()
        db.refresh(emergency)

        audit_service.log(
            db=db, action="MATCHING_COMPLETED", entity_type="EMERGENCY", entity_id=emergency.id,
            actor="GOVERNOR_DECISION_ENGINE",
            metadata={
                "duration_ms": round((time.perf_counter() - started) * 1000.0, 1),
                "hospitals_evaluated": len(created_matches),
                "eligible": len(eligible_matches)
            }
        )
        return created_matches

    @classmethod
    async def dispatch_emergency(
        cls,
        db: Session,
        payload: EmergencyCreate,
        actor: str = "PATIENT_APP"
    ) -> Tuple[Emergency, AIAnalysisResult]:
        """
        Full intake pipeline: AI triage -> Governor matching -> referral to the #1 eligible hospital.
        Ends in AWAITING_ACCEPTANCE (hospital notified) or NO_MATCH (admins alerted).
        """
        from app.services.referral_service import referral_service
        emergency, ai_result = await cls.create_and_triage(db, payload, actor=actor)
        cls.match_hospitals(db, emergency.id)
        referral_service.request_acceptance(db, emergency.id)
        db.refresh(emergency)
        return emergency, ai_result

emergency_service = EmergencyService()
