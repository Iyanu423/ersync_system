from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

# ==================== AUTH SCHEMAS ====================

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role: str = "PATIENT" # ADMIN, HOSPITAL_STAFF, PATIENT
    hospital_id: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    username: str
    full_name: str
    role: str
    hospital_id: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True

# ==================== HOSPITAL SCHEMAS ====================

class SpecialtyItem(BaseModel):
    id: Optional[str] = None
    specialty_name: str
    available_count: int = 1
    status: str = "AVAILABLE" # AVAILABLE, UNAVAILABLE, ON_CALL

    class Config:
        from_attributes = True

class FacilityItem(BaseModel):
    id: Optional[str] = None
    facility_name: str
    available: bool = True
    quantity: int = 1
    status: str = "OPERATIONAL" # OPERATIONAL, DEGRADED, OFFLINE

    class Config:
        from_attributes = True

class BedItem(BaseModel):
    id: Optional[str] = None
    bed_number: str
    status: str = "AVAILABLE" # AVAILABLE, OCCUPIED, RESERVED, MAINTENANCE
    reserved_for: Optional[str] = None

    class Config:
        from_attributes = True

class HospitalBase(BaseModel):
    name: str
    address: str
    latitude: float
    longitude: float
    phone: str
    emergency_status: str = "OPEN" # OPEN, LIMITED, CLOSED
    overall_capacity: float = 70.0
    accepting_emergencies: bool = True

class HospitalCreate(HospitalBase):
    specialties: List[SpecialtyItem] = []
    facilities: List[FacilityItem] = []
    total_beds: int = 5

class HospitalUpdateStatus(BaseModel):
    emergency_status: Optional[str] = None
    accepting_emergencies: Optional[bool] = None

class HospitalUpdateCapacity(BaseModel):
    overall_capacity: float = Field(..., ge=0.0, le=100.0)

class HospitalUpdateSpecialist(BaseModel):
    specialty_name: str
    available_count: int
    status: str

class HospitalUpdateFacility(BaseModel):
    facility_name: str
    available: bool
    status: str
    quantity: Optional[int] = 1

class HospitalResponse(HospitalBase):
    id: str
    last_status_update: datetime
    created_at: datetime
    updated_at: datetime
    is_stale: bool = False
    freshness_category: str = "FRESH" # FRESH, AGING, STALE
    available_emergency_beds: int = 0
    total_emergency_beds: int = 0
    specialties: List[SpecialtyItem] = []
    facilities: List[FacilityItem] = []

    class Config:
        from_attributes = True

class HospitalDetailResponse(HospitalResponse):
    beds: List[BedItem] = []

# ==================== EMERGENCY & AI SCHEMAS ====================

class EmergencyRequirementItem(BaseModel):
    id: Optional[str] = None
    requirement_type: str # SPECIALTY, FACILITY, BED, EQUIPMENT, SERVICE
    requirement_name: str
    required_quantity: int = 1
    mandatory: bool = True

    class Config:
        from_attributes = True

class EmergencyCreate(BaseModel):
    latitude: float
    longitude: float
    location_name: Optional[str] = "Current Location"
    description: str
    category: str = "Other"
    patient_count: int = 1
    caller_phone: Optional[str] = None
    caller_name: Optional[str] = None
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    symptoms: Optional[str] = None

class AIAnalysisResult(BaseModel):
    severity: str = "CRITICAL" # CRITICAL, HIGH, MEDIUM, LOW
    confidence: float = 0.95
    suspected_conditions: List[str] = []
    required_capabilities: List[str] = []
    required_facilities: List[str] = []
    rationale: str = ""
    disclaimer: str = "Suspected emergency requirements based on preliminary triage intake. Not a definitive medical diagnosis."

class EmergencyResponse(BaseModel):
    id: str
    incident_reference: str
    reported_at: datetime
    latitude: float
    longitude: float
    location_name: str
    description: str
    category: str
    severity: str
    patient_count: int
    caller_phone: Optional[str] = None
    caller_name: Optional[str] = None
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    symptoms: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    requirements: List[EmergencyRequirementItem] = []

    class Config:
        from_attributes = True

# ==================== GOVERNOR MATCH & SCORING SCHEMAS ====================

