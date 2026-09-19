import type {
  Hospital,
  Emergency,
  Referral,
  Match,
  GovernorStatistics,
  AuditEvent,
  OneClickDemoResult,
  UserRole
} from '../types';

const API_BASE = '/api';

export class ApiService {
  private static currentRole: UserRole = 'ADMIN';
  private static currentHospitalId: string = 'hosp_lagos_central';

  static setRole(role: UserRole, hospitalId: string = 'hosp_lagos_central') {
    this.currentRole = role;
    this.currentHospitalId = hospitalId;
  }

  static getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Demo-Role': this.currentRole,
      'X-Demo-Hospital': this.currentHospitalId
    };
  }

  // Health
  static async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  }

  // Hospitals
  static async getHospitals(): Promise<Hospital[]> {
    const res = await fetch(`${API_BASE}/hospitals`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch hospitals');
    return res.json();
  }

  static async getHospital(id: string): Promise<Hospital> {
    const res = await fetch(`${API_BASE}/hospitals/${id}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch hospital');
    return res.json();
  }

  static async updateHospitalStatus(id: string, emergency_status?: string, accepting_emergencies?: boolean) {
    const res = await fetch(`${API_BASE}/hospitals/${id}/status`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ emergency_status, accepting_emergencies })
    });
    if (!res.ok) throw new Error('Failed to update hospital status');
    return res.json();
  }

  static async updateHospitalCapacity(id: string, overall_capacity: number) {
    const res = await fetch(`${API_BASE}/hospitals/${id}/capacity`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ overall_capacity })
    });
    if (!res.ok) throw new Error('Failed to update capacity');
    return res.json();
  }

  static async updateSpecialist(id: string, specialty_name: string, available_count: number, status: string) {
    const res = await fetch(`${API_BASE}/hospitals/${id}/specialists`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ specialty_name, available_count, status })
    });
    if (!res.ok) throw new Error('Failed to update specialist');
    return res.json();
  }

  static async updateFacility(id: string, facility_name: string, available: boolean, status: string) {
    const res = await fetch(`${API_BASE}/hospitals/${id}/facilities`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ facility_name, available, status })
    });
    if (!res.ok) throw new Error('Failed to update facility');
    return res.json();
  }

  // Emergencies
  static async createEmergency(payload: {
    latitude: number;
    longitude: number;
    location_name?: string;
    description: string;
    category?: string;
    patient_count?: number;
    caller_phone?: string;
    caller_name?: string;
    patient_age?: number;
    patient_gender?: string;
    symptoms?: string;
  }): Promise<Emergency> {
    const res = await fetch(`${API_BASE}/emergencies`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to create emergency');
    return res.json();
  }

  static async getEmergency(id: string): Promise<Emergency> {
    const res = await fetch(`${API_BASE}/emergencies/${id}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch emergency');
    return res.json();
  }

  static async matchEmergency(id: string) {
    const res = await fetch(`${API_BASE}/emergencies/${id}/match`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to match emergency');
    return res.json();
  }

  static async getMatches(id: string) {
    const res = await fetch(`${API_BASE}/emergencies/${id}/matches`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch matches');
    return res.json();
  }

  // Referrals
  static async getReferrals(statusFilter?: string): Promise<Referral[]> {
    const url = statusFilter ? `${API_BASE}/referrals?status_filter=${statusFilter}` : `${API_BASE}/referrals`;
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch referrals');
    return res.json();
  }

  static async getReferral(id: string): Promise<Referral> {
    const res = await fetch(`${API_BASE}/referrals/${id}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch referral');
    return res.json();
  }

  static async acceptReferral(id: string, notes?: string) {
    const res = await fetch(`${API_BASE}/referrals/${id}/accept`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ notes })
    });
    if (!res.ok) throw new Error('Failed to accept referral');
    return res.json();
  }

  static async rejectReferral(id: string, reason: string, notes?: string) {
    const res = await fetch(`${API_BASE}/referrals/${id}/reject`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ reason, notes })
    });
    if (!res.ok) throw new Error('Failed to reject referral');
    return res.json();
  }

  static async respondToReferral(id: string, action: 'accept' | 'reject', reason?: string) {
    if (action === 'accept') {
      return this.acceptReferral(id);
    } else {
      return this.rejectReferral(id, reason || 'Emergency Department Surge');
    }
  }

  static async rerouteReferral(id: string, reason: string) {
    const res = await fetch(`${API_BASE}/referrals/${id}/reroute`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ reason })
    });
    if (!res.ok) throw new Error('Failed to reroute referral');
    return res.json();
  }

  // Governor Command
  static async getActiveEmergencies() {
    const res = await fetch(`${API_BASE}/governor/active`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch active emergencies');
    return res.json();
  }

  static async getStatistics(): Promise<GovernorStatistics> {
    const res = await fetch(`${API_BASE}/governor/statistics`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch statistics');
    return res.json();
  }

  static async getTimeline(): Promise<{ events: AuditEvent[] }> {
    const res = await fetch(`${API_BASE}/governor/timeline`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch timeline');
    return res.json();
  }

  static async getExplanations(emergencyId: string) {
    const res = await fetch(`${API_BASE}/governor/explanations/${emergencyId}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch explanations');
    return res.json();
  }

  // Simulation & Demo
  static async runOneClickDemo(): Promise<OneClickDemoResult> {
    const res = await fetch(`${API_BASE}/demo/scenario/mass-casualty`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to run demo scenario');
    return res.json();
  }

  static async resetSimulation() {
    const res = await fetch(`${API_BASE}/simulation/reset`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to reset simulation');
    return res.json();
  }

  static async makeHospitalStale(hospitalId: string, minutesAgo: number = 45) {
    const res = await fetch(`${API_BASE}/simulation/stale/${hospitalId}?minutes_ago=${minutesAgo}`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to make hospital stale');
    return res.json();
  }
}
