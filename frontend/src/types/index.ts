export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type EmergencyStatus = 
  | 'NEW' 
  | 'ANALYSING' 
  | 'MATCHING' 
  | 'AWAITING_ACCEPTANCE' 
  | 'ACCEPTED' 
  | 'PATIENT_EN_ROUTE' 
  | 'ARRIVED' 
  | 'CLOSED' 
  | 'REJECTED' 
  | 'TIMEOUT' 
  | 'CANCELLED' 
  | 'NO_MATCH' 
  | 'REROUTING';

export type HospitalStatus = 'OPEN' | 'LIMITED' | 'CLOSED';
export type FreshnessCategory = 'FRESH' | 'AGING' | 'STALE' | 'CRITICALLY_STALE';
export type UserRole = 'ADMIN' | 'HOSPITAL_STAFF' | 'PATIENT';

export interface SpecialtyItem {
  id?: string;
  specialty_name: string;
  available_count: number;
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'ON_CALL';
}

export interface FacilityItem {
  id?: string;
  facility_name: string;
  available: boolean;
  quantity: number;
  status: 'OPERATIONAL' | 'DEGRADED' | 'OFFLINE';
}

export interface BedItem {
  id?: string;
  bed_number: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE';
  reserved_for?: string | null;
}

export interface Hospital {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  emergency_status: HospitalStatus;
  overall_capacity: number;
  accepting_emergencies: boolean;
  last_status_update: string;
  created_at: string;
  updated_at: string;
  is_stale: boolean;
  freshness_category: FreshnessCategory;
  available_emergency_beds: number;
  total_emergency_beds: number;
  specialties: SpecialtyItem[];
  facilities: FacilityItem[];
  beds?: BedItem[];
}

export interface EmergencyRequirement {
  id?: string;
  requirement_type: 'SPECIALTY' | 'FACILITY' | 'BED' | 'EQUIPMENT' | 'SERVICE';
  requirement_name: string;
  required_quantity: number;
  mandatory: boolean;
}

export interface Emergency {
  id: string;
  incident_reference: string;
  reported_at: string;
  latitude: number;
  longitude: number;
  location_name: string;
  description: string;
  category: string;
  severity: Severity;
  patient_count: number;
  caller_phone?: string;
  caller_name?: string;
  patient_age?: number;
  patient_gender?: string;
  symptoms?: string;
  status: EmergencyStatus;
  created_at: string;
  updated_at: string;
  requirements: EmergencyRequirement[];
}

export interface ScoreBreakdown {
  capability_score: number;
  eta_score: number;
  capacity_score: number;
  specialist_score: number;
  freshness_score: number;
  final_score: number;
  weights_applied: Record<string, number>;
  explanations: string[];
}

export interface Match {
  id: string;
  hospital_id: string;
  hospital_name: string;
  score: number;
  distance_km: number;
  eta_minutes: number;
  eligibility: boolean;
  rejection_reason?: string | null;
  score_breakdown?: ScoreBreakdown;
  rank: number;
}

export interface Referral {
  id: string;
  emergency_id: string;
  hospital_id: string;
  hospital_name?: string;
  hospital_phone?: string;
  hospital_address?: string;
  hospital_latitude?: number;
  hospital_longitude?: number;
  status: 'REQUESTED' | 'ACCEPTED' | 'REJECTED' | 'TIMEOUT' | 'CANCELLED' | 'REROUTED' | 'COMPLETED';
  requested_at: string;
  accepted_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
  reservation_expiry?: string;
  eta_minutes: number;
  notes?: string;
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface GovernorStatistics {
  total_emergencies: number;
  active_emergencies: number;
  total_hospitals: number;
  hospitals_accepting: number;
  total_beds: number;
  available_beds: number;
  referrals_accepted: number;
  referrals_rejected: number;
  reroutes_count: number;
  average_matching_time_ms: number;
  stale_hospitals_count: number;
}

export interface DemoStep {
  step_number: number;
  title: string;
  status: string;
  timestamp: string;
  details: Record<string, any>;
}

export interface OneClickDemoResult {
  scenario_name: string;
  emergency_id: string;
  incident_reference: string;
  severity: string;
  first_hospital_attempted: {
    id: string;
    name: string;
    score: number;
    eta_minutes: number;
  };
  first_rejection_reason: string;
  second_hospital_attempted: {
    id: string;
    name: string;
    score: number;
    eta_minutes: number;
  };
  second_accepted: boolean;
  referral_id: string;
  bed_reserved: boolean;
  eta_minutes: number;
  distance_km: number;
  timeline: DemoStep[];
}
