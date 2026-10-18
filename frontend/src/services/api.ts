import type {
  Hospital,
  Emergency,
  Referral,
  Match,
  GovernorStatistics,
  AuditEvent,
  OneClickDemoResult,
  AppNotification,
  UserRole,
  AuthUser
} from '../types';

const rawBase = import.meta.env.VITE_API_BASE_URL || '/api';
const API_BASE = rawBase.endsWith('/api') ? rawBase : `${rawBase.replace(/\/$/, '')}/api`;

const AUTH_KEY = 'ersync.auth.v1';

export class ApiService {
  private static currentRole: UserRole = 'ADMIN';
  private static currentHospitalId: string = 'hosp_lagos_central';
  private static token: string | null = null;

  /** Called when the server rejects our token (expired / invalid) so the app can return to the login screen. */
  static unauthorizedHandler: (() => void) | null = null;

  // ── Authentication ──
  static isAuthenticated() { return !!this.token; }

  /** Restores a saved session (localStorage = "keep me signed in", sessionStorage = this tab only). */
  static loadSession(): { token: string; user: AuthUser } | null {
    for (const store of [localStorage, sessionStorage]) {
      try {
        const raw = store.getItem(AUTH_KEY);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed?.token && parsed?.user) { this.token = parsed.token; return parsed; }
      } catch { /* unavailable or corrupt */ }
    }
    return null;
  }

  static async login(username: string, password: string, remember = true): Promise<AuthUser> {
    const res = await fetch(`${API_BASE}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password })
    });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json())?.detail; } catch { /* not json */ }
      throw new Error(res.status === 401 ? 'Incorrect username or password.' : (typeof detail === 'string' && detail) || `Sign-in failed (HTTP ${res.status})`);
    }
    const data = await res.json();
    this.token = data.access_token;
    this.currentRole = data.user.role;
    if (data.user.hospital_id) this.currentHospitalId = data.user.hospital_id;
    const payload = JSON.stringify({ token: data.access_token, user: data.user });
    try {
      localStorage.removeItem(AUTH_KEY); sessionStorage.removeItem(AUTH_KEY);
      (remember ? localStorage : sessionStorage).setItem(AUTH_KEY, payload);
    } catch { /* storage unavailable: session lives in memory only */ }
    return data.user as AuthUser;
  }

  static logout() {
    this.token = null;
    try { localStorage.removeItem(AUTH_KEY); sessionStorage.removeItem(AUTH_KEY); } catch { /* ignore */ }
  }

  static async me(): Promise<AuthUser> {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: this.getHeaders() });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to load profile');
    return res.json();
  }

  static setRole(role: UserRole, hospitalId: string = 'hosp_lagos_central') {
    this.currentRole = role;
    this.currentHospitalId = hospitalId;
  }

  static getHeaders(): Record<string, string> {
    // A real login always wins: the server resolves role + hospital from the JWT.
    if (this.token) {
      return { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` };
    }
    return {
      'Content-Type': 'application/json',
      'X-Demo-Role': this.currentRole,
      'X-Demo-Hospital': this.currentHospitalId
    };
  }

  /** Builds an Error carrying the server's `detail` message (e.g. "No free emergency bed...") instead of a generic one. */
  private static async errorFrom(res: Response, fallback: string): Promise<Error> {
    try {
      const body = await res.json();
      const detail = typeof body?.detail === 'string' ? body.detail : null;
      if (detail) return new Error(detail);
    } catch { /* body wasn't JSON */ }
    return new Error(`${fallback} (HTTP ${res.status})`);
  }

  // Health
  static async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  }

  // Hospitals
  static async getHospitals(): Promise<Hospital[]> {
    const res = await fetch(`${API_BASE}/hospitals`, { headers: this.getHeaders() });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to fetch hospitals');
    return res.json();
  }

  static async getHospital(id: string): Promise<Hospital> {
    const res = await fetch(`${API_BASE}/hospitals/${id}`, { headers: this.getHeaders() });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to fetch hospital');
    return res.json();
  }

  static async updateHospitalStatus(id: string, emergency_status?: string, accepting_emergencies?: boolean) {
    const res = await fetch(`${API_BASE}/hospitals/${id}/status`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ emergency_status, accepting_emergencies })
    });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to update hospital status');
    return res.json();
  }

  static async updateHospitalCapacity(id: string, overall_capacity: number) {
    const res = await fetch(`${API_BASE}/hospitals/${id}/capacity`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ overall_capacity })
    });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to update capacity');
    return res.json();
  }

  static async updateHospitalBeds(id: string, total_beds: number, available_beds: number): Promise<Hospital> {
    const res = await fetch(`${API_BASE}/hospitals/${id}/beds`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ total_beds, available_beds })
    });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to update beds');
    return res.json();
  }

  static async updateSpecialist(id: string, specialty_name: string, available_count: number, status: string) {
    const res = await fetch(`${API_BASE}/hospitals/${id}/specialists`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ specialty_name, available_count, status })
    });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to update specialist');
    return res.json();
  }

  static async updateFacility(id: string, facility_name: string, available: boolean, status: string) {
    const res = await fetch(`${API_BASE}/hospitals/${id}/facilities`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ facility_name, available, status })
    });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to update facility');
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
    if (!res.ok) throw await this.errorFrom(res, 'Failed to create emergency');
    return res.json();
  }

  static async getEmergency(id: string): Promise<Emergency> {
    const res = await fetch(`${API_BASE}/emergencies/${id}`, { headers: this.getHeaders() });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to fetch emergency');
    return res.json();
  }

  static async matchEmergency(id: string) {
    const res = await fetch(`${API_BASE}/emergencies/${id}/match`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to match emergency');
    return res.json();
  }

  static async getMatches(id: string) {
    const res = await fetch(`${API_BASE}/emergencies/${id}/matches`, { headers: this.getHeaders() });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to fetch matches');
    return res.json();
  }

  static async redispatchEmergency(id: string) {
    const res = await fetch(`${API_BASE}/emergencies/${id}/dispatch`, { method: 'POST', headers: this.getHeaders() });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to re-dispatch emergency');
    return res.json();
  }

  static async markArrived(id: string) {
    const res = await fetch(`${API_BASE}/emergencies/${id}/arrived`, { method: 'POST', headers: this.getHeaders() });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to mark patient arrived');
    return res.json();
  }

  static async closeCase(id: string) {
    const res = await fetch(`${API_BASE}/emergencies/${id}/close`, { method: 'POST', headers: this.getHeaders() });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to close case');
    return res.json();
  }

  static async getNotifications(limit: number = 15): Promise<AppNotification[]> {
    const res = await fetch(`${API_BASE}/notifications?limit=${limit}`, { headers: this.getHeaders() });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to fetch notifications');
    return res.json();
  }

  static async markNotificationRead(id: string) {
    const res = await fetch(`${API_BASE}/notifications/${id}/read`, { method: 'POST', headers: this.getHeaders() });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to mark notification as read');
    return res.json();
  }

  // Referrals
  static async getReferrals(statusFilter?: string, hospitalId?: string): Promise<Referral[]> {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status_filter', statusFilter);
    if (hospitalId) params.set('hospital_id', hospitalId);
    const qs = params.toString();
    const url = qs ? `${API_BASE}/referrals?${qs}` : `${API_BASE}/referrals`;
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to fetch referrals');
    return res.json();
  }

  static async getReferral(id: string): Promise<Referral> {
    const res = await fetch(`${API_BASE}/referrals/${id}`, { headers: this.getHeaders() });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to fetch referral');
    return res.json();
  }

  static async acceptReferral(id: string, notes?: string) {
    const res = await fetch(`${API_BASE}/referrals/${id}/accept`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ notes })
    });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to accept referral');
    return res.json();
  }

  static async rejectReferral(id: string, reason: string, notes?: string) {
    const res = await fetch(`${API_BASE}/referrals/${id}/reject`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ reason, notes })
    });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to reject referral');
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
    if (!res.ok) throw await this.errorFrom(res, 'Failed to reroute referral');
    return res.json();
  }

  // Governor Command
  static async getActiveEmergencies() {
    const res = await fetch(`${API_BASE}/governor/active`, { headers: this.getHeaders() });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to fetch active emergencies');
    return res.json();
  }

  static async getStatistics(): Promise<GovernorStatistics> {
    const res = await fetch(`${API_BASE}/governor/statistics`, { headers: this.getHeaders() });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to fetch statistics');
    return res.json();
  }

  static async getTimeline(): Promise<{ events: AuditEvent[] }> {
    const res = await fetch(`${API_BASE}/governor/timeline`, { headers: this.getHeaders() });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to fetch timeline');
    return res.json();
  }

  static async getExplanations(emergencyId: string) {
    const res = await fetch(`${API_BASE}/governor/explanations/${emergencyId}`, { headers: this.getHeaders() });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to fetch explanations');
    return res.json();
  }

  // Simulation & Demo
  static async runOneClickDemo(): Promise<OneClickDemoResult> {
    const res = await fetch(`${API_BASE}/demo/scenario/mass-casualty`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to run demo scenario');
    return res.json();
  }

  static async resetSimulation() {
    const res = await fetch(`${API_BASE}/simulation/reset`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to reset simulation');
    return res.json();
  }

  static async makeHospitalStale(hospitalId: string, minutesAgo: number = 45) {
    const res = await fetch(`${API_BASE}/simulation/stale/${hospitalId}?minutes_ago=${minutesAgo}`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    if (!res.ok) throw await this.errorFrom(res, 'Failed to make hospital stale');
    return res.json();
  }
}
