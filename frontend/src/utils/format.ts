import { parseUtc } from './time';

export const cleanName = (name?: string | null) =>
  (name || '').replace('SIMULATED HOSPITAL — ', '').replace('SIMULATED HOSPITAL - ', '');

export const titleCase = (value?: string | null) =>
  (value || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** "just now", "3 min ago", "2 h ago", "4 d ago" */
export function relTime(value?: string | number | Date | null): string {
  if (!value) return '—';
  const diff = Date.now() - parseUtc(value).getTime();
  const s = Math.max(0, Math.round(diff / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export const shortTime = (value?: string | number | Date | null) =>
  value ? parseUtc(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

export type Tone = 'neutral' | 'signal' | 'alert' | 'warn' | 'info' | 'plum' | 'dark';

export const severityTone = (s?: string): Tone =>
  s === 'CRITICAL' ? 'alert' : s === 'HIGH' ? 'warn' : s === 'MEDIUM' ? 'info' : 'neutral';

export const emergencyStatusTone = (s?: string): Tone => {
  switch (s) {
    case 'NO_MATCH':
    case 'REJECTED':
    case 'TIMEOUT':
      return 'alert';
    case 'AWAITING_ACCEPTANCE':
    case 'REROUTING':
    case 'MATCHING':
    case 'ANALYSING':
    case 'NEW':
      return 'warn';
    case 'ACCEPTED':
    case 'PATIENT_EN_ROUTE':
    case 'ARRIVED':
      return 'signal';
    default:
      return 'neutral';
  }
};

export const referralTone = (s?: string): Tone =>
  s === 'ACCEPTED' ? 'signal' : s === 'REJECTED' || s === 'TIMEOUT' ? 'alert' : s === 'REQUESTED' ? 'info' : s === 'REROUTED' ? 'warn' : 'neutral';

export const hospitalTone = (status?: string, accepting?: boolean): Tone =>
  status === 'CLOSED' || accepting === false ? 'alert' : status === 'LIMITED' ? 'warn' : 'signal';

/** Lifecycle position of a case for the progress tracker (0-based, -1 = problem state). */
export const LIFECYCLE = ['Reported', 'Triaged', 'Referral sent', 'Bed secured', 'En route', 'Arrived', 'Closed'];
export function lifecycleIndex(status?: string): number {
  switch (status) {
    case 'NEW': return 0;
    case 'ANALYSING':
    case 'MATCHING': return 1;
    case 'AWAITING_ACCEPTANCE':
    case 'REROUTING': return 2;
    case 'ACCEPTED': return 3;
    case 'PATIENT_EN_ROUTE': return 4;
    case 'ARRIVED': return 5;
    case 'CLOSED': return 6;
    default: return -1;
  }
}

/** "Nurse Chioma Okoro (Lagos Central Triage Lead)" → { name, title } */
export function parseFullName(full?: string | null) {
  const m = (full || '').match(/^(.*?)\s*\((.*)\)\s*$/);
  return { name: (m ? m[1] : full || '').trim() || 'User', title: (m ? m[2] : '').trim() };
}

export const initials = (name: string) =>
  name.replace(/^(Dr\.?|Nurse|Mr\.?|Mrs\.?|Ms\.?|Prof\.?)\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || 'U';
