from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database.session import get_db
from app.models.entities import Hospital, HospitalSpecialty, HospitalFacility, EmergencyBed, utc_now
from app.schemas.schemas import (
    HospitalResponse, HospitalDetailResponse, HospitalCreate,
    HospitalUpdateStatus, HospitalUpdateCapacity, HospitalUpdateSpecialist,
    HospitalUpdateFacility, HospitalUpdateBeds, SpecialtyItem, FacilityItem
)
from app.auth.security import get_current_user, require_hospital_staff, require_admin
from app.services.hospital_service import hospital_service
from datetime import datetime, timezone

router = APIRouter()

def _format_hospital(h: Hospital) -> HospitalResponse:
    available_beds = sum(1 for b in h.beds if b.status == "AVAILABLE")
    total_beds = len(h.beds)

    last_up = h.last_status_update
    if last_up and last_up.tzinfo is None:
        last_up = last_up.replace(tzinfo=timezone.utc)
    elapsed = (datetime.now(timezone.utc) - last_up).total_seconds() / 60.0 if last_up else 0.0

    freshness = "FRESH"
    if elapsed > 60:
        freshness = "CRITICALLY_STALE"
    elif elapsed > 30:
        freshness = "STALE"
    elif elapsed > 15:
        freshness = "AGING"

    return HospitalResponse(
        id=h.id, name=h.name, address=h.address,
        latitude=h.latitude, longitude=h.longitude, phone=h.phone,
        emergency_status=h.emergency_status, overall_capacity=h.overall_capacity,
        accepting_emergencies=h.accepting_emergencies,
        last_status_update=h.last_status_update,
        created_at=h.created_at, updated_at=h.updated_at,
        is_stale=elapsed > 30, freshness_category=freshness,
        available_emergency_beds=available_beds,
        total_emergency_beds=total_beds,
        specialties=[
            SpecialtyItem(id=s.id, specialty_name=s.specialty_name, available_count=s.available_count, status=s.status)
            for s in h.specialties
        ],
        facilities=[
            FacilityItem(id=f.id, facility_name=f.facility_name, available=f.available, quantity=f.quantity, status=f.status)
            for f in h.facilities
        ]
    )

def _format_hospital_detail(h: Hospital) -> HospitalDetailResponse:
    base = _format_hospital(h)
    return HospitalDetailResponse(
        **base.model_dump(),
        beds=[
            {"id": b.id, "bed_number": b.bed_number, "status": b.status, "reserved_for": b.reserved_for}
            for b in h.beds
        ]
    )

@router.get("", response_model=List[HospitalResponse])
def list_hospitals(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
):
    hospitals = hospital_service.get_all(db)
    return [_format_hospital(h) for h in hospitals]

@router.get("/{hospital_id}", response_model=HospitalDetailResponse)
def get_hospital(hospital_id: str, db: Session = Depends(get_db)):
    h = hospital_service.get_by_id(db, hospital_id)
    if not h:
        raise HTTPException(status_code=404, detail="Hospital not found")
    return _format_hospital_detail(h)

@router.post("", response_model=HospitalResponse, status_code=status.HTTP_201_CREATED)
def create_hospital(hospital_data: HospitalCreate, db: Session = Depends(get_db), current_user = Depends(require_admin)):
    hosp = Hospital(
        name=hospital_data.name, address=hospital_data.address,
        latitude=hospital_data.latitude, longitude=hospital_data.longitude,
        phone=hospital_data.phone, emergency_status=hospital_data.emergency_status,
        overall_capacity=hospital_data.overall_capacity,
        accepting_emergencies=hospital_data.accepting_emergencies
    )
    db.add(hosp)
    db.flush()

    for s in hospital_data.specialties:
        db.add(HospitalSpecialty(hospital_id=hosp.id, specialty_name=s.specialty_name, available_count=s.available_count, status=s.status))
    for f in hospital_data.facilities:
        db.add(HospitalFacility(hospital_id=hosp.id, facility_name=f.facility_name, available=f.available, status=f.status, quantity=f.quantity))
    for i in range(hospital_data.total_beds):
        db.add(EmergencyBed(hospital_id=hosp.id, bed_number=f"EMG-{i+1:03d}", status="AVAILABLE"))

    db.commit()
    db.refresh(hosp)
    return _format_hospital(hosp)

@router.patch("/{hospital_id}/status", response_model=HospitalResponse)
def update_hospital_status(
    hospital_id: str, payload: HospitalUpdateStatus,
    db: Session = Depends(get_db),
    current_user = Depends(require_hospital_staff)
):
    if current_user.role == "HOSPITAL_STAFF" and current_user.hospital_id != hospital_id:
        raise HTTPException(status_code=403, detail="Staff can only modify their own hospital")

    hosp = hospital_service.update_status(db, hospital_id, payload, actor=f"STAFF:{current_user.username}")
    if not hosp:
        raise HTTPException(status_code=404, detail="Hospital not found")
    return _format_hospital(hosp)

