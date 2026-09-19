from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any
from app.database.session import get_db
from app.models.entities import (
    Emergency, Match, Referral, Hospital, EmergencyBed, Notification, AuditLog
)
from app.schemas.schemas import GovernorStatistics
from app.auth.security import get_current_user, require_admin
from app.governor.scoring import GovernorScoring
from datetime import datetime, timezone
from app.services.referral_service import referral_service, ACTIVE_EMERGENCY_STATUSES

router = APIRouter()

@router.get("/active", response_model=dict)
def get_active_emergencies(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    referral_service.expire_stale_referrals(db)
    active_emergencies = db.query(Emergency).filter(
        Emergency.status.in_(ACTIVE_EMERGENCY_STATUSES)
    ).order_by(Emergency.reported_at.desc()).all()
    
    active_referrals = db.query(Referral).filter(
        Referral.status.in_(["REQUESTED", "ACCEPTED"])
    ).all()
    
    return {
        "active_emergencies": [
            {
                "id": e.id,
                "incident_reference": e.incident_reference,
                "severity": e.severity,
                "status": e.status,
                "location_name": e.location_name,
                "reported_at": e.reported_at.isoformat() if e.reported_at else None
            } for e in active_emergencies
        ],
        "active_referrals": [
            {
                "id": r.id,
                "emergency_id": r.emergency_id,
                "hospital_id": r.hospital_id,
                "hospital_name": r.hospital.name if r.hospital else "Unknown",
                "status": r.status,
                "eta_minutes": r.eta_minutes
            } for r in active_referrals
        ]
    }

@router.get("/statistics", response_model=GovernorStatistics)
def get_governor_statistics(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    total_emergencies = db.query(func.count(Emergency.id)).scalar() or 0
    active_emergencies = db.query(func.count(Emergency.id)).filter(
        Emergency.status.in_(ACTIVE_EMERGENCY_STATUSES)
    ).scalar() or 0
    
    total_hospitals = db.query(func.count(Hospital.id)).scalar() or 0
    hospitals_accepting = db.query(func.count(Hospital.id)).filter(Hospital.accepting_emergencies == True).scalar() or 0
    
    total_beds = db.query(func.count(EmergencyBed.id)).scalar() or 0
    available_beds = db.query(func.count(EmergencyBed.id)).filter(EmergencyBed.status == "AVAILABLE").scalar() or 0
    
    referrals_accepted = db.query(func.count(Referral.id)).filter(Referral.status.in_(["ACCEPTED", "COMPLETED"])).scalar() or 0
    referrals_rejected = db.query(func.count(Referral.id)).filter(Referral.status == "REJECTED").scalar() or 0
    referrals_timed_out = db.query(func.count(Referral.id)).filter(Referral.status == "TIMEOUT").scalar() or 0

    # Failovers = automatic re-routes after a rejection/timeout, plus manual re-routes
    reroutes = db.query(func.count(AuditLog.id)).filter(
        AuditLog.action.in_(["FAILOVER_TRIGGERED", "REROUTE_INITIATED"])
    ).scalar() or 0

    # Real matching latency: average of the last 100 measured Governor runs
    recent = db.query(AuditLog).filter(AuditLog.action == "MATCHING_COMPLETED").order_by(AuditLog.created_at.desc()).limit(100).all()
    durations = [a.metadata_json.get("duration_ms") for a in recent if a.metadata_json and a.metadata_json.get("duration_ms") is not None]
    avg_match_ms = round(sum(durations) / len(durations), 1) if durations else 0.0
    
    now = datetime.now(timezone.utc)
    stale_threshold = 30  # minutes
    stale_count = 0
    hospitals = db.query(Hospital).all()
    now_utc = datetime.now(timezone.utc)
    for h in hospitals:
        last_up = h.last_status_update
        if last_up and last_up.tzinfo is None:
            last_up = last_up.replace(tzinfo=timezone.utc)
        if last_up:
            elapsed = (now_utc - last_up).total_seconds() / 60.0
            if elapsed > stale_threshold:
                stale_count += 1
    
    return GovernorStatistics(
        total_emergencies=total_emergencies,
        active_emergencies=active_emergencies,
        total_hospitals=total_hospitals,
        hospitals_accepting=hospitals_accepting,
        total_beds=total_beds,
        available_beds=available_beds,
        referrals_accepted=referrals_accepted,
        referrals_rejected=referrals_rejected,
        referrals_timed_out=referrals_timed_out,
        reroutes_count=reroutes,
        average_matching_time_ms=avg_match_ms,
        stale_hospitals_count=stale_count
    )

@router.get("/timeline", response_model=dict)
def get_governor_timeline(db: Session = Depends(get_db), current_user = Depends(get_current_user), limit: int = 50):
    """Live timeline of all Governor actions & events"""
    events = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    
    return {
        "events": [
            {
                "id": e.id,
                "actor": e.actor,
                "action": e.action,
                "entity_type": e.entity_type,
                "entity_id": e.entity_id,
                "metadata": e.metadata_json,
                "created_at": e.created_at.isoformat() if e.created_at else None
            } for e in events
        ]
    }

@router.get("/explanations/{emergency_id}", response_model=dict)
def get_governor_explanations(emergency_id: str, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Explain Governor decisions for a specific emergency"""
    matches = db.query(Match).filter(Match.emergency_id == emergency_id).order_by(Match.rank).all()
    
    eligible = [m for m in matches if m.eligibility]
    excluded = [m for m in matches if not m.eligibility]
    
    explanation = {
        "emergency_id": emergency_id,
        "summary": f"{len(eligible)} hospital(s) eligible out of {len(matches)} evaluated",
        "eligible_hospitals": [
            {
                "id": m.hospital_id,
                "name": m.hospital.name if m.hospital else "Unknown",
                "rank": m.rank,
                "score": m.score,
                "eta_minutes": m.eta_minutes,
                "distance_km": m.distance_km,
                "score_breakdown": m.score_breakdown,
                "why_selected": m.score_breakdown.get("explanations", []) if m.score_breakdown else []
            } for m in eligible
        ],
        "excluded_hospitals": [
            {
                "id": m.hospital_id,
                "name": m.hospital.name if m.hospital else "Unknown",
                "eligibility": m.eligibility,
                "rejection_reason": m.rejection_reason,
                "why_excluded": m.rejection_reason
            } for m in excluded
        ]
    }
    return explanation