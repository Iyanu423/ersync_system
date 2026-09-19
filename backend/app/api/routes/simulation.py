from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict
from app.database.session import get_db
from app.schemas.schemas import SimulationHospitalUpdate
from app.services.simulation_service import simulation_service
from app.auth.security import require_admin

router = APIRouter()

@router.post("/hospitals", response_model=dict)
def update_simulation_hospital(
    payload: SimulationHospitalUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    hosp = simulation_service.update_hospital_simulation(db, payload)
    if not hosp:
        raise HTTPException(status_code=404, detail="Hospital not found")
    
    return {
        "status": "updated",
        "hospital_id": hosp.id,
        "hospital_name": hosp.name,
        "emergency_status": hosp.emergency_status,
        "accepting_emergencies": hosp.accepting_emergencies,
        "overall_capacity": hosp.overall_capacity,
        "last_status_update": hosp.last_status_update.isoformat() if hosp.last_status_update else None
    }

@router.post("/stale/{hospital_id}", response_model=dict)
def make_hospital_stale(
    hospital_id: str,
    minutes_ago: int = 45,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    """Force a hospital telemetry state to be stale (demonstrates Governor penalizing/excluding it)"""
    from datetime import datetime, timezone, timedelta
    from app.models.entities import Hospital
    
    hosp = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hosp:
        raise HTTPException(status_code=404, detail="Hospital not found")
    
    hosp.last_status_update = datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)
    db.commit()
    db.refresh(hosp)
    
    return {
        "status": "stale",
        "hospital_id": hosp.id,
        "hospital_name": hosp.name,
        "minutes_since_update": minutes_ago
    }

@router.post("/reset", response_model=dict)
def reset_simulation(db: Session = Depends(get_db), current_user = Depends(require_admin)):
    """Reseed all simulation data to fresh initial state"""
    from app.database.init_db import init_db
    
    # Reset only hospital telemetry (not erase emergencies/referrals for audit continuity)
    from app.models.entities import Hospital, EmergencyBed, HospitalSpecialty, HospitalFacility
    import json, os
    from datetime import datetime, timezone, timedelta
    
    # Clear beds and rebuild from seed file
    hospitals = db.query(Hospital).all()
    
    seed_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "data", "seed", "hospitals.json"))
    if not os.path.exists(seed_path):
        return {"status": "error", "message": "Seed file not found"}
    
    with open(seed_path, "r", encoding="utf-8") as f:
        hospitals_data = json.load(f)
    
    now = datetime.now(timezone.utc)
    for h_data in hospitals_data:
        hosp = db.query(Hospital).filter(Hospital.id == h_data["id"]).first()
        if not hosp:
            continue
        
        hosp.emergency_status = h_data.get("emergency_status", "OPEN")
        hosp.overall_capacity = h_data.get("overall_capacity", 70.0)
        hosp.accepting_emergencies = h_data.get("accepting_emergencies", True)
        hosp.last_status_update = now - timedelta(minutes=h_data.get("stale_minutes_ago", 5))
        
        # Reset beds
        existing_beds = db.query(EmergencyBed).filter(EmergencyBed.hospital_id == hosp.id).all()
        for b in existing_beds:
            db.delete(b)
        db.flush()
        for b_data in h_data.get("beds", []):
            db.add(EmergencyBed(hospital_id=hosp.id, bed_number=b_data["bed_number"], status=b_data.get("status", "AVAILABLE")))
        
        # Reset specialties
        existing_specs = db.query(HospitalSpecialty).filter(HospitalSpecialty.hospital_id == hosp.id).all()
        for s in existing_specs:
            db.delete(s)
        db.flush()
        for s_data in h_data.get("specialties", []):
            db.add(HospitalSpecialty(hospital_id=hosp.id, specialty_name=s_data["name"], available_count=s_data.get("count", 1), status=s_data.get("status", "AVAILABLE")))
        
        # Reset facilities
        existing_facs = db.query(HospitalFacility).filter(HospitalFacility.hospital_id == hosp.id).all()
        for f in existing_facs:
            db.delete(f)
        db.flush()
        for f_data in h_data.get("facilities", []):
            db.add(HospitalFacility(hospital_id=hosp.id, facility_name=f_data["name"], available=f_data.get("available", True), status=f_data.get("status", "OPERATIONAL"), quantity=f_data.get("quantity", 1)))
    
    db.commit()
    
    return {"status": "reset", "message": "Simulation telemetry reset to fresh seed state"}