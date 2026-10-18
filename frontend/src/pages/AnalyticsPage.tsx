import React, { useEffect, useState } from 'react';
import { ApiService } from '../services/api';
import type { GovernorStatistics } from '../types';
import { Alert, Button, Card, CardHeader, PageHeader, ProgressBar, StatCard } from '../ui/primitives';
import { Activity, BarChart3, Bed, Building2, CheckCircle2, Clock, RefreshCw, ShieldCheck, Sliders, TrendingUp, TriangleAlert } from 'lucide-react';

const EMPTY: GovernorStatistics = {
  total_emergencies: 0, active_emergencies: 0, total_hospitals: 0, hospitals_accepting: 0, total_beds: 0, available_beds: 0,
  referrals_accepted: 0, referrals_rejected: 0, referrals_timed_out: 0, reroutes_count: 0, average_matching_time_ms: 0, stale_hospitals_count: 0,
};

const WEIGHTS = [
  { label: 'Medical capability', value: 40, hint: 'Specialists and facilities the case needs', color: '#10A98B' },
  { label: 'Travel time', value: 30, hint: 'Road ETA with Lagos traffic factor', color: '#3D7BF0' },
  { label: 'Bed headroom', value: 15, hint: 'Free emergency beds and overall load', color: '#6D4AE0' },
  { label: 'Specialist cover', value: 10, hint: 'Share of specialties currently on duty', color: '#E5A00D' },
  { label: 'Data freshness', value: 5, hint: 'How recently the hospital reported', color: '#8393AB' },
];

