import {
  Siren, Radar, Map as MapIcon, Building2, Inbox, BarChart3, ScrollText, Bell, FlaskConical,
  ShieldCheck, Stethoscope, Headset,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UserRole } from '../types';

export type TabId =
  | 'command' | 'intake' | 'hospital' | 'referrals' | 'network'
  | 'analytics' | 'notifications' | 'audit' | 'demo';

export interface NavItem {
  id: TabId;
  label: string;
  short: string;
  title: string;
  description: string;
  icon: LucideIcon;
  group: string;
  roles: UserRole[];
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'intake', label: 'Report Emergency', short: 'Report', title: 'Report an emergency', description: 'Describe the incident and ER-Sync finds the right hospital in seconds.', icon: Siren, group: 'Respond', roles: ['ADMIN', 'PATIENT'] },
  { id: 'command', label: 'Command Center', short: 'Command', title: 'Command Center', description: 'Live view of every active case, referral and bed reservation.', icon: Radar, group: 'Respond', roles: ['ADMIN', 'HOSPITAL_STAFF', 'PATIENT'] },
  { id: 'network', label: 'Facility Map', short: 'Map', title: 'Facility Map', description: 'Every registered hospital, its status and live capacity.', icon: MapIcon, group: 'Respond', roles: ['ADMIN', 'HOSPITAL_STAFF', 'PATIENT'] },
  { id: 'hospital', label: 'Hospital Desk', short: 'Desk', title: 'Hospital Desk', description: 'Control intake, beds, specialists and equipment for a facility.', icon: Building2, group: 'Facility', roles: ['ADMIN', 'HOSPITAL_STAFF'] },
  { id: 'referrals', label: 'Referrals', short: 'Referrals', title: 'Referrals', description: 'Incoming patient requests and the full referral history.', icon: Inbox, group: 'Facility', roles: ['ADMIN', 'HOSPITAL_STAFF'] },
  { id: 'analytics', label: 'Analytics', short: 'Insights', title: 'Analytics', description: 'Network performance, acceptance rates and dispatch speed.', icon: BarChart3, group: 'Insight', roles: ['ADMIN'] },
  { id: 'audit', label: 'Audit Trail', short: 'Audit', title: 'Audit Trail', description: 'Every decision the system and its operators have made.', icon: ScrollText, group: 'Insight', roles: ['ADMIN'] },
  { id: 'notifications', label: 'Alerts', short: 'Alerts', title: 'Alerts', description: 'Dispatch, referral and system notifications for your workspace.', icon: Bell, group: 'Insight', roles: ['ADMIN', 'HOSPITAL_STAFF', 'PATIENT'] },
  { id: 'demo', label: 'Failover Lab', short: 'Lab', title: 'Failover Lab', description: 'Run a full end-to-end failover scenario and inspect each step.', icon: FlaskConical, group: 'Lab', roles: ['ADMIN'] },
];

export const navFor = (role: UserRole) => NAV_ITEMS.filter((n) => n.roles.includes(role));
export const canAccess = (role: UserRole, tab: TabId) => navFor(role).some((n) => n.id === tab);
export const defaultTab = (role: UserRole): TabId =>
  role === 'HOSPITAL_STAFF' ? 'hospital' : role === 'PATIENT' ? 'intake' : 'command';

export interface RoleMeta {
  label: string;
  short: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  tone: 'signal' | 'info' | 'alert';
}

export const ROLE_META: Record<UserRole, RoleMeta> = {
  ADMIN: {
    label: 'State EOC',
    short: 'Admin',
    tagline: 'Emergency Operations Centre',
    description: 'Full network visibility: command center, analytics, audit trail and simulation tools.',
    icon: ShieldCheck,
    tone: 'info',
  },
  HOSPITAL_STAFF: {
    label: 'Hospital Staff',
    short: 'Hospital',
    tagline: 'Facility workspace',
    description: 'Run one hospital: respond to referrals and keep beds, specialists and equipment accurate.',
    icon: Stethoscope,
    tone: 'signal',
  },
  PATIENT: {
    label: 'Dispatcher',
    short: 'Dispatcher',
    tagline: 'Field & public reporting',
    description: 'Report an incident and follow it through to a confirmed hospital bed.',
    icon: Headset,
    tone: 'alert',
  },
};

export interface Workspace {
  role: UserRole;
  hospitalId: string;
}

const KEY = 'ersync.workspace.v1';

export function readWorkspace(): Workspace | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && ['ADMIN', 'HOSPITAL_STAFF', 'PATIENT'].includes(parsed.role)) {
      return { role: parsed.role, hospitalId: parsed.hospitalId || 'hosp_lagos_central' };
    }
  } catch { /* storage unavailable */ }
  return null;
}

export function saveWorkspace(ws: Workspace) {
  try { localStorage.setItem(KEY, JSON.stringify(ws)); } catch { /* ignore */ }
}