class ScoreBreakdown(BaseModel):
    capability_score: float = 0.0 # 0-100
    eta_score: float = 0.0 # 0-100
    capacity_score: float = 0.0 # 0-100
    specialist_score: float = 0.0 # 0-100
    freshness_score: float = 0.0 # 0-100
    final_score: float = 0.0 # 0-100
    weights_applied: Dict[str, float] = {}
    explanations: List[str] = []

class MatchResponse(BaseModel):
    id: str
    emergency_id: str
    hospital_id: str
    hospital_name: str
    hospital_address: str
    hospital_latitude: float
    hospital_longitude: float
    score: float
    distance_km: float
    eta_minutes: float
    eligibility: bool
    rejection_reason: Optional[str] = None
    score_breakdown: Optional[ScoreBreakdown] = None
    rank: int
    created_at: datetime
    available_beds: int = 0
    accepting_emergencies: bool = True
    emergency_status: str = "OPEN"

    class Config:
        from_attributes = True

class GovernorMatchResult(BaseModel):
    emergency_id: str
    timestamp: datetime
    total_evaluated: int
    eligible_count: int
    excluded_count: int
    matches: List[MatchResponse]
    top_recommended: Optional[MatchResponse] = None
    decision_summary: str = ""
    audit_events: List[Dict[str, Any]] = []

# ==================== REFERRAL & WORKFLOW SCHEMAS ====================

class ReferralResponse(BaseModel):
    id: str
    emergency_id: str
    hospital_id: str
    hospital_name: Optional[str] = None
    hospital_phone: Optional[str] = None
    hospital_address: Optional[str] = None
    hospital_latitude: Optional[float] = None
    hospital_longitude: Optional[float] = None
    status: str
    requested_at: datetime
    accepted_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    reservation_expiry: Optional[datetime] = None
    eta_minutes: float
    notes: Optional[str] = None
    emergency: Optional[EmergencyResponse] = None

    class Config:
        from_attributes = True

class ReferralAcceptRequest(BaseModel):
    notes: Optional[str] = "Emergency accepted. Emergency bed and trauma team reserved."

class ReferralRejectRequest(BaseModel):
    reason: str = "Capacity full"
    notes: Optional[str] = None

class ReferralRerouteRequest(BaseModel):
    reason: str = "Hospital condition changed or staff unavailable"

# ==================== NOTIFICATION & AUDIT ====================

class NotificationResponse(BaseModel):
    id: str
    recipient_type: str
    recipient_id: Optional[str] = None
    type: str
    title: str
    message: str
    metadata_json: Optional[Dict[str, Any]] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class AuditLogResponse(BaseModel):
    id: str
    actor: str
    action: str
    entity_type: str
    entity_id: str
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True

# ==================== GOVERNOR STATS & SIMULATION ====================

class GovernorStatistics(BaseModel):
    total_emergencies: int = 0
    active_emergencies: int = 0
    total_hospitals: int = 0
    hospitals_accepting: int = 0
    total_beds: int = 0
    available_beds: int = 0
    referrals_accepted: int = 0
    referrals_rejected: int = 0
    reroutes_count: int = 0
    average_matching_time_ms: float = 0.0
    stale_hospitals_count: int = 0

class SimulationHospitalUpdate(BaseModel):
    hospital_id: str
    available_beds: Optional[int] = None
    accepting_emergencies: Optional[bool] = None
    emergency_status: Optional[str] = None
    overall_capacity: Optional[float] = None
    specialty_status: Optional[Dict[str, str]] = None # {"Surgery": "UNAVAILABLE"}
    facility_status: Optional[Dict[str, str]] = None # {"CT Scanner": "OFFLINE"}
    stale_minutes_ago: Optional[int] = None

class OneClickDemoStep(BaseModel):
    step_number: int
    title: str
    status: str
    timestamp: str
    details: Dict[str, Any]

class OneClickDemoResponse(BaseModel):
    scenario_name: str
    emergency_id: str
    incident_reference: str
    severity: str
    first_hospital_attempted: Dict[str, Any]
    first_rejection_reason: str
    second_hospital_attempted: Dict[str, Any]
    second_accepted: bool
    referral_id: str
    bed_reserved: bool
    eta_minutes: float
    distance_km: float
    timeline: List[OneClickDemoStep]
