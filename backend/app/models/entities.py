import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship
from app.database.session import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False, index=True)
    address = Column(String(500), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    phone = Column(String(50), nullable=False)
    emergency_status = Column(String(50), default="OPEN") # OPEN, LIMITED, CLOSED
    overall_capacity = Column(Float, default=70.0) # 0.0 to 100.0%
    accepting_emergencies = Column(Boolean, default=True)
    last_status_update = Column(DateTime, default=utc_now, onupdate=utc_now)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    specialties = relationship("HospitalSpecialty", back_populates="hospital", cascade="all, delete-orphan")
    facilities = relationship("HospitalFacility", back_populates="hospital", cascade="all, delete-orphan")
    beds = relationship("EmergencyBed", back_populates="hospital", cascade="all, delete-orphan")
    matches = relationship("Match", back_populates="hospital")
    referrals = relationship("Referral", back_populates="hospital")
    users = relationship("User", back_populates="hospital")

class Specialty(Base):
    __tablename__ = "specialties"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    name = Column(String(100), unique=True, nullable=False, index=True)

class HospitalSpecialty(Base):
    __tablename__ = "hospital_specialties"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    hospital_id = Column(String(64), ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False)
    specialty_id = Column(String(64), ForeignKey("specialties.id"), nullable=True)
    specialty_name = Column(String(100), nullable=False, index=True)
    available_count = Column(Integer, default=1)
    status = Column(String(50), default="AVAILABLE") # AVAILABLE, UNAVAILABLE, ON_CALL
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    hospital = relationship("Hospital", back_populates="specialties")
    specialty = relationship("Specialty")

class Facility(Base):
    __tablename__ = "facilities"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    name = Column(String(100), unique=True, nullable=False, index=True)

class HospitalFacility(Base):
    __tablename__ = "hospital_facilities"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    hospital_id = Column(String(64), ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False)
    facility_id = Column(String(64), ForeignKey("facilities.id"), nullable=True)
    facility_name = Column(String(100), nullable=False, index=True)
    available = Column(Boolean, default=True)
    quantity = Column(Integer, default=1)
    status = Column(String(50), default="OPERATIONAL") # OPERATIONAL, DEGRADED, OFFLINE
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    hospital = relationship("Hospital", back_populates="facilities")
    facility = relationship("Facility")

class EmergencyBed(Base):
    __tablename__ = "emergency_beds"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    hospital_id = Column(String(64), ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False)
    bed_number = Column(String(50), nullable=False)
    status = Column(String(50), default="AVAILABLE") # AVAILABLE, OCCUPIED, RESERVED, MAINTENANCE
    reserved_for = Column(String(64), ForeignKey("emergencies.id", ondelete="SET NULL"), nullable=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    hospital = relationship("Hospital", back_populates="beds")
    emergency = relationship("Emergency", back_populates="reserved_beds")

class Emergency(Base):
    __tablename__ = "emergencies"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    incident_reference = Column(String(50), unique=True, nullable=False, index=True)
    reported_at = Column(DateTime, default=utc_now)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location_name = Column(String(255), default="Unknown Location")
    description = Column(Text, nullable=False)
    category = Column(String(100), default="Other")
    severity = Column(String(50), default="CRITICAL") # CRITICAL, HIGH, MEDIUM, LOW
    patient_count = Column(Integer, default=1)
    caller_phone = Column(String(50), nullable=True)
    caller_name = Column(String(100), nullable=True)
    patient_age = Column(Integer, nullable=True)
    patient_gender = Column(String(20), nullable=True)
    symptoms = Column(Text, nullable=True)
    status = Column(String(50), default="NEW", index=True) 
    # Status transitions: NEW -> ANALYSING -> MATCHING -> AWAITING_ACCEPTANCE -> ACCEPTED -> PATIENT_EN_ROUTE -> ARRIVED -> CLOSED
    # Failure branches: REJECTED, TIMEOUT, CANCELLED, NO_MATCH, REROUTING
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    requirements = relationship("EmergencyRequirement", back_populates="emergency", cascade="all, delete-orphan")
    matches = relationship("Match", back_populates="emergency", cascade="all, delete-orphan")
    referrals = relationship("Referral", back_populates="emergency", cascade="all, delete-orphan")
    reserved_beds = relationship("EmergencyBed", back_populates="emergency")

class EmergencyRequirement(Base):
    __tablename__ = "emergency_requirements"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    emergency_id = Column(String(64), ForeignKey("emergencies.id", ondelete="CASCADE"), nullable=False)
    requirement_type = Column(String(50), nullable=False) # SPECIALTY, FACILITY, BED, EQUIPMENT, SERVICE
    requirement_name = Column(String(100), nullable=False)
    required_quantity = Column(Integer, default=1)
    mandatory = Column(Boolean, default=True)

    emergency = relationship("Emergency", back_populates="requirements")

class Match(Base):
    __tablename__ = "matches"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    emergency_id = Column(String(64), ForeignKey("emergencies.id", ondelete="CASCADE"), nullable=False)
    hospital_id = Column(String(64), ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False)
    score = Column(Float, default=0.0)
    distance_km = Column(Float, default=0.0)
    eta_minutes = Column(Float, default=0.0)
    eligibility = Column(Boolean, default=True)
    rejection_reason = Column(Text, nullable=True)
    score_breakdown = Column(JSON, nullable=True) # {capability, eta, capacity, specialist, freshness}
    rank = Column(Integer, default=1)
    created_at = Column(DateTime, default=utc_now)

    emergency = relationship("Emergency", back_populates="matches")
    hospital = relationship("Hospital", back_populates="matches")

class Referral(Base):
    __tablename__ = "referrals"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    emergency_id = Column(String(64), ForeignKey("emergencies.id", ondelete="CASCADE"), nullable=False)
    hospital_id = Column(String(64), ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), default="REQUESTED", index=True) # REQUESTED, ACCEPTED, REJECTED, TIMEOUT, CANCELLED, REROUTED, COMPLETED
    requested_at = Column(DateTime, default=utc_now)
    accepted_at = Column(DateTime, nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    reservation_expiry = Column(DateTime, nullable=True)
    eta_minutes = Column(Float, default=0.0)
    notes = Column(Text, nullable=True)

    emergency = relationship("Emergency", back_populates="referrals")
    hospital = relationship("Hospital", back_populates="referrals")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    recipient_type = Column(String(50), nullable=False) # PATIENT, HOSPITAL, ADMIN, SYSTEM
    recipient_id = Column(String(64), nullable=True)
    type = Column(String(50), nullable=False) # EMERGENCY_DISPATCH, ACCEPTANCE_REQUEST, REFERRAL_CONFIRMED, REFERRAL_REJECTED, FAILOVER_TRIGGERED, BED_RESERVED, STALE_ALERT
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    metadata_json = Column(JSON, nullable=True)
    status = Column(String(50), default="PENDING") # PENDING, DELIVERED, READ
    created_at = Column(DateTime, default=utc_now)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    actor = Column(String(100), default="SYSTEM")
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(100), nullable=False)
    entity_id = Column(String(64), nullable=False)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utc_now, index=True)

class User(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(200), nullable=False)
    role = Column(String(50), default="PATIENT") # ADMIN, HOSPITAL_STAFF, PATIENT
    hospital_id = Column(String(64), ForeignKey("hospitals.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)

    hospital = relationship("Hospital", back_populates="users")
