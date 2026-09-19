from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from app.models.entities import Hospital, HospitalSpecialty, HospitalFacility, EmergencyBed, utc_now
from app.schemas.schemas import SimulationHospitalUpdate
from app.services.audit_service import audit_service

class SimulationService:
    @staticmethod
    def update_hospital_simulation(
        db: Session,
        payload: SimulationHospitalUpdate
    ) -> Optional[Hospital]:
        hosp = db.query(Hospital).filter(Hospital.id == payload.hospital_id).first()
        if not hosp:
            return None

        if payload.emergency_status is not None:
            hosp.emergency_status = payload.emergency_status
        if payload.accepting_emergencies is not None:
            hosp.accepting_emergencies = payload.accepting_emergencies
        if payload.overall_capacity is not None:
            hosp.overall_capacity = payload.overall_capacity

        if payload.stale_minutes_ago is not None:
            hosp.last_status_update = datetime.now(timezone.utc) - timedelta(minutes=payload.stale_minutes_ago)
        else:
            hosp.last_status_update = utc_now()

        # Update beds if requested
        if payload.available_beds is not None:
            beds = db.query(EmergencyBed).filter(EmergencyBed.hospital_id == hosp.id).all()
            for i, b in enumerate(beds):
                if i < payload.available_beds:
                    b.status = "AVAILABLE"
                    b.reserved_for = None
                else:
                    b.status = "OCCUPIED"
                b.updated_at = utc_now()

        # Update specialty status
        if payload.specialty_status:
            for spec_name, status_val in payload.specialty_status.items():
                spec = db.query(HospitalSpecialty).filter(
                    HospitalSpecialty.hospital_id == hosp.id,
                    HospitalSpecialty.specialty_name == spec_name
                ).first()
                if spec:
                    spec.status = status_val
                    spec.available_count = 1 if status_val == "AVAILABLE" else 0
                    spec.updated_at = utc_now()

        # Update facility status
        if payload.facility_status:
            for fac_name, status_val in payload.facility_status.items():
                fac = db.query(HospitalFacility).filter(
                    HospitalFacility.hospital_id == hosp.id,
                    HospitalFacility.facility_name == fac_name
                ).first()
                if fac:
                    fac.status = status_val
                    fac.available = (status_val == "OPERATIONAL")
                    fac.updated_at = utc_now()

        db.commit()
        db.refresh(hosp)

        audit_service.log(
            db=db,
            action="SIMULATION_STATE_MODIFIED",
            entity_type="HOSPITAL",
            entity_id=hosp.id,
            actor="SIMULATION_CONTROL_PANEL",
            metadata={"hospital_name": hosp.name}
        )
        return hosp

simulation_service = SimulationService()
