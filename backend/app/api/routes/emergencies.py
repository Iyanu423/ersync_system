from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database.session import get_db
from app.models.entities import Emergency, EmergencyRequirement
from app.schemas.schemas import EmergencyCreate, EmergencyResponse, EmergencyRequirementItem, AIAnalysisResult
from app.services.emergency_service import emergency_service
from app.ai.service import ai_service
from app.auth.security import get_current_user

router = APIRouter()

@router.post("", response_model=EmergencyResponse, status_code=status.HTTP_201_CREATED)
async def create_emergency(payload: EmergencyCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    emergency, ai_result = await emergency_service.create_and_triage(db, payload, actor=f"USER:{current_user.username if current_user else 'anonymous'}")
    return await _format_emergency(db, emergency, ai_result)

@router.post("/{emergency_id}/analyse", response_model=AIAnalysisResult)
async def analyse_emergency(emergency_id: str, db: Session = Depends(get_db)):
    emergency = db.query(Emergency).filter(Emergency.id == emergency_id).first()
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency not found")
    
    ai_result = await ai_service.analyse(
        description=emergency.description,
        category=emergency.category,
        additional_info={
            "patient_count": emergency.patient_count,
            "symptoms": emergency.symptoms,
            "location": emergency.location_name
        }
    )
    return ai_result

@router.post("/{emergency_id}/match", response_model=dict)
async def match_hospitals(emergency_id: str, db: Session = Depends(get_db)):
    emergency = db.query(Emergency).filter(Emergency.id == emergency_id).first()
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency not found")
    
    matches = emergency_service.match_hospitals(db, emergency_id)
    return {
        "emergency_id": emergency_id,
        "total_matches": len(matches),
        "eligible_count": len([m for m in matches if m.eligibility]),
        "matches": [_format_match(m) for m in matches]
    }

@router.get("/{emergency_id}/matches", response_model=dict)
async def get_matches(emergency_id: str, db: Session = Depends(get_db)):
    from app.models.entities import Match
    matches = db.query(Match).filter(Match.emergency_id == emergency_id).order_by(Match.rank).all()
    return {
        "emergency_id": emergency_id,
        "total_matches": len(matches),
        "eligible_count": len([m for m in matches if m.eligibility]),
        "matches": [_format_match(m) for m in matches]
    }

@router.get("/{emergency_id}", response_model=EmergencyResponse)
async def get_emergency(emergency_id: str, db: Session = Depends(get_db)):
    emergency = db.query(Emergency).filter(Emergency.id == emergency_id).first()
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency not found")
    return await _format_emergency(db, emergency)

async def _format_emergency(db: Session, emergency: Emergency, ai_result: AIAnalysisResult = None):
    reqs = db.query(EmergencyRequirement).filter(EmergencyRequirement.emergency_id == emergency.id).all()
    requirements = [
        EmergencyRequirementItem(
            id=r.id, requirement_type=r.requirement_type,
            requirement_name=r.requirement_name,
            required_quantity=r.required_quantity,
            mandatory=r.mandatory
        ) for r in reqs
    ]
    
    return EmergencyResponse(
        id=emergency.id,
        incident_reference=emergency.incident_reference,
        reported_at=emergency.reported_at,
        latitude=emergency.latitude,
        longitude=emergency.longitude,
        location_name=emergency.location_name,
        description=emergency.description,
        category=emergency.category,
        severity=emergency.severity,
        patient_count=emergency.patient_count,
        caller_phone=emergency.caller_phone,
        caller_name=emergency.caller_name,
        patient_age=emergency.patient_age,
        patient_gender=emergency.patient_gender,
        symptoms=emergency.symptoms,
        status=emergency.status,
        created_at=emergency.created_at,
        updated_at=emergency.updated_at,
        requirements=requirements
    )

def _format_match(m):
    return {
        "id": m.id,
        "hospital_id": m.hospital_id,
        "hospital_name": m.hospital.name if m.hospital else "Unknown",
        "score": m.score,
        "distance_km": m.distance_km,
        "eta_minutes": m.eta_minutes,
        "eligibility": m.eligibility,
        "rejection_reason": m.rejection_reason,
        "score_breakdown": m.score_breakdown,
        "rank": m.rank
    }