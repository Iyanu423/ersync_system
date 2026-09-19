from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.entities import Hospital, HospitalSpecialty, HospitalFacility, EmergencyBed, utc_now
from app.schemas.schemas import (
    HospitalCreate,
    HospitalUpdateStatus,
    HospitalUpdateCapacity,
    HospitalUpdateSpecialist,
    HospitalUpdateFacility
)
from app.governor.scoring import GovernorScoring
from app.services.audit_service import audit_service
from app.core.config import settings

class HospitalService:
    @staticmethod
    def get_all(db: Session) -> List[Hospital]:
        return db.query(Hospital).order_by(Hospital.name).all()

    @staticmethod
    def get_by_id(db: Session, hospital_id: str) -> Optional[Hospital]:
        return db.query(Hospital).filter(Hospital.id == hospital_id).first()

    @staticmethod
    def update_status(db: Session, hospital_id: str, payload: HospitalUpdateStatus, actor: str = "HOSPITAL_STAFF") -> Optional[Hospital]:
        hosp = db.query(Hospital).filter(Hospital.id == hospital_id).first()
        if not hosp:
            return None

        if payload.emergency_status is not None:
            hosp.emergency_status = payload.emergency_status
        if payload.accepting_emergencies is not None:
            hosp.accepting_emergencies = payload.accepting_emergencies

        hosp.last_status_update = utc_now()
        db.commit()
        db.refresh(hosp)

        audit_service.log(
            db=db,
            action="HOSPITAL_STATUS_UPDATED",
            entity_type="HOSPITAL",
            entity_id=hosp.id,
            actor=actor,
            metadata={"emergency_status": hosp.emergency_status, "accepting": hosp.accepting_emergencies}
        )
        return hosp

    @staticmethod
    def update_capacity(db: Session, hospital_id: str, payload: HospitalUpdateCapacity, actor: str = "HOSPITAL_STAFF") -> Optional[Hospital]:
        hosp = db.query(Hospital).filter(Hospital.id == hospital_id).first()
        if not hosp:
            return None

        hosp.overall_capacity = payload.overall_capacity
        hosp.last_status_update = utc_now()
        db.commit()
        db.refresh(hosp)

        audit_service.log(
            db=db,
            action="HOSPITAL_CAPACITY_UPDATED",
            entity_type="HOSPITAL",
            entity_id=hosp.id,
            actor=actor,
            metadata={"overall_capacity": hosp.overall_capacity}
        )
        return hosp

    @staticmethod
    def update_specialist(db: Session, hospital_id: str, payload: HospitalUpdateSpecialist, actor: str = "HOSPITAL_STAFF") -> Optional[HospitalSpecialty]:
        spec = db.query(HospitalSpecialty).filter(
            HospitalSpecialty.hospital_id == hospital_id,
            HospitalSpecialty.specialty_name == payload.specialty_name
        ).first()

        if not spec:
            spec = HospitalSpecialty(
                hospital_id=hospital_id,
                specialty_name=payload.specialty_name,
                available_count=payload.available_count,
                status=payload.status
            )
            db.add(spec)
        else:
            spec.available_count = payload.available_count
            spec.status = payload.status
            spec.updated_at = utc_now()

        hosp = db.query(Hospital).filter(Hospital.id == hospital_id).first()
        if hosp:
            hosp.last_status_update = utc_now()

        db.commit()
        db.refresh(spec)

        audit_service.log(
            db=db,
            action="SPECIALIST_STATUS_UPDATED",
            entity_type="HOSPITAL_SPECIALTY",
            entity_id=spec.id,
            actor=actor,
            metadata={"specialty": spec.specialty_name, "count": spec.available_count, "status": spec.status}
        )
        return spec

    @staticmethod
    def update_facility(db: Session, hospital_id: str, payload: HospitalUpdateFacility, actor: str = "HOSPITAL_STAFF") -> Optional[HospitalFacility]:
        fac = db.query(HospitalFacility).filter(
            HospitalFacility.hospital_id == hospital_id,
            HospitalFacility.facility_name == payload.facility_name
        ).first()

        if not fac:
            fac = HospitalFacility(
                hospital_id=hospital_id,
                facility_name=payload.facility_name,
                available=payload.available,
                status=payload.status,
                quantity=payload.quantity or 1
            )
            db.add(fac)
        else:
            fac.available = payload.available
            fac.status = payload.status
            if payload.quantity is not None:
                fac.quantity = payload.quantity
            fac.updated_at = utc_now()

        hosp = db.query(Hospital).filter(Hospital.id == hospital_id).first()
        if hosp:
            hosp.last_status_update = utc_now()

        db.commit()
        db.refresh(fac)

        audit_service.log(
            db=db,
            action="FACILITY_STATUS_UPDATED",
            entity_type="HOSPITAL_FACILITY",
            entity_id=fac.id,
            actor=actor,
            metadata={"facility": fac.facility_name, "available": fac.available, "status": fac.status}
        )
        return fac

    @staticmethod
    def touch_heartbeat(db: Session, hospital_id: str) -> Optional[Hospital]:
        hosp = db.query(Hospital).filter(Hospital.id == hospital_id).first()
        if hosp:
            hosp.last_status_update = utc_now()
            db.commit()
            db.refresh(hosp)
        return hosp

hospital_service = HospitalService()
