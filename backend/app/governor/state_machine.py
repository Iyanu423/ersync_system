import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session

from app.models.entities import (
    Emergency, Referral, Hospital, EmergencyBed, Match,
    Notification, AuditLog, utc_now
)
from app.schemas.schemas import ReferralResponse

logger = logging.getLogger(__name__)

class EmergencyState:
    NEW = "NEW"
    ANALYSING = "ANALYSING"
    MATCHING = "MATCHING"
    AWAITING_ACCEPTANCE = "AWAITING_ACCEPTANCE"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    REROUTING = "REROUTING"
    PATIENT_EN_ROUTE = "PATIENT_EN_ROUTE"
    ARRIVED = "ARRIVED"
    CLOSED = "CLOSED"
    NO_MATCH = "NO_MATCH"
    CANCELLED = "CANCELLED"

class ReferralStatus:
    REQUESTED = "REQUESTED"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    TIMEOUT = "TIMEOUT"
    REROUTED = "REROUTED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"

class ReferralStateMachine:
    """
    Manages the lifecycle and state transitions of Emergencies and Hospital Referrals.
    Enforces atomic bed reservations and automated failover rerouting.
    """

    RESERVATION_TIMEOUT_MINUTES = 5

    def __init__(self, db: Session):
        self.db = db

    def _log_audit(self, actor: str, action: str, entity_type: str, entity_id: str, metadata: Dict[str, Any]):
        audit = AuditLog(
            actor=actor,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            metadata_json=metadata
        )
        self.db.add(audit)

    def _create_notification(self, recipient_type: str, recipient_id: Optional[str], notif_type: str, title: str, message: str, metadata: Optional[Dict[str, Any]] = None):
        notif = Notification(
            recipient_type=recipient_type,
            recipient_id=recipient_id,
            type=notif_type,
            title=title,
            message=message,
            metadata_json=metadata or {}
        )
        self.db.add(notif)

    def dispatch_top_referral(self, emergency_id: str) -> Optional[Referral]:
        """
        Dispatches a referral request to the #1 ranked eligible hospital for this emergency.
        Sets emergency state to AWAITING_ACCEPTANCE.
        """
        emergency = self.db.query(Emergency).filter(Emergency.id == emergency_id).first()
        if not emergency:
            raise ValueError(f"Emergency {emergency_id} not found.")

        top_match = (
            self.db.query(Match)
            .filter(Match.emergency_id == emergency_id, Match.eligibility == True)
            .order_by(Match.rank.asc())
            .first()
        )

        if not top_match:
            emergency.status = EmergencyState.NO_MATCH
            self.db.commit()
            self._log_audit("GOVERNOR_ENGINE", "NO_ELIGIBLE_HOSPITALS", "Emergency", emergency.id, {})
            self._create_notification(
                "ADMIN", None, "NO_MATCH",
                "No Eligible Hospital Available",
                f"Emergency {emergency.incident_reference} has 0 matching hospitals with required capacity."
            )
            return None

        expiry = datetime.now(timezone.utc) + timedelta(minutes=self.RESERVATION_TIMEOUT_MINUTES)
        referral = Referral(
            emergency_id=emergency.id,
            hospital_id=top_match.hospital_id,
            status=ReferralStatus.REQUESTED,
            requested_at=utc_now(),
            reservation_expiry=expiry,
            eta_minutes=top_match.eta_minutes,
            notes=f"Automated Governor Dispatch to Rank #{top_match.rank} facility."
        )
        self.db.add(referral)
        self.db.flush()

        emergency.status = EmergencyState.AWAITING_ACCEPTANCE
        self._log_audit(
            "GOVERNOR_ENGINE", "REFERRAL_DISPATCHED", "Referral", referral.id,
            {"hospital_id": top_match.hospital_id, "rank": top_match.rank, "eta": top_match.eta_minutes}
        )
        self._create_notification(
            "HOSPITAL", top_match.hospital_id, "ACCEPTANCE_REQUEST",
            "Incoming Emergency Referral Request",
            f"Emergency {emergency.incident_reference} ({emergency.severity}) referral requested. ETA: {top_match.eta_minutes} min.",
            {"referral_id": referral.id, "emergency_id": emergency.id}
        )
        self.db.commit()
        return referral

    def accept_referral(self, referral_id: str, actor: str = "HOSPITAL_STAFF", notes: Optional[str] = None) -> Referral:
        """
        Hospital accepts the referral.
        Locks an available bed for this emergency, updates status to ACCEPTED.
        """
        referral = self.db.query(Referral).filter(Referral.id == referral_id).first()
        if not referral:
            raise ValueError(f"Referral {referral_id} not found.")

        if referral.status != ReferralStatus.REQUESTED:
            raise ValueError(f"Referral is already in status '{referral.status}'. Cannot accept.")

        emergency = referral.emergency
        hospital = referral.hospital

        # Lock an available bed atomically
        avail_bed = (
            self.db.query(EmergencyBed)
            .filter(EmergencyBed.hospital_id == hospital.id, EmergencyBed.status == "AVAILABLE")
            .first()
        )
        if avail_bed:
            avail_bed.status = "RESERVED"
            avail_bed.reserved_for = emergency.id
            avail_bed.updated_at = utc_now()

        referral.status = ReferralStatus.ACCEPTED
        referral.accepted_at = utc_now()
        if notes:
            referral.notes = notes

        emergency.status = EmergencyState.ACCEPTED

        self._log_audit(
            actor, "REFERRAL_ACCEPTED", "Referral", referral.id,
            {"hospital_id": hospital.id, "bed_reserved": avail_bed.bed_number if avail_bed else None}
        )
        self._create_notification(
            "PATIENT", None, "REFERRAL_CONFIRMED",
            "Emergency Hospital Confirmed",
            f"Facility '{hospital.name}' accepted your referral. Bed reserved. Ambulance en route.",
            {"hospital_name": hospital.name, "eta_minutes": referral.eta_minutes}
        )
        self.db.commit()
        return referral

    def reject_and_reroute(self, referral_id: str, reason: str, actor: str = "HOSPITAL_STAFF", notes: Optional[str] = None) -> Tuple[Referral, Optional[Referral]]:
        """
        Hospital rejects (or timeout occurs).
        Releases any reserved bed, triggers Governor failover to the next ranked candidate.
        """
        referral = self.db.query(Referral).filter(Referral.id == referral_id).first()
        if not referral:
            raise ValueError(f"Referral {referral_id} not found.")

        emergency = referral.emergency
        hospital = referral.hospital

        # Release any bed reserved
        for bed in hospital.beds:
            if bed.reserved_for == emergency.id:
                bed.status = "AVAILABLE"
                bed.reserved_for = None
                bed.updated_at = utc_now()

        referral.status = ReferralStatus.REJECTED
        referral.rejected_at = utc_now()
        referral.rejection_reason = reason
        if notes:
            referral.notes = (referral.notes or "") + f" | Rejection Note: {notes}"

        emergency.status = EmergencyState.REROUTING
        self._log_audit(
            actor, "REFERRAL_REJECTED", "Referral", referral.id,
            {"hospital_id": hospital.id, "reason": reason}
        )

        # Trigger Failover to Next Ranked Eligible Hospital
        # Get all previous attempted hospital IDs for this emergency
        past_attempts = {
            r.hospital_id for r in self.db.query(Referral).filter(Referral.emergency_id == emergency.id).all()
        }

        next_match = (
            self.db.query(Match)
            .filter(
                Match.emergency_id == emergency.id,
                Match.eligibility == True,
                ~Match.hospital_id.in_(past_attempts)
            )
            .order_by(Match.rank.asc())
            .first()
        )

        next_referral = None
        if next_match:
            expiry = datetime.now(timezone.utc) + timedelta(minutes=self.RESERVATION_TIMEOUT_MINUTES)
            next_referral = Referral(
                emergency_id=emergency.id,
                hospital_id=next_match.hospital_id,
                status=ReferralStatus.REQUESTED,
                requested_at=utc_now(),
                reservation_expiry=expiry,
                eta_minutes=next_match.eta_minutes,
                notes=f"Automated Governor Failover Reroute to Rank #{next_match.rank} facility after rejection by {hospital.name}."
            )
            self.db.add(next_referral)
            emergency.status = EmergencyState.AWAITING_ACCEPTANCE

            self._log_audit(
                "GOVERNOR_ENGINE", "FAILOVER_REROUTE_DISPATCHED", "Referral", next_referral.id,
                {"from_hospital": hospital.id, "to_hospital": next_match.hospital_id, "rank": next_match.rank}
            )
            self._create_notification(
                "HOSPITAL", next_match.hospital_id, "ACCEPTANCE_REQUEST",
                "Incoming Failover Emergency Referral",
                f"Emergency {emergency.incident_reference} rerouted to your facility. ETA: {next_match.eta_minutes} min.",
                {"referral_id": next_referral.id, "emergency_id": emergency.id}
            )
        else:
            emergency.status = EmergencyState.NO_MATCH
            self._log_audit("GOVERNOR_ENGINE", "ALL_CANDIDATES_EXHAUSTED", "Emergency", emergency.id, {})
            self._create_notification(
                "ADMIN", None, "FAILOVER_TRIGGERED",
                "All Hospital Candidates Exhausted",
                f"Emergency {emergency.incident_reference} has exhausted all eligible matching hospitals."
            )

        self.db.commit()
        return referral, next_referral

    def mark_patient_en_route(self, emergency_id: str, actor: str = "DISPATCHER") -> Emergency:
        emergency = self.db.query(Emergency).filter(Emergency.id == emergency_id).first()
        if not emergency:
            raise ValueError("Emergency not found")
        emergency.status = EmergencyState.PATIENT_EN_ROUTE
        self._log_audit(actor, "PATIENT_EN_ROUTE", "Emergency", emergency.id, {})
        self.db.commit()
        return emergency

    def mark_patient_arrived(self, emergency_id: str, actor: str = "HOSPITAL_STAFF") -> Emergency:
        emergency = self.db.query(Emergency).filter(Emergency.id == emergency_id).first()
        if not emergency:
            raise ValueError("Emergency not found")
        
        # Transition reserved bed to OCCUPIED
        for bed in emergency.reserved_beds:
            bed.status = "OCCUPIED"
            bed.updated_at = utc_now()

        emergency.status = EmergencyState.ARRIVED
        self._log_audit(actor, "PATIENT_ARRIVED", "Emergency", emergency.id, {})
        self.db.commit()
        return emergency

    def close_emergency(self, emergency_id: str, actor: str = "DISPATCHER", discharge_bed: bool = True) -> Emergency:
        emergency = self.db.query(Emergency).filter(Emergency.id == emergency_id).first()
        if not emergency:
            raise ValueError("Emergency not found")

        if discharge_bed:
            for bed in emergency.reserved_beds:
                bed.status = "AVAILABLE"
                bed.reserved_for = None
                bed.updated_at = utc_now()

        emergency.status = EmergencyState.CLOSED
        self._log_audit(actor, "EMERGENCY_CLOSED", "Emergency", emergency.id, {})
        self.db.commit()
        return emergency
