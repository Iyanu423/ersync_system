import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { ArrowRight, Check, X } from 'lucide-react';
import type { Hospital, UserRole } from '../types';
import { ROLE_META, type Workspace } from '../config/workspace';
import { cleanName } from '../utils/format';
import { BrandMark } from './Sidebar';
import { Button } from '../ui/primitives';

interface Props {
  open: boolean;
  /** true on first launch: cannot be dismissed until a workspace is chosen */
  required: boolean;
  current: Workspace | null;
  hospitals: Hospital[];
  onSelect: (ws: Workspace) => void;
  onClose: () => void;
}

const ROLES: UserRole[] = ['ADMIN', 'HOSPITAL_STAFF', 'PATIENT'];

export const WorkspaceGate: React.FC<Props> = ({ open, required, current, hospitals, onSelect, onClose }) => {
  const [role, setRole] = useState<UserRole>(current?.role ?? 'ADMIN');
  const [hospitalId, setHospitalId] = useState<string>(current?.hospitalId ?? 'hosp_lagos_central');

  useEffect(() => {
    if (!open) return;
    setRole(current?.role ?? 'ADMIN');
    setHospitalId(current?.hospitalId ?? 'hosp_lagos_central');
  }, [open, current]);

  useEffect(() => {
    if (open && hospitals.length && !hospitals.some((h) => h.id === hospitalId)) setHospitalId(hospitals[0].id);
  }, [open, hospitals, hospitalId]);

  if (!open) return null;

  const tones = {
    signal: { ring: 'ring-signal-400 border-signal-300 bg-signal-50/60', icon: 'bg-signal-100 text-signal-700' },
    info: { ring: 'ring-info-500 border-info-200 bg-info-50/60', icon: 'bg-info-100 text-info-600' },
    alert: { ring: 'ring-alert-400 border-alert-200 bg-alert-50/60', icon: 'bg-alert-100 text-alert-600' },
  } as const;

  return (
    <div className="fixed inset-0 z-[90] flex flex-col overflow-y-auto bg-ink-950 side-pattern">
      <div className="pt-safe mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3 text-white">
            <BrandMark size={44} />
            <div className="leading-tight">
              <p className="text-[20px] font-extrabold tracking-tight">ER-Sync</p>
              <p className="text-[12px] font-medium text-ink-300/80">Emergency Coordination Network</p>
            </div>
          </div>
          {!required && (
            <button onClick={onClose} aria-label="Close" className="inline-flex size-10 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20">
              <X className="size-5" />
            </button>
          )}
        </div>

        <div className="animate-rise mb-8 max-w-2xl">
          <h1 className="text-[32px] font-extrabold leading-[1.1] tracking-tight text-white sm:text-[44px]">
            {required ? 'Choose your workspace' : 'Switch workspace'}
          </h1>
          <p className="mt-3 text-[15px] font-medium leading-relaxed text-ink-300">
            ER-Sync shows you only what your role needs. You can switch at any time from the sidebar.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {ROLES.map((r, idx) => {
            const m = ROLE_META[r];
            const selected = role === r;
            const t = tones[m.tone];
            return (
              <button
                key={r}
                onClick={() => setRole(r)}
                style={{ animationDelay: `${idx * 70}ms` }}
                className={clsx(
                  'animate-rise group relative flex flex-col rounded-3xl border bg-white p-5 text-left transition-all duration-200 sm:p-6',
                  selected ? clsx('ring-[3px] shadow-[var(--shadow-pop)]', t.ring) : 'border-white/10 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]',
                )}
              >
                <span className={clsx('mb-5 inline-flex size-12 items-center justify-center rounded-2xl', t.icon)}>
                  <m.icon className="size-6" strokeWidth={2} />
                </span>
                <span className="text-[18px] font-extrabold text-ink-900">{m.label}</span>
                <span className="mb-2 text-[12px] font-bold uppercase tracking-wider text-ink-400">{m.tagline}</span>
                <span className="text-[13.5px] font-medium leading-relaxed text-ink-500">{m.description}</span>
                <span className={clsx('absolute right-4 top-4 inline-flex size-7 items-center justify-center rounded-full transition', selected ? 'bg-ink-900 text-white' : 'bg-ink-50 text-transparent')}>
                  <Check className="size-4" strokeWidth={3} />
                </span>
              </button>
            );
          })}
        </div>

        {role === 'HOSPITAL_STAFF' && (
          <div className="animate-pop-in mt-5 rounded-3xl bg-white p-5 sm:p-6">
            <p className="text-[14px] font-extrabold text-ink-900">Which hospital do you work at?</p>
            <p className="mb-4 text-[12.5px] font-medium text-ink-400">You will manage this facility's intake, beds and referrals.</p>
            {hospitals.length === 0 ? (
              <p className="rounded-xl bg-warn-50 p-3 text-[13px] font-semibold text-warn-800">Could not load the hospital list. Check that the backend is running — you can still continue with the default facility.</p>
            ) : (
              <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
                {hospitals.map((h) => (
                  <button key={h.id} onClick={() => setHospitalId(h.id)} className={clsx('flex items-center gap-3 rounded-2xl border p-3 text-left transition', hospitalId === h.id ? 'border-signal-400 bg-signal-50 ring-2 ring-signal-200' : 'border-ink-100 hover:border-ink-200 hover:bg-ink-25')}>
                    <span className={clsx('inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2', hospitalId === h.id ? 'border-signal-600 bg-signal-600 text-white' : 'border-ink-200')}>
                      {hospitalId === h.id && <Check className="size-3" strokeWidth={3.5} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-bold text-ink-900">{cleanName(h.name)}</span>
                      <span className="block truncate text-[11.5px] font-medium text-ink-400">{h.address}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="pb-safe mt-8 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] font-medium text-ink-400">Demo environment · data is simulated</p>
          <Button variant="primary" size="lg" onClick={() => onSelect({ role, hospitalId })}>
            Enter {ROLE_META[role].label} workspace <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
