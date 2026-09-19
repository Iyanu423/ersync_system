from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict
from app.database.session import get_db
from app.models.entities import Referral, Emergency, EmergencyBed
from app.schemas.schemas import ReferralResponse, ReferralAcceptRequest, ReferralRejectRequest, ReferralRerouteRequest, EmergencyResponse
from app.services.referral_service import referral_service, NoBedAvailableError
from app.schemas.schemas import EmergencyResponse
from app.services.audit_service import audit_service
from app.auth.security import require_hospital_staff

router = APIRouter()

def _format_referral(db: Session, r: Referral) -> ReferralResponse:
    emergency = db.query(Emergency).filter(Emergency.id == r.emergency_id).first()
    
    return ReferralResponse(
        id=r.id,
        emergency_id=r.emergency_id,
        hospital_id=r.hospital_id,
        hospital_name=r.hospital.name if r.hospital else None,
        hospital_phone=r.hospital.phone if r.hospital else None,
        hospital_address=r.hospital.address if r.hospital else None,
        hospital_latitude=r.hospital.latitude if r.hospital else None,
        hospital_longitude=r.hospital.longitude if r.hospital else None,
        status=r.status,
        requested_at=r.requested_at,
        accepted_at=r.accepted_at,
        rejected_at=r.rejected_at,
        rejection_reason=r.rejection_reason,
        reservation_expiry=r.reservation_expiry,
        eta_minutes=r.eta_minutes,
        notes=r.notes,
        emergency=EmergencyResponse.model_validate(emergency) if emergency else None
    )

def _check_ownership(db: Session, referral_id: str, user):
    """HOSPITAL_STAFF may only answer referrals addressed to their own hospital."""
    ref = db.query(Referral).filter(Referral.id == referral_id).first()
    if ref and user.role == "HOSPITAL_STAFF" and ref.hospital_id != user.hospital_id:
        raise HTTPException(status_code=403, detail="Staff can only respond to referrals sent to their own hospital")

@router.post("/{referral_id}/accept", response_model=dict)
def accept_referral(
    referral_id: str,
    payload: ReferralAcceptRequest = None,
    db: Session = Depends(get_db),
    current_user = Depends(require_hospital_staff)
):
    _check_ownership(db, referral_id, current_user)
    try:
        referral, bed = referral_service.accept_referral(
            db=db,
            referral_id=referral_id,
            notes=payload.notes if payload else None,
            actor=f"STAFF:{current_user.username}"
        )
    except NoBedAvailableError as e:
        raise HTTPException(status_code=409, detail=str(e))
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found or already processed")

    beds_reserved = db.query(EmergencyBed).filter(
        EmergencyBed.reserved_for == referral.emergency_id, EmergencyBed.hospital_id == referral.hospital_id
    ).count()
    return {
        "status": "ACCEPTED",
        "referral_id": referral.id,
        "emergency_id": referral.emergency_id,
        "bed_reserved": bed.bed_number if bed else None,
        "beds_reserved": beds_reserved,
        "message": "Emergency accepted. Emergency bed and trauma team reserved."
    }

@router.post("/{referral_id}/reject", response_model=dict)
def reject_referral(
    referral_id: str,
    payload: ReferralRejectRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_hospital_staff)
):
    _check_ownership(db, referral_id, current_user)
    referral, next_referral = referral_service.reject_referral(
        db=db,
        referral_id=referral_id,
        reason=payload.reason,
        notes=payload.notes,
        actor=f"STAFF:{current_user.username}"
    )
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found or already processed")
    
    return {
        "status": "REJECTED",
        "referral_id": referral.id,
        "rejection_reason": payload.reason,
        "failover_triggered": next_referral is not None,
        "next_hospital_contacted": next_referral.hospital.name if next_referral and next_referral.hospital else None,
        "next_referral_id": next_referral.id if next_referral else None
    }

@router.post("/{referral_id}/reroute", response_model=dict)
def reroute_referral(
    referral_id: str,
    payload: ReferralRerouteRequest = None,
    db: Session = Depends(get_db),
    current_user = Depends(require_hospital_staff)
):
    _check_ownership(db, referral_id, current_user)
    referral, next_referral = referral_service.reroute_referral(
        db=db,
        referral_id=referral_id,
        reason=payload.reason if payload else "Hospital condition changed",
        actor=f"SYSTEM_FAILOVER:{current_user.username}"
    )
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found or not active")
    
    return {
        "status": "REROUTED",
        "referral_id": referral.id,
        "reroute_reason": payload.reason if payload else "Hospital condition changed",
        "next_hospital_contacted": next_referral.hospital.name if next_referral and next_referral.hospital else None,
        "next_referral_id": next_referral.id if next_referral else None
    }

@router.get("/{referral_id}", response_model=ReferralResponse)
def get_referral(referral_id: str, db: Session = Depends(get_db)):
    r = db.query(Referral).filter(Referral.id == referral_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Referral not found")
    return _format_referral(db, r)

@router.get("", response_model=List[ReferralResponse])
def list_referrals(
    db: Session = Depends(get_db),
    status_filter: str = None,
    hospital_id: str = None,
    limit: int = 100
):
    referral_service.expire_stale_referrals(db)   # enforce response windows even if the background timer is off
    q = db.query(Referral)
    if status_filter:
        q = q.filter(Referral.status == status_filter)
    if hospital_id:
        q = q.filter(Referral.hospital_id == hospital_id)
    return [_format_referral(db, r) for r in q.order_by(Referral.requested_at.desc()).limit(limit).all()]