const Donut: React.FC<{ segments: Array<{ value: number; color: string }>; size?: number; children?: React.ReactNode }> = ({ segments, size = 168, children }) => {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = 64; const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 160 160" className="-rotate-90" width={size} height={size}>
        <circle cx="80" cy="80" r={r} fill="none" stroke="#EFF3F8" strokeWidth="18" />
        {total > 0 && segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = <circle key={i} cx="80" cy="80" r={r} fill="none" stroke={s.color} strokeWidth="18" strokeDasharray={`${Math.max(len - 3, 0)} ${c}`} strokeDashoffset={-offset} strokeLinecap="round" style={{ transition: 'all .6s' }} />;
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
};

export const AnalyticsPage: React.FC = () => {
  const [stats, setStats] = useState<GovernorStatistics>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState('—');

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const data = await ApiService.getStatistics();
      if (data && typeof data === 'object') {
        setLoadError(null); setStats(data);
        setLastRefreshed(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch { setLoadError('Cannot reach the ER-Sync backend, so these figures are not live.'); }
    finally { setIsLoading(false); setLoaded(true); }
  };

  useEffect(() => {
    fetchStats();
    const t = setInterval(fetchStats, 10000);
    return () => clearInterval(t);
  }, []);

  const totalReferrals = (stats.referrals_accepted || 0) + (stats.referrals_rejected || 0) + (stats.referrals_timed_out || 0);
  const acceptance = totalReferrals > 0 ? Math.round((stats.referrals_accepted / totalReferrals) * 100) : null;
  const utilisation = stats.total_beds > 0 ? Math.round(((stats.total_beds - stats.available_beds) / stats.total_beds) * 100) : 0;
  const pct = (n: number) => (stats.total_emergencies > 0 ? (n / stats.total_emergencies) * 100 : 0);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BarChart3}
        tone="plum"
        eyebrow="Network performance"
        title="Analytics"
        description="Dispatch speed, referral outcomes and capacity across every registered facility."
        actions={<>
          <span className="hidden text-[12px] font-semibold text-ink-400 sm:inline">Updated {lastRefreshed}</span>
          <Button data-desktop-only variant="secondary" icon={RefreshCw} loading={isLoading && loaded} onClick={fetchStats}>Refresh</Button>
        </>}
      />

      {loadError && <Alert tone="warn" icon={TriangleAlert}>{loadError}</Alert>}

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <StatCard label="Referral acceptance" icon={ShieldCheck} tone="signal" loading={!loaded} value={acceptance === null ? '—' : `${acceptance}%`}
          hint={<span className="inline-flex items-center gap-1.5"><TrendingUp className="size-3.5 text-signal-600" />{stats.referrals_accepted} accepted · {stats.referrals_rejected} declined</span>} />
        <StatCard label="Dispatch latency" icon={Clock} tone="info" loading={!loaded} value={stats.average_matching_time_ms > 0 ? <>{Math.round(stats.average_matching_time_ms)}<span className="text-[16px] font-bold text-ink-300"> ms</span></> : '—'} hint="Average Governor matching time" />
        <StatCard label="Bed utilisation" icon={Bed} tone="plum" loading={!loaded} value={`${utilisation}%`} hint={`${stats.available_beds} of ${stats.total_beds} beds free`} />
        <StatCard label="Unanswered referrals" icon={CheckCircle2} tone="warn" loading={!loaded} value={stats.referrals_timed_out} hint="Timed out and auto re-routed" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader icon={Activity} tone="signal" title="Referral outcomes" subtitle={`${totalReferrals} referral decision(s) recorded`} />
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
            <Donut segments={[{ value: stats.referrals_accepted, color: '#10A98B' }, { value: stats.referrals_rejected, color: '#F04B39' }, { value: stats.referrals_timed_out, color: '#E5A00D' }]}>
              <span className="text-[32px] font-extrabold leading-none text-ink-900 tabnum">{acceptance === null ? '—' : `${acceptance}%`}</span>
              <span className="mt-1 text-[11px] font-bold uppercase tracking-wider text-ink-400">Accepted</span>
            </Donut>
            <div className="w-full flex-1 space-y-3.5">
              {[
                { label: 'Accepted', v: stats.referrals_accepted, c: 'bg-signal-500' },
                { label: 'Declined', v: stats.referrals_rejected, c: 'bg-alert-500' },
                { label: 'Timed out', v: stats.referrals_timed_out, c: 'bg-warn-500' },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between text-[13px]">
                  <span className="inline-flex items-center gap-2.5 font-semibold text-ink-600"><span className={`size-2.5 rounded-full ${r.c}`} />{r.label}</span>
                  <span className="font-extrabold text-ink-900 tabnum">{r.v}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader icon={Activity} tone="info" title="Case pipeline" subtitle={`${stats.total_emergencies} emergencies ingested`} />
          <div className="space-y-5">
            {[
              { label: 'Triage evaluations', v: stats.total_emergencies, p: stats.total_emergencies > 0 ? 100 : 0, tone: 'info' as const },
              { label: 'Successful admissions', v: stats.referrals_accepted, p: pct(stats.referrals_accepted), tone: 'signal' as const },
              { label: 'Auto-failover re-routes', v: stats.reroutes_count, p: pct(stats.reroutes_count), tone: 'warn' as const },
            ].map((r) => (
              <div key={r.label}>
                <div className="mb-2 flex items-center justify-between text-[13px]">
                  <span className="font-semibold text-ink-600">{r.label}</span>
                  <span className="font-extrabold text-ink-900 tabnum">{r.v}</span>
                </div>
                <ProgressBar value={r.p} tone={r.tone} height={10} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader icon={Sliders} tone="plum" title="How ER-Sync decides" subtitle="Deterministic weighting — identical inputs always give identical rankings" />
        <div className="mb-5 flex h-3.5 w-full overflow-hidden rounded-full">
          {WEIGHTS.map((w) => <div key={w.label} style={{ width: `${w.value}%`, background: w.color }} title={`${w.label} ${w.value}%`} />)}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {WEIGHTS.map((w) => (
            <div key={w.label} className="rounded-2xl border border-ink-100 bg-ink-25 p-4">
              <div className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: w.color }} /><span className="text-[12px] font-bold text-ink-600">{w.label}</span></div>
              <p className="mt-2 text-[28px] font-extrabold leading-none text-ink-900 tabnum">{w.value}%</p>
              <p className="mt-2 text-[11.5px] font-medium leading-relaxed text-ink-500">{w.hint}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-ink-50 text-ink-600"><Building2 className="size-5" /></span>
          <div>
            <p className="text-[14px] font-bold text-ink-900">Network coverage</p>
            <p className="text-[12.5px] font-medium text-ink-500">{stats.total_hospitals} registered facilities · {stats.hospitals_accepting} currently receiving patients</p>
          </div>
        </div>
        <div className="flex gap-6 text-[13px] font-semibold">
          <div><span className="text-ink-400">Active cases </span><span className="font-extrabold text-info-600 tabnum">{stats.active_emergencies}</span></div>
          <div><span className="text-ink-400">Stale telemetry </span><span className={stats.stale_hospitals_count > 0 ? 'font-extrabold text-warn-700' : 'font-extrabold text-signal-600'}>{stats.stale_hospitals_count === 0 ? 'None' : `${stats.stale_hospitals_count} alert`}</span></div>
        </div>
      </Card>
    </div>
  );
};