@router.patch("/{hospital_id}/capacity", response_model=HospitalResponse)
def update_hospital_capacity(
    hospital_id: str, payload: HospitalUpdateCapacity,
    db: Session = Depends(get_db),
    current_user = Depends(require_hospital_staff)
):
    if current_user.role == "HOSPITAL_STAFF" and current_user.hospital_id != hospital_id:
        raise HTTPException(status_code=403, detail="Staff can only modify their own hospital")

    hosp = hospital_service.update_capacity(db, hospital_id, payload, actor=f"STAFF:{current_user.username}")
    if not hosp:
        raise HTTPException(status_code=404, detail="Hospital not found")
    return _format_hospital(hosp)

@router.patch("/{hospital_id}/specialists", response_model=SpecialtyItem)
def update_specialist(
    hospital_id: str, payload: HospitalUpdateSpecialist,
    db: Session = Depends(get_db),
    current_user = Depends(require_hospital_staff)
):
    if current_user.role == "HOSPITAL_STAFF" and current_user.hospital_id != hospital_id:
        raise HTTPException(status_code=403, detail="Staff can only modify their own hospital")

    spec = hospital_service.update_specialist(db, hospital_id, payload, actor=f"STAFF:{current_user.username}")
    if not spec:
        raise HTTPException(status_code=404, detail="Specialist not found")
    return SpecialtyItem(id=spec.id, specialty_name=spec.specialty_name, available_count=spec.available_count, status=spec.status)

@router.patch("/{hospital_id}/facilities", response_model=FacilityItem)
def update_facility(
    hospital_id: str, payload: HospitalUpdateFacility,
    db: Session = Depends(get_db),
    current_user = Depends(require_hospital_staff)
):
    if current_user.role == "HOSPITAL_STAFF" and current_user.hospital_id != hospital_id:
        raise HTTPException(status_code=403, detail="Staff can only modify their own hospital")

    fac = hospital_service.update_facility(db, hospital_id, payload, actor=f"STAFF:{current_user.username}")
    if not fac:
        raise HTTPException(status_code=404, detail="Facility not found")
    return FacilityItem(id=fac.id, facility_name=fac.facility_name, available=fac.available, quantity=fac.quantity, status=fac.status)

@router.patch("/{hospital_id}/beds", response_model=HospitalResponse)
def update_hospital_beds(
    hospital_id: str, payload: HospitalUpdateBeds,
    db: Session = Depends(get_db),
    current_user = Depends(require_hospital_staff)
):
    """
    Sets the real emergency bed rows (what the Governor counts), not just a percentage.
    RESERVED beds belong to live cases and are never removed or flipped.
    """
    from app.services.audit_service import audit_service
    if current_user.role == "HOSPITAL_STAFF" and current_user.hospital_id != hospital_id:
        raise HTTPException(status_code=403, detail="Staff can only modify their own hospital")

    hosp = hospital_service.get_by_id(db, hospital_id)
    if not hosp:
        raise HTTPException(status_code=404, detail="Hospital not found")

    beds = db.query(EmergencyBed).filter(EmergencyBed.hospital_id == hospital_id).all()
    reserved = [b for b in beds if b.status == "RESERVED"]
    total = max(payload.total_beds, len(reserved))

    # Grow / shrink the number of beds (shrink drops AVAILABLE first, then OCCUPIED; never RESERVED)
    if len(beds) < total:
        used = {b.bed_number for b in beds}
        n = 1
        for _ in range(total - len(beds)):
            while f"EMG-{n:03d}" in used:
                n += 1
            used.add(f"EMG-{n:03d}")
            db.add(EmergencyBed(hospital_id=hospital_id, bed_number=f"EMG-{n:03d}", status="AVAILABLE"))
        db.flush()
    elif len(beds) > total:
        removable = sorted([b for b in beds if b.status != "RESERVED"], key=lambda b: (b.status != "AVAILABLE", b.bed_number))
        for b in removable[: len(beds) - total]:
            db.delete(b)
        db.flush()

    beds = db.query(EmergencyBed).filter(EmergencyBed.hospital_id == hospital_id).order_by(EmergencyBed.bed_number).all()
    free_pool = [b for b in beds if b.status != "RESERVED"]
    available = min(payload.available_beds, len(free_pool))
    for i, b in enumerate(free_pool):
        b.status = "AVAILABLE" if i < available else "OCCUPIED"
        b.reserved_for = None
        b.updated_at = utc_now()

    total_now = len(beds)
    free_now = sum(1 for b in beds if b.status == "AVAILABLE")
    hosp.overall_capacity = round(((total_now - free_now) / total_now) * 100.0, 1) if total_now else 100.0
    hosp.last_status_update = utc_now()
    db.commit()
    db.refresh(hosp)

    audit_service.log(
        db=db, action="HOSPITAL_BEDS_UPDATED", entity_type="HOSPITAL", entity_id=hosp.id,
        actor=f"STAFF:{current_user.username}", metadata={"total_beds": total_now, "available_beds": free_now}
    )
    return _format_hospital(hosp)
