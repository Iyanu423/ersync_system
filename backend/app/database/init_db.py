import json
import os
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.database.session import engine, Base, SessionLocal
from app.models.entities import (
    Hospital, Specialty, HospitalSpecialty, Facility, HospitalFacility,
    EmergencyBed, User, utc_now
)
from app.auth.security import get_password_hash

def get_seed_path() -> str:
    """Locate hospitals.json. Prefers backend/data/seed (deployed with the backend), then <repo>/data/seed."""
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.abspath(os.path.join(here, "..", "..", "data", "seed", "hospitals.json")),
        os.path.abspath(os.path.join(here, "..", "..", "..", "data", "seed", "hospitals.json")),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return candidates[0]

def init_db(db: Session = None, force_seed: bool = False):
    """
    Initializes database tables and seeds demo hospitals, reference catalogs, and users.
    """
    Base.metadata.create_all(bind=engine)
    
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        # Check if already seeded
        existing_hosp = db.query(Hospital).first()
        if existing_hosp and not force_seed:
            return

        if force_seed:
            # Clear existing data in reverse order of foreign keys
            db.query(EmergencyBed).delete()
            db.query(HospitalSpecialty).delete()
            db.query(HospitalFacility).delete()
            db.query(Hospital).delete()
            db.query(User).delete()
            db.commit()

        # 1. Seed Users
        admin_user = User(
            id="user_admin",
            username="admin",
            hashed_password=get_password_hash("admin123"),
            full_name="Dr. Olanrewaju Adeleke (State Emergency Director)",
            role="ADMIN",
            is_active=True
        )
        staff_user = User(
            id="user_staff",
            username="staff",
            hashed_password=get_password_hash("staff123"),
            full_name="Nurse Chioma Okoro (Lagos Central Triage Lead)",
            role="HOSPITAL_STAFF",
            hospital_id="hosp_lagos_central",
            is_active=True
        )
        patient_user = User(
            id="user_patient",
            username="patient",
            hashed_password=get_password_hash("patient123"),
            full_name="Babatunde Fashola (Paramedic / First Responder)",
            role="PATIENT",
            is_active=True
        )
        db.add_all([admin_user, staff_user, patient_user])

        # 2. Seed Reference Specialties & Facilities
        ref_specialties = [
            "General Medicine", "Surgery", "Orthopaedics", "Neurosurgery",
            "Cardiology", "Paediatrics", "Obstetrics/Gynaecology",
            "Anaesthesia", "Dentistry", "Ophthalmology", "Trauma"
        ]
        for spec_name in ref_specialties:
            if not db.query(Specialty).filter(Specialty.name == spec_name).first():
                db.add(Specialty(name=spec_name))

        ref_facilities = [
            "Emergency Department", "Operating Theatre", "CT Scanner",
            "X-Ray", "Ultrasound", "Blood Bank", "ICU", "Ambulance"
        ]
        for fac_name in ref_facilities:
            if not db.query(Facility).filter(Facility.name == fac_name).first():
                db.add(Facility(name=fac_name))

        # 3. Load 10 Simulated Hospitals from JSON
        seed_path = get_seed_path()

        if not os.path.exists(seed_path):
            raise RuntimeError(f"Hospital seed file not found at {seed_path}. The app cannot run without hospitals.")
        with open(seed_path, "r", encoding="utf-8") as f:
            hospitals_data = json.load(f)

        now = datetime.now(timezone.utc)
        for h_data in hospitals_data:
            stale_mins = h_data.get("stale_minutes_ago", 5)
            last_up = now - timedelta(minutes=stale_mins)

            hosp = Hospital(
                id=h_data["id"],
                name=h_data["name"],
                address=h_data["address"],
                latitude=h_data["latitude"],
                longitude=h_data["longitude"],
                phone=h_data["phone"],
                emergency_status=h_data.get("emergency_status", "OPEN"),
                overall_capacity=h_data.get("overall_capacity", 70.0),
                accepting_emergencies=h_data.get("accepting_emergencies", True),
                last_status_update=last_up
            )
            db.add(hosp)
            db.flush()

            # Add Specialties
            for s in h_data.get("specialties", []):
                h_spec = HospitalSpecialty(
                    hospital_id=hosp.id,
                    specialty_name=s["name"],
                    available_count=s.get("count", 1),
                    status=s.get("status", "AVAILABLE")
                )
                db.add(h_spec)

            # Add Facilities
            for fac in h_data.get("facilities", []):
                h_fac = HospitalFacility(
                    hospital_id=hosp.id,
                    facility_name=fac["name"],
                    available=fac.get("available", True),
                    status=fac.get("status", "OPERATIONAL"),
                    quantity=fac.get("quantity", 1)
                )
                db.add(h_fac)

            # Add Beds
            for b in h_data.get("beds", []):
                h_bed = EmergencyBed(
                    hospital_id=hosp.id,
                    bed_number=b["bed_number"],
                    status=b.get("status", "AVAILABLE")
                )
                db.add(h_bed)

        db.commit()
    finally:
        if should_close:
            db.close()

if __name__ == "__main__":
    init_db(force_seed=True)
    print("Database initialized and seeded successfully.")
