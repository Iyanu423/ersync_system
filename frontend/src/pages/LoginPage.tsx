import React, { useRef, useState } from 'react';
import clsx from 'clsx';
import { ArrowRight, Eye, EyeOff, Lock, TriangleAlert, User as UserIcon, Zap, ShieldCheck, Building2, Radar } from 'lucide-react';
import { ApiService } from '../services/api';
import type { AuthUser } from '../types';
import { ROLE_META } from '../config/workspace';
import { BrandMark } from '../components/Sidebar';
import { Button, Field } from '../ui/primitives';

const DEMO_ACCOUNTS = [
  { role: 'ADMIN' as const, username: 'admin', password: 'admin123', who: 'Dr. Olanrewaju Adeleke', note: 'State Emergency Director' },
  { role: 'HOSPITAL_STAFF' as const, username: 'staff', password: 'staff123', who: 'Nurse Chioma Okoro', note: 'Lagos Central Triage Lead' },
  { role: 'PATIENT' as const, username: 'patient', password: 'patient123', who: 'Babatunde Fashola', note: 'Paramedic / First Responder' },
];

export const LoginPage: React.FC<{ onLoggedIn: (user: AuthUser) => void }> = ({ onLoggedIn }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const passRef = useRef<HTMLInputElement>(null);

  const submit = async (e?: React.FormEvent, creds?: { u: string; p: string }) => {
    e?.preventDefault();
    const u = creds?.u ?? username;
    const p = creds?.p ?? password;
    if (!u.trim() || !p) {
      setError('Enter your username and password.');
      setShake((n) => n + 1);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = await ApiService.login(u, p, remember);
      onLoggedIn(user);
    } catch (err: any) {
      const offline = err instanceof TypeError;
      setError(offline ? "Can't reach the ER-Sync server. Check that the backend is running." : err?.message || 'Sign-in failed.');
      setShake((n) => n + 1);
      setBusy(false);
    }
  };

  const fill = (a: typeof DEMO_ACCOUNTS[0]) => {
    setUsername(a.username);
    setPassword(a.password);
    setError(null);
    passRef.current?.focus();
  };

  return (
    <div className="flex min-h-dvh overflow-x-hidden bg-canvas">
      {/* Brand panel */}
      <aside className="side-pattern relative hidden w-[46%] max-w-[640px] flex-col justify-between overflow-hidden bg-ink-950 p-12 text-white lg:flex">
        <svg className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 opacity-[.13]" viewBox="0 0 600 120" fill="none" preserveAspectRatio="none" height="120">
          <path d="M0 60h120l20-40 30 80 25-60 20 20h90l25-50 30 90 20-40h120" stroke="#56D9BC" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="400" style={{ animation: 'ecg-run 4s linear infinite' }} />
        </svg>
        <div className="relative flex items-center gap-3">
          <BrandMark size={46} />
          <div className="leading-tight"><p className="text-[22px] font-extrabold tracking-tight">ER-Sync</p><p className="text-[12.5px] font-medium text-ink-300/80">Emergency Coordination Network</p></div>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-[42px] font-extrabold leading-[1.08] tracking-tight">The right hospital, found in seconds.</h1>
          <p className="mt-4 text-[15px] font-medium leading-relaxed text-ink-300">Real-time triage, bed-aware matching and automatic failover — so no patient waits while a hospital says no.</p>
          <ul className="mt-8 space-y-3.5 text-[14px] font-semibold text-ink-100">
            {[[Zap, 'Sub-second, explainable hospital matching'], [Building2, 'Live beds, specialists and equipment'], [Radar, 'Every case tracked from call to bed']].map(([Icon, t]: any) => (
              <li key={t} className="flex items-center gap-3"><span className="inline-flex size-8 items-center justify-center rounded-xl bg-signal-400/15 text-signal-300"><Icon className="size-4" /></span>{t}</li>
            ))}
          </ul>
        </div>
        <p className="relative text-[12px] font-medium text-ink-400">© ER-Sync · Demo environment, data is simulated</p>
      </aside>

      {/* Form */}
      <main className="pt-safe pb-safe flex min-w-0 flex-1 flex-col">
        <div className="side-pattern relative bg-ink-950 px-6 pb-14 pt-10 text-white lg:hidden">
          <div className="flex items-center gap-3"><BrandMark size={42} /><div className="leading-tight"><p className="text-[20px] font-extrabold">ER-Sync</p><p className="text-[12px] font-medium text-ink-300/80">Emergency Coordination Network</p></div></div>
        </div>

        <div className="mx-auto flex w-full min-w-0 max-w-[460px] flex-1 flex-col justify-center px-4 py-6 sm:px-5 lg:py-12">
          <div className="-mt-12 lg:mt-0">
            <div className="animate-rise card p-6 shadow-[var(--shadow-lift)] sm:p-8">
              <h2 className="text-[26px] font-extrabold tracking-tight text-ink-900">Sign in</h2>
              <p className="mt-1 text-[13.5px] font-medium text-ink-500">Use your ER-Sync account to open your workspace.</p>

              <form key={shake} onSubmit={submit} noValidate className={clsx('mt-6 space-y-4', shake > 0 && error && '[animation:shake_.4s]')}>
                <Field label="Username">
                  <div className="relative">
                    <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-300" />
                    <input className={clsx('input !pl-10', error && 'input-error')} autoComplete="username" autoCapitalize="none" autoCorrect="off" value={username} onChange={(e) => { setUsername(e.target.value); setError(null); }} placeholder="e.g. admin" autoFocus />
                  </div>
                </Field>
                <Field label="Password">
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-300" />
                    <input ref={passRef} type={show ? 'text' : 'password'} className={clsx('input !pl-10 !pr-11', error && 'input-error')} autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }} placeholder="••••••••" />
                    <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-400 transition hover:bg-ink-50 hover:text-ink-800">
                      {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </Field>

                <label className="flex cursor-pointer select-none items-center gap-2.5 text-[13px] font-semibold text-ink-600">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-[var(--color-signal-600)]" />
                  Keep me signed in on this device
                </label>

                {error && (
                  <div role="alert" className="animate-pop-in flex items-start gap-2.5 rounded-xl border border-alert-100 bg-alert-50 p-3 text-[13px] font-semibold text-alert-800">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />{error}
                  </div>
                )}

                <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
                  {busy ? 'Signing in…' : <>Sign in <ArrowRight className="size-4" /></>}
                </Button>
              </form>
            </div>

            {/* Demo accounts */}
            <div className="mt-6">
              <p className="eyebrow mb-2.5 flex items-center gap-2"><ShieldCheck className="size-3.5" />Demo accounts · tap to fill</p>
              <div className="space-y-2">
                {DEMO_ACCOUNTS.map((a) => {
                  const m = ROLE_META[a.role];
                  return (
                    <button key={a.username} type="button" onClick={() => fill(a)} disabled={busy}
                      className={clsx('flex w-full items-center gap-3.5 rounded-2xl border bg-white p-3 text-left transition active:scale-[.99] hover:border-ink-300', username === a.username && password === a.password ? 'border-signal-300 ring-4 ring-signal-100' : 'border-ink-100')}>
                      <span className={clsx('inline-flex size-10 shrink-0 items-center justify-center rounded-xl', m.tone === 'signal' ? 'bg-signal-50 text-signal-700' : m.tone === 'alert' ? 'bg-alert-50 text-alert-600' : 'bg-info-50 text-info-600')}><m.icon className="size-5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-bold text-ink-900">{m.label}</span>
                        <span className="block truncate text-[12px] font-medium text-ink-500">{a.who} · {a.note}</span>
                      </span>
                      <span className="hidden shrink-0 text-right text-[11px] font-semibold leading-tight text-ink-400 min-[430px]:block"><span className="block text-ink-700">{a.username}</span><span className="block">{a.password}</span></span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
