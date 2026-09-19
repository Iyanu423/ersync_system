from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.models.entities import Emergency, Referral, Match, Hospital, EmergencyBed, utc_now
from app.services.audit_service import audit_service
from app.services.notification_service import notification_service
from app.governor.engine import GovernorDecisionEngine
from app.core.config import settings

ACTIVE_EMERGENCY_STATUSES = ["ANALYSING", "MATCHING", "AWAITING_ACCEPTANCE", "PATIENT_EN_ROUTE", "REROUTING", "ARRIVED"]


class NoBedAvailableError(Exception):
    """Raised when a hospital tries to accept a referral but has no free emergency bed to lock."""


def _as_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt

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

        # Never open a second live referral for the same emergency (e.g. dispatch clicked twice)
        live = db.query(Referral).filter(
            Referral.emergency_id == emergency_id,
            Referral.status.in_(["REQUESTED", "ACCEPTED"])
        ).first()
        if live:
            return live

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
                audit_service.log(
                    db=db, action="ALL_CANDIDATES_EXHAUSTED", entity_type="EMERGENCY",
                    entity_id=emergency.id, actor="GOVERNOR_ENGINE",
                    metadata={"incident_reference": emergency.incident_reference}
                )
                notification_service.send(
                    db=db, recipient_type="ADMIN", type="NO_MATCH_ALERT",
                    title=f"No hospital available for {emergency.incident_reference}",
                    message="Every eligible hospital has rejected or timed out. Manual dispatch required.",
                    metadata={"emergency_id": emergency.id}
                )
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
            reservation_expiry=utc_now() + timedelta(minutes=settings.REFERRAL_TIMEOUT_MINUTES),
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
            message=f"Urgent emergency referral ({emergency.severity}, {emergency.patient_count} patient(s)). ETA: {eta} min. Respond within {settings.REFERRAL_TIMEOUT_MINUTES:g} min or it will be re-routed.",
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
        """
        Locks emergency bed(s) and confirms the referral.
        Reserves one bed per patient where possible (at least one is required, otherwise
        NoBedAvailableError is raised and nothing changes). Returns (referral, first reserved bed).
        """
        referral = db.query(Referral).filter(Referral.id == referral_id).first()
        if not referral or referral.status != "REQUESTED":
            return None, None

        emergency = db.query(Emergency).filter(Emergency.id == referral.emergency_id).first()
        hospital = db.query(Hospital).filter(Hospital.id == referral.hospital_id).first()

        wanted = max(1, emergency.patient_count or 1)
        free_beds = db.query(EmergencyBed).filter(
            EmergencyBed.hospital_id == referral.hospital_id,
            EmergencyBed.status == "AVAILABLE"
        ).order_by(EmergencyBed.bed_number).limit(wanted).all()

        if not free_beds:
            raise NoBedAvailableError(
                f"{hospital.name} has no free emergency bed to reserve. "
                "Update your bed count or reject the referral so it can be re-routed."
            )

        for bed in free_beds:
            bed.status = "RESERVED"
            bed.reserved_for = emergency.id
            bed.updated_at = utc_now()

        reserved_bed = free_beds[0]
        partial = len(free_beds) < wanted
        referral.status = "ACCEPTED"
        referral.accepted_at = utc_now()
        referral.notes = notes or "Emergency accepted. Emergency bed and trauma team reserved."
        if partial:
            referral.notes += f" | PARTIAL: {len(free_beds)} of {wanted} beds reserved - remaining patients need another facility."

        emergency.status = "PATIENT_EN_ROUTE"
        db.commit()
        db.refresh(referral)
        db.refresh(emergency)

        audit_service.log(
            db=db, action="ACCEPTED", entity_type="REFERRAL", entity_id=referral.id, actor=actor,
            metadata={
                "hospital_id": hospital.id, "hospital_name": hospital.name,
                "beds_reserved": [b.bed_number for b in free_beds], "patients": wanted
            }
        )
        audit_service.log(
            db=db, action="BED_RESERVED", entity_type="EMERGENCY_BED", entity_id=reserved_bed.id,
            actor="HOSPITAL_SYSTEM",
            metadata={"bed_numbers": [b.bed_number for b in free_beds], "emergency_id": emergency.id}
        )

        bed_msg = f"{len(free_beds)} emergency bed(s) confirmed" + (f" (of {wanted} patients)" if partial else "")
        notification_service.send(
            db=db, recipient_type="PATIENT", type="REFERRAL_CONFIRMED",
            title="EMERGENCY DESTINATION CONFIRMED",
            message=f"Proceed immediately to {hospital.name}. {bed_msg}. ETA: {referral.eta_minutes} min.",
            metadata={
                "hospital_name": hospital.name, "address": hospital.address, "phone": hospital.phone,
                "latitude": hospital.latitude, "longitude": hospital.longitude,
                "eta_minutes": referral.eta_minutes, "emergency_id": emergency.id
            }
        )
        notification_service.send(
            db=db, recipient_type="HOSPITAL", recipient_id=hospital.id, type="REFERRAL_CONFIRMED",
            title="PATIENT EN ROUTE",
            message=f"Patient en route to {hospital.name} ({emergency.incident_reference}). {bed_msg}: {', '.join(b.bed_number for b in free_beds)}.",
            metadata={"emergency_id": emergency.id, "referral_id": referral.id}
        )
        return referral, reserved_bed

    @classmethod
    def _failover(cls, db: Session, emergency: Emergency) -> Optional[Referral]:
        """Re-score every hospital on live data, then contact the best one not yet tried."""
        from app.services.emergency_service import emergency_service
        emergency_service.match_hospitals(db, emergency.id)
        return cls.request_acceptance(db, emergency.id)

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

        referral.status = "REJECTED"
        referral.rejected_at = utc_now()
        referral.rejection_reason = reason
        referral.notes = notes
        emergency.status = "REROUTING"
        db.commit()

        audit_service.log(
            db=db, action="REFERRAL_REJECTED", entity_type="REFERRAL", entity_id=referral.id, actor=actor,
            metadata={"hospital_id": hospital.id, "hospital_name": hospital.name, "reason": reason}
        )
        audit_service.log(
            db=db, action="FAILOVER_TRIGGERED", entity_type="EMERGENCY", entity_id=emergency.id,
            actor="GOVERNOR_ENGINE", metadata={"rejected_by": hospital.name, "trigger": "Hospital Rejection"}
        )

        next_referral = cls._failover(db, emergency)
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
        if not referral or referral.status not in ("REQUESTED", "ACCEPTED"):
            return None, None

        emergency = db.query(Emergency).filter(Emergency.id == referral.emergency_id).first()

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
            db=db, action="REROUTE_INITIATED", entity_type="REFERRAL", entity_id=referral.id,
            actor=actor, metadata={"reason": reason}
        )
        next_referral = cls._failover(db, emergency)
        return referral, next_referral

    @classmethod
    def expire_stale_referrals(cls, db: Session) -> int:
        """
        Enforces the referral response window: any REQUESTED referral past its reservation_expiry
        is marked TIMEOUT and the case automatically fails over to the next best hospital.
        Returns the number of referrals expired.
        """
        now = datetime.now(timezone.utc)
        pending = db.query(Referral).filter(
            Referral.status == "REQUESTED", Referral.reservation_expiry.isnot(None)
        ).all()
        expired = 0
        for ref in pending:
            if _as_utc(ref.reservation_expiry) > now:
                continue
            emergency = db.query(Emergency).filter(Emergency.id == ref.emergency_id).first()
            hospital = db.query(Hospital).filter(Hospital.id == ref.hospital_id).first()
            ref.status = "TIMEOUT"
            ref.rejected_at = utc_now()
            ref.rejection_reason = f"No response within {settings.REFERRAL_TIMEOUT_MINUTES:g} minutes"
            if emergency and emergency.status == "AWAITING_ACCEPTANCE":
                emergency.status = "REROUTING"
            db.commit()
            expired += 1

            audit_service.log(
                db=db, action="REFERRAL_TIMEOUT", entity_type="REFERRAL", entity_id=ref.id, actor="SYSTEM_TIMER",
                metadata={"hospital_id": ref.hospital_id, "hospital_name": hospital.name if hospital else None}
            )
            notification_service.send(
                db=db, recipient_type="HOSPITAL", recipient_id=ref.hospital_id, type="REFERRAL_TIMEOUT",
                title="Referral expired",
                message=f"No response for {emergency.incident_reference if emergency else ref.emergency_id}; the case was re-routed.",
                metadata={"referral_id": ref.id}
            )
            if emergency and emergency.status == "REROUTING":
                audit_service.log(
                    db=db, action="FAILOVER_TRIGGERED", entity_type="EMERGENCY", entity_id=emergency.id,
                    actor="GOVERNOR_ENGINE",
                    metadata={"rejected_by": hospital.name if hospital else ref.hospital_id, "trigger": "Timeout"}
                )
                cls._failover(db, emergency)
        return expired

    @classmethod
    def mark_arrived(cls, db: Session, emergency_id: str, actor: str = "HOSPITAL_STAFF") -> Optional[Emergency]:
        emergency = db.query(Emergency).filter(Emergency.id == emergency_id).first()
        if not emergency:
            return None
        if emergency.status not in ("PATIENT_EN_ROUTE", "ACCEPTED"):
            raise ValueError(f"Emergency is '{emergency.status}'; only an accepted, en-route case can be marked arrived.")
        for bed in emergency.reserved_beds:
            bed.status = "OCCUPIED"
            bed.updated_at = utc_now()
        emergency.status = "ARRIVED"
        db.commit()
        audit_service.log(db=db, action="PATIENT_ARRIVED", entity_type="EMERGENCY", entity_id=emergency.id, actor=actor)
        return emergency

    @classmethod
    def close_case(cls, db: Session, emergency_id: str, actor: str = "HOSPITAL_STAFF") -> Optional[Emergency]:
        emergency = db.query(Emergency).filter(Emergency.id == emergency_id).first()
        if not emergency:
            return None
        if emergency.status not in ("ARRIVED", "PATIENT_EN_ROUTE", "ACCEPTED"):
            raise ValueError(f"Emergency is '{emergency.status}'; only an accepted/arrived case can be closed.")
        for bed in emergency.reserved_beds:
            bed.status = "AVAILABLE"
            bed.reserved_for = None
            bed.updated_at = utc_now()
        for ref in db.query(Referral).filter(Referral.emergency_id == emergency.id, Referral.status == "ACCEPTED").all():
            ref.status = "COMPLETED"
        emergency.status = "CLOSED"
        db.commit()
        audit_service.log(db=db, action="EMERGENCY_CLOSED", entity_type="EMERGENCY", entity_id=emergency.id, actor=actor)
        return emergency

referral_service = ReferralService()
