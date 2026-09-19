from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.models.entities import Emergency, Referral, Match, Hospital, EmergencyBed, utc_now
from app.services.audit_service import audit_service
from app.services.notification_service import notification_service
from app.governor.engine import GovernorDecisionEngine

class ReferralService:
    @classmethod
    def request_acceptance(
        cls,
        db: Session,
        emergency_id: str,
        hospital_id: Optional[str] = None
    ) -> Optional[Referral]:
        emergency = db.query(Emergency).filter(Emergency.id == emergency_id).first()
        if not emergency:
            return None

        # If hospital_id is not specified, pick highest ranked eligible match
        if not hospital_id:
            # Query existing referrals for this emergency to avoid retrying already rejected hospitals
            past_hospital_ids = [
                r.hospital_id for r in db.query(Referral).filter(Referral.emergency_id == emergency_id).all()
            ]
            
            best_match = db.query(Match).filter(
                Match.emergency_id == emergency_id,
                Match.eligibility == True,
                ~Match.hospital_id.in_(past_hospital_ids) if past_hospital_ids else True
            ).order_by(Match.rank.asc()).first()

            if not best_match:
                emergency.status = "NO_MATCH"
                db.commit()
                return None
            hospital_id = best_match.hospital_id

        hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
        if not hospital:
            return None

        # Fetch match for ETA
        match_obj = db.query(Match).filter(
            Match.emergency_id == emergency_id,
            Match.hospital_id == hospital_id
        ).first()
        eta = match_obj.eta_minutes if match_obj else 15.0

        # Create Referral
        referral = Referral(
            emergency_id=emergency_id,
            hospital_id=hospital_id,
            status="REQUESTED",
            requested_at=utc_now(),
            reservation_expiry=utc_now() + timedelta(minutes=15),
            eta_minutes=eta
        )
        db.add(referral)

        emergency.status = "AWAITING_ACCEPTANCE"
        db.commit()
        db.refresh(referral)
        db.refresh(emergency)

        audit_service.log(
            db=db,
            action="ACCEPTANCE_REQUESTED",
            entity_type="REFERRAL",
            entity_id=referral.id,
            actor="GOVERNOR_ENGINE",
            metadata={
                "emergency_id": emergency_id,
                "incident_reference": emergency.incident_reference,
                "hospital_id": hospital_id,
                "hospital_name": hospital.name,
                "eta_minutes": eta
            }
        )

        notification_service.send(
            db=db,
            recipient_type="HOSPITAL",
            recipient_id=hospital.id,
            type="ACCEPTANCE_REQUEST",
            title=f"🚨 INCOMING EMERGENCY: {emergency.incident_reference}",
            message=f"Urgent emergency referral ({emergency.severity}). ETA: {eta} min. Please accept or reject.",
            metadata={"referral_id": referral.id, "emergency_id": emergency.id}
        )

        return referral

    @classmethod
    def accept_referral(
        cls,
        db: Session,
        referral_id: str,
        notes: Optional[str] = None,
        actor: str = "HOSPITAL_STAFF"
    ) -> Tuple[Optional[Referral], Optional[EmergencyBed]]:
        referral = db.query(Referral).filter(Referral.id == referral_id).first()
        if not referral or referral.status != "REQUESTED":
            return None, None

        emergency = db.query(Emergency).filter(Emergency.id == referral.emergency_id).first()
        hospital = db.query(Hospital).filter(Hospital.id == referral.hospital_id).first()

        # Update Referral status
        referral.status = "ACCEPTED"
        referral.accepted_at = utc_now()
        referral.notes = notes or "Emergency accepted. Emergency bed and trauma team reserved."

        # Reserve Emergency Bed
        reserved_bed = db.query(EmergencyBed).filter(
            EmergencyBed.hospital_id == referral.hospital_id,
            EmergencyBed.status == "AVAILABLE"
        ).first()

        if reserved_bed:
            reserved_bed.status = "RESERVED"
            reserved_bed.reserved_for = emergency.id
            reserved_bed.updated_at = utc_now()

        # Update Emergency status
        emergency.status = "PATIENT_EN_ROUTE"
        db.commit()
        db.refresh(referral)
        db.refresh(emergency)
        if reserved_bed:
            db.refresh(reserved_bed)

        # Audit Logs
        audit_service.log(
            db=db,
            action="ACCEPTED",
            entity_type="REFERRAL",
            entity_id=referral.id,
            actor=actor,
            metadata={
                "hospital_id": hospital.id,
                "hospital_name": hospital.name,
                "bed_reserved": reserved_bed.bed_number if reserved_bed else "None"
            }
        )

        if reserved_bed:
            audit_service.log(
                db=db,
                action="BED_RESERVED",
                entity_type="EMERGENCY_BED",
                entity_id=reserved_bed.id,
                actor="HOSPITAL_SYSTEM",
                metadata={"bed_number": reserved_bed.bed_number, "emergency_id": emergency.id}
            )

        # Patient Notification
        notification_service.send(
            db=db,
            recipient_type="PATIENT",
            type="REFERRAL_CONFIRMED",
            title="EMERGENCY DESTINATION CONFIRMED",
            message=f"Proceed immediately to {hospital.name}. Emergency bed confirmed. ETA: {referral.eta_minutes} min.",
            metadata={
                "hospital_name": hospital.name,
                "address": hospital.address,
                "phone": hospital.phone,
                "latitude": hospital.latitude,
                "longitude": hospital.longitude,
                "eta_minutes": referral.eta_minutes
            }
        )

        # Hospital Notification
        notification_service.send(
            db=db,
            recipient_type="HOSPITAL",
            recipient_id=hospital.id,
            type="REFERRAL_CONFIRMED",
            title="PATIENT EN ROUTE",
            message=f"Patient en route to {hospital.name} ({emergency.incident_reference}). Bed {reserved_bed.bed_number if reserved_bed else 'reserved'} prepped.",
            metadata={"emergency_id": emergency.id, "referral_id": referral.id}
        )

        return referral, reserved_bed

    @classmethod
    def reject_referral(
        cls,
        db: Session,
        referral_id: str,
        reason: str = "Capacity full",
        notes: Optional[str] = None,
        actor: str = "HOSPITAL_STAFF"
    ) -> Tuple[Optional[Referral], Optional[Referral]]:
        referral = db.query(Referral).filter(Referral.id == referral_id).first()
        if not referral or referral.status != "REQUESTED":
            return None, None

        emergency = db.query(Emergency).filter(Emergency.id == referral.emergency_id).first()
        hospital = db.query(Hospital).filter(Hospital.id == referral.hospital_id).first()

        # Update Referral to REJECTED
        referral.status = "REJECTED"
        referral.rejected_at = utc_now()
        referral.rejection_reason = reason
        referral.notes = notes

        # Update emergency to REROUTING
        emergency.status = "REROUTING"
        db.commit()

        audit_service.log(
            db=db,
            action="REFERRAL_REJECTED",
            entity_type="REFERRAL",
            entity_id=referral.id,
            actor=actor,
            metadata={"hospital_id": hospital.id, "hospital_name": hospital.name, "reason": reason}
        )

        audit_service.log(
            db=db,
            action="FAILOVER_TRIGGERED",
            entity_type="EMERGENCY",
            entity_id=emergency.id,
            actor="GOVERNOR_ENGINE",
            metadata={"rejected_by": hospital.name, "trigger": "Hospital Rejection"}
        )

        # AUTOMATIC FAILOVER: Find next best candidate
        next_referral = cls.request_acceptance(db, emergency.id)

        return referral, next_referral

    @classmethod
    def reroute_referral(
        cls,
        db: Session,
        referral_id: str,
        reason: str = "Capacity lost or hospital condition changed",
        actor: str = "SYSTEM_FAILOVER"
    ) -> Tuple[Optional[Referral], Optional[Referral]]:
        referral = db.query(Referral).filter(Referral.id == referral_id).first()
        if not referral:
            return None, None

        emergency = db.query(Emergency).filter(Emergency.id == referral.emergency_id).first()
        
        # Release any reserved bed
        beds = db.query(EmergencyBed).filter(EmergencyBed.reserved_for == emergency.id).all()
        for b in beds:
            b.status = "AVAILABLE"
            b.reserved_for = None
            b.updated_at = utc_now()

        referral.status = "REROUTED"
        referral.rejection_reason = reason
        emergency.status = "REROUTING"
        db.commit()

        audit_service.log(
            db=db,
            action="REROUTE_INITIATED",
            entity_type="REFERRAL",
            entity_id=referral.id,
            actor=actor,
            metadata={"reason": reason}
        )

        # Trigger new referral to next eligible hospital
        next_referral = cls.request_acceptance(db, emergency.id)
        return referral, next_referral

referral_service = ReferralService()
