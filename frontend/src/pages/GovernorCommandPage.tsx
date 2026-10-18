import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { ApiService } from '../services/api';
import type { Hospital, Emergency, Match, Referral, AuditEvent, GovernorStatistics, AppNotification, UserRole } from '../types';
import type { TabId } from '../config/workspace';
import { clockTime } from '../utils/time';
import { cleanName, emergencyStatusTone, lifecycleIndex, LIFECYCLE, relTime, severityTone, titleCase, referralTone } from '../utils/format';
import { MapComponent } from '../components/MapComponent';
import { useConfirm, useToast } from '../ui/UIProvider';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, IconTile, PageHeader, Skeleton, StatCard } from '../ui/primitives';
import {
  Activity, AlertTriangle, Bed, Bell, Building2, Car, Check, CheckCircle2, Clock, Flame, HeartPulse, LogIn, MapPin,
  Radar, RefreshCw, ScrollText, ShieldAlert, Siren, Sliders, Stethoscope, Trophy, Zap,
} from 'lucide-react';

interface Props {
  hospitals: Hospital[];
  onRefreshHospitals: () => void;
  activeEmergency: Emergency | null;
  onOpenExplain: (emergencyId: string) => void;
  onNavigate: (tab: TabId) => void;
  onEmergencyTriggered?: (emergency: Emergency) => void;
  currentRole?: UserRole;
}

const EMPTY_STATS: GovernorStatistics = {
  total_emergencies: 0, active_emergencies: 0, total_hospitals: 0, hospitals_accepting: 0, total_beds: 0, available_beds: 0,
  referrals_accepted: 0, referrals_rejected: 0, referrals_timed_out: 0, reroutes_count: 0, average_matching_time_ms: 0, stale_hospitals_count: 0,
};

const QUICK_PRESETS = [
  { title: 'Motorcycle trauma', location: 'Admiralty Way, Lekki', category: 'Road accident', lat: 6.4474, lng: 3.4731, description: 'High-speed motorcycle collision with severe head injury and active hemorrhage.', icon: Car, severity: 'Critical', patients: 1 },
  { title: 'Acute chest pain / STEMI', location: 'Ozumba Mbadiwe, VI', category: 'Chest pain', lat: 6.4281, lng: 3.4219, description: '55yo male experiencing severe substernal pressure, diaphoresis and acute ischemia.', icon: HeartPulse, severity: 'Critical', patients: 1 },
  { title: 'Highway multi-rollover', location: 'Third Mainland Bridge', category: 'Road accident', lat: 6.4712, lng: 3.3982, description: '3-car pileup with trapped passengers requiring trauma surgery and ICU admission.', icon: Flame, severity: 'Critical', patients: 3 },
];

export const GovernorCommandPage: React.FC<Props> = ({
  hospitals, onRefreshHospitals, activeEmergency, onOpenExplain, onNavigate, onEmergencyTriggered, currentRole = 'ADMIN',
}) => {
  const toast = useToast();
  const confirm = useConfirm();

  const [stats, setStats] = useState<GovernorStatistics>(EMPTY_STATS);
  const [liveEmergency, setLiveEmergency] = useState<Emergency | null>(activeEmergency);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<AuditEvent[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeReferrals, setActiveReferrals] = useState<Referral[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [busyPreset, setBusyPreset] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const lastStatus = useRef<string | null>(null);

  const canOperate = currentRole === 'ADMIN' || currentRole === 'HOSPITAL_STAFF';

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [statsData, timelineData, referralsData, notifData] = await Promise.all([
        ApiService.getStatistics().catch(() => null),
        ApiService.getTimeline().catch(() => ({ events: [] })),
        ApiService.getReferrals().catch(() => null),
        ApiService.getNotifications(8).catch(() => []),
      ]);
      if (!statsData) setLoadError('Cannot reach the ER-Sync backend. Figures below are not live.');
      else { setLoadError(null); setStats(statsData); }
      if (timelineData && timelineData.events) setTimeline(timelineData.events);
      if (referralsData) setActiveReferrals(referralsData);
      setNotifications(notifData || []);

      if (activeEmergency) {
        const fresh = await ApiService.getEmergency(activeEmergency.id).catch(() => null);
        if (fresh) {
          setLiveEmergency(fresh);
          // Surface lifecycle changes as they happen
          if (lastStatus.current && lastStatus.current !== fresh.status) {
            const tone = emergencyStatusTone(fresh.status);
            const msg = `${fresh.incident_reference} is now ${titleCase(fresh.status)}`;
            if (tone === 'alert') toast.error(msg); else if (tone === 'signal') toast.success(msg); else toast.info(msg);
          }
          lastStatus.current = fresh.status;
        }
        const matchRes = await ApiService.getMatches(activeEmergency.id).catch(() => ({ matches: [] }));
        if (matchRes && matchRes.matches) {
          setMatches(matchRes.matches);
          const topMatch = matchRes.matches.find((m: Match) => m.eligibility && m.rank === 1);
          if (topMatch) {
            const hosp = hospitals.find((h) => h.id === topMatch.hospital_id);
            if (hosp) setSelectedHospital((prev) => prev ?? hosp);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load command data', err);
    } finally {
      setIsLoading(false);
      setLoadedOnce(true);
    }
  };

  useEffect(() => {
    setLiveEmergency(activeEmergency);
    lastStatus.current = activeEmergency?.status ?? null;
    setSelectedHospital(null);
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEmergency?.id]);

  const runCaseAction = async (key: string, successTitle: string, successMsg: string, fn: () => Promise<any>) => {
    setBusyAction(key);
    try {
      await fn();
      toast.success(successTitle, { message: successMsg });
      fetchData();
      onRefreshHospitals();
    } catch (e: any) {
      toast.error('Action failed', { message: e?.message || 'Please try again.' });
    } finally {
      setBusyAction(null);
    }
  };

  const markArrived = async () => {
    if (!liveEmergency) return;
    const ok = await confirm({
      title: 'Mark patient as arrived?',
      message: 'The reserved bed will switch to occupied and the hospital will be notified that the patient is on site.',
      confirmLabel: 'Confirm arrival',
      icon: LogIn,
    });
    if (ok) runCaseAction('arrive', 'Patient arrived', 'Bed is now marked occupied.', () => ApiService.markArrived(liveEmergency.id));
  };

  const closeCase = async () => {
    if (!liveEmergency) return;
    const ok = await confirm({
      title: 'Close this case?',
      message: 'This ends the incident and releases the reserved bed back to the hospital. This cannot be undone.',
      confirmLabel: 'Close case & release bed',
      tone: 'warn',
      icon: Check,
    });
    if (ok) runCaseAction('close', 'Case closed', 'Bed released back to the hospital.', () => ApiService.closeCase(liveEmergency.id));
  };

  const handleQuickTrigger = async (preset: typeof QUICK_PRESETS[0]) => {
    setBusyPreset(preset.title);
    try {
      const em = await ApiService.createEmergency({
        latitude: preset.lat, longitude: preset.lng, location_name: preset.location, description: preset.description,
        category: preset.category, patient_count: preset.patients, caller_phone: '+234 802 000 1122',
      });
      toast.success('Emergency dispatched', { message: `${em.incident_reference} — matching the best hospital now.` });
      onEmergencyTriggered?.(em);
      onRefreshHospitals();
    } catch (e: any) {
      toast.error('Could not dispatch emergency', { message: e?.message });
    } finally {
      setBusyPreset(null);
    }
  };

  const openReferrals = activeReferrals.filter((r) => r.status === 'REQUESTED' || r.status === 'ACCEPTED');
  const step = lifecycleIndex(liveEmergency?.status);
  const problem = liveEmergency && step === -1;
  const eligible = matches.filter((m) => m.eligibility);
  const excluded = matches.length - eligible.length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Radar}
        eyebrow="Live dispatch grid"
        title="Command Center"
        description="Every active case, referral and bed reservation across the network — updated every few seconds."
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} loading={isLoading && loadedOnce} onClick={fetchData}>Refresh</Button>
            {(currentRole === 'ADMIN' || currentRole === 'PATIENT') && (
              <Button variant="danger" icon={Siren} onClick={() => onNavigate('intake')}>Report emergency</Button>
            )}
          </>
        }
      />

      {loadError && <Alert tone="warn" icon={AlertTriangle}>{loadError}</Alert>}

      {/* KPI ribbon */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Hospitals online" icon={Building2} tone="signal" loading={!loadedOnce} value={<>{stats.hospitals_accepting}<span className="text-[16px] font-bold text-ink-300"> / {stats.total_hospitals}</span></>} />
        <StatCard label="Free beds" icon={Bed} tone="info" loading={!loadedOnce} value={<>{stats.available_beds}<span className="text-[16px] font-bold text-ink-300"> / {stats.total_beds}</span></>} />
        <StatCard label="Match speed" icon={Zap} tone="plum" loading={!loadedOnce} value={stats.average_matching_time_ms > 0 ? <>{Math.round(stats.average_matching_time_ms)}<span className="text-[16px] font-bold text-ink-300"> ms</span></> : '—'} />
        <StatCard label="Active cases" icon={Activity} tone="alert" loading={!loadedOnce} value={stats.active_emergencies} hint={`${stats.total_emergencies} total`} />
        <StatCard label="Admitted" icon={CheckCircle2} tone="signal" loading={!loadedOnce} value={stats.referrals_accepted} />
        <StatCard label="Failovers" icon={ShieldAlert} tone="warn" loading={!loadedOnce} value={stats.reroutes_count} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* ───── Left ───── */}
        <div className="space-y-6 xl:col-span-7">
          {activeEmergency && liveEmergency ? (
            <Card className="!p-0 overflow-hidden">
              {/* Incident header */}
              <div className={clsx('border-b p-5 sm:p-6', liveEmergency.severity === 'CRITICAL' ? 'border-alert-100 bg-gradient-to-br from-alert-50 to-white' : 'border-ink-100')}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={severityTone(liveEmergency.severity)} dot pulse={liveEmergency.severity === 'CRITICAL'}>{titleCase(liveEmergency.severity)}</Badge>
                  <Badge tone={emergencyStatusTone(liveEmergency.status)}>{titleCase(liveEmergency.status)}</Badge>
                  <span className="text-[12.5px] font-bold text-ink-500 tabnum">{liveEmergency.incident_reference}</span>
                </div>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-[20px] font-extrabold text-ink-900">{liveEmergency.category} · {liveEmergency.patient_count} patient{liveEmergency.patient_count === 1 ? '' : 's'}</h2>
                    <p className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-ink-500"><MapPin className="size-4 text-ink-400" />{liveEmergency.location_name}</p>
                    <p className="mt-2 max-w-xl text-[13px] font-medium leading-relaxed text-ink-500">{liveEmergency.description}</p>
                  </div>
                  <Button variant="secondary" size="sm" icon={Sliders} onClick={() => onOpenExplain(liveEmergency.id)} className="shrink-0 self-start">Decision audit</Button>
                </div>

                {/* Lifecycle tracker */}
                {!problem ? (
                  <div className="mt-5 overflow-x-auto no-scrollbar">
                    <ol className="flex min-w-[560px] items-center">
                      {LIFECYCLE.map((label, i) => {
                        const done = i < step;
                        const current = i === step;
                        return (
                          <li key={label} className="flex flex-1 items-center last:flex-none">
                            <div className="flex flex-col items-center gap-1.5">
                              <span className={clsx('inline-flex size-7 items-center justify-center rounded-full text-[11px] font-extrabold transition-all',
                                done ? 'bg-signal-600 text-white' : current ? 'bg-signal-100 text-signal-800 ring-4 ring-signal-100' : 'bg-ink-100 text-ink-400')}>
                                {done ? <Check className="size-3.5" strokeWidth={3.5} /> : i + 1}
                              </span>
                              <span className={clsx('whitespace-nowrap text-[10.5px] font-bold', current ? 'text-ink-900' : done ? 'text-signal-700' : 'text-ink-300')}>{label}</span>
                            </div>
                            {i < LIFECYCLE.length - 1 && <span className={clsx('mx-1.5 mb-5 h-0.5 flex-1 rounded-full', done ? 'bg-signal-500' : 'bg-ink-100')} />}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                ) : (
                  liveEmergency.status === 'NO_MATCH' && (
                    <Alert tone="alert" icon={AlertTriangle} title="No eligible hospital right now" className="mt-5">
                      Every candidate rejected, timed out or fails a mandatory requirement. Check the decision audit, then retry the dispatch.
                    </Alert>
                  )
                )}
              </div>

              {/* Case actions */}
              {canOperate && (liveEmergency.status === 'NO_MATCH' || liveEmergency.status === 'PATIENT_EN_ROUTE' || liveEmergency.status === 'ARRIVED') && (
                <div className="flex flex-wrap gap-2 border-b border-ink-100 bg-ink-25 px-5 py-3.5 sm:px-6">
                  {liveEmergency.status === 'NO_MATCH' && (
                    <Button variant="danger" size="sm" icon={RefreshCw} loading={busyAction === 'retry'}
                      onClick={() => runCaseAction('retry', 'Dispatch retried', 'Re-matched on live hospital data.', () => ApiService.redispatchEmergency(liveEmergency.id))}>
                      Retry dispatch
                    </Button>
                  )}
                  {liveEmergency.status === 'PATIENT_EN_ROUTE' && (
                    <Button variant="primary" size="sm" icon={LogIn} loading={busyAction === 'arrive'} onClick={markArrived}>Mark patient arrived</Button>
                  )}
                  {(liveEmergency.status === 'ARRIVED' || liveEmergency.status === 'PATIENT_EN_ROUTE') && (
                    <Button variant="secondary" size="sm" icon={Check} loading={busyAction === 'close'} onClick={closeCase}>Close case & release bed</Button>
                  )}
                </div>
              )}

              <div className="space-y-5 p-5 sm:p-6">
                {/* Requirements */}
                {liveEmergency.requirements && liveEmergency.requirements.length > 0 && (
                  <div>
                    <p className="eyebrow mb-2.5">Clinical requirements</p>
                    <div className="flex flex-wrap gap-2">
                      {liveEmergency.requirements.map((req, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 rounded-xl border border-ink-100 bg-ink-25 px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-700">
                          {req.requirement_type === 'SPECIALTY' ? <Stethoscope className="size-3.5 text-info-600" /> : req.requirement_type === 'FACILITY' ? <Building2 className="size-3.5 text-plum-600" /> : <Bed className="size-3.5 text-signal-600" />}
                          {req.requirement_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ranking */}
                <div>
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="eyebrow">Candidate hospitals</p>
                    <span className="text-[11.5px] font-semibold text-ink-400">{excluded > 0 ? `${excluded} excluded by safety filters` : 'Match score /100'}</span>
                  </div>
                  {eligible.length > 0 ? (
                    <div className="space-y-2.5">
                      {eligible.slice(0, 4).map((match, idx) => {
                        const hosp = hospitals.find((h) => h.id === match.hospital_id);
                        const isTop = match.rank === 1;
                        const selected = selectedHospital?.id === hosp?.id;
                        return (
                          <button
                            key={match.id || idx}
                            onClick={() => hosp && setSelectedHospital(hosp)}
                            className={clsx('flex w-full items-center gap-3.5 rounded-2xl border p-3.5 text-left transition active:scale-[.99]',
                              selected ? 'border-signal-300 bg-signal-50/50 ring-4 ring-signal-100' : 'border-ink-100 bg-white hover:border-ink-200')}
                          >
                            <span className={clsx('inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-extrabold', isTop ? 'bg-signal-600 text-white' : 'bg-ink-50 text-ink-600')}>
                              {isTop ? <Trophy className="size-4" /> : `#${match.rank}`}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="truncate text-[14px] font-bold text-ink-900">{cleanName(hosp?.name) || match.hospital_id}</span>
                                {isTop && <Badge tone="signal" small className="hidden sm:inline-flex">Recommended</Badge>}
                              </span>
                              <span className="mt-0.5 block text-[12px] font-medium text-ink-500">{match.eta_minutes} min ETA · {match.distance_km} km · {hosp?.available_emergency_beds ?? 0} beds free</span>
                            </span>
                            <span className="shrink-0 rounded-xl bg-ink-900 px-3 py-1.5 text-[14px] font-extrabold text-white tabnum">{Math.round(match.score)}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState compact icon={Building2} title="No eligible hospitals yet" description="Rankings appear as soon as matching completes." />
                  )}
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader icon={ShieldAlert} tone="alert" title="No active incident selected" subtitle="Dispatch a simulated emergency to watch the engine work" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {QUICK_PRESETS.map((p) => (
                  <button
                    key={p.title}
                    onClick={() => handleQuickTrigger(p)}
                    disabled={!!busyPreset}
                    className="group flex flex-col gap-3 rounded-2xl border border-ink-100 bg-ink-25 p-4 text-left transition hover:border-alert-200 hover:bg-alert-50/40 active:scale-[.98] disabled:opacity-60"
                  >
                    <div className="flex items-center justify-between">
                      <IconTile icon={busyPreset === p.title ? RefreshCw : p.icon} tone="alert" size="sm" className={busyPreset === p.title ? '[&>svg]:animate-spin' : ''} />
                      <Badge tone="alert" small>{p.severity}</Badge>
                    </div>
                    <span>
                      <span className="block text-[14px] font-bold text-ink-900">{p.title}</span>
                      <span className="mt-0.5 block text-[12px] font-medium text-ink-500">{p.location}</span>
                    </span>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* Live dispatches */}
          <Card>
            <CardHeader icon={Activity} tone="signal" title="Live dispatches & bed reservations" subtitle="Referrals awaiting a response or holding a bed" right={<Badge tone="neutral">{openReferrals.length} active</Badge>} />
            {!loadedOnce ? (
              <div className="space-y-2.5"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
            ) : openReferrals.length > 0 ? (
              <div className="space-y-2.5">
                {openReferrals.slice(0, 6).map((ref) => (
                  <div key={ref.id} className="flex items-center gap-3.5 rounded-2xl border border-ink-100 bg-ink-25 p-3.5">
                    <IconTile icon={Building2} tone={referralTone(ref.status)} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold text-ink-900">{cleanName(ref.hospital_name || ref.hospital_id)}</p>
                      <p className="text-[12px] font-medium text-ink-500">ETA {ref.eta_minutes} min · {relTime(ref.requested_at)}</p>
                    </div>
                    <Badge tone={referralTone(ref.status)} dot pulse={ref.status === 'REQUESTED'}>{ref.status === 'REQUESTED' ? 'Awaiting' : titleCase(ref.status)}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState compact icon={Activity} title="Nothing in the queue" description="New dispatches will appear here the moment they're sent." />
            )}
          </Card>
        </div>

        {/* ───── Right ───── */}
        <div className="space-y-6 xl:col-span-5">
          <MapComponent hospitals={hospitals} emergency={activeEmergency} selectedHospital={selectedHospital} height="340px" onSelectHospital={setSelectedHospital} />

          <Card>
            <CardHeader icon={Clock} tone="neutral" title="Dispatch audit trail" subtitle="Latest system events"
              right={<Button variant="ghost" size="sm" iconOnly icon={RefreshCw} onClick={fetchData} aria-label="Refresh" className={isLoading ? '[&>svg]:animate-spin' : ''} />} />
            {timeline.length > 0 ? (
              <ol className="relative max-h-[320px] space-y-4 overflow-y-auto pr-1 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-ink-100">
                {timeline.slice(0, 7).map((evt, idx) => (
                  <li key={evt.id || idx} className="relative flex gap-3.5 pl-0">
                    <span className="relative z-10 mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-white bg-signal-500 ring-1 ring-signal-200" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[13px] font-bold text-ink-900">{titleCase((evt as any).event_type || evt.action)}</span>
                        <span className="shrink-0 text-[11px] font-semibold text-ink-300 tabnum">{clockTime(evt.created_at || (evt as any).timestamp)}</span>
                      </div>
                      <p className="truncate text-[12px] font-medium text-ink-500">{cleanName((evt.metadata as any)?.hospital_name) || (evt.metadata as any)?.reason || (evt.metadata as any)?.trigger || evt.entity_type}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState compact icon={ScrollText} title="No events yet" />
            )}
            {currentRole === 'ADMIN' && timeline.length > 0 && (
              <button onClick={() => onNavigate('audit')} className="mt-4 text-[12.5px] font-bold text-signal-700 hover:text-signal-800">View full audit trail →</button>
            )}
          </Card>

          <Card>
            <CardHeader icon={Bell} tone="warn" title="Alerts" subtitle="Recent notifications" />
            {notifications.length > 0 ? (
              <div className="max-h-[260px] space-y-3 overflow-y-auto pr-1">
                {notifications.map((n) => (
                  <div key={n.id} className="rounded-xl bg-ink-25 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-bold text-ink-900">{n.title}</span>
                      <span className="shrink-0 text-[11px] font-semibold text-ink-300 tabnum">{clockTime(n.created_at)}</span>
                    </div>
                    <p className="mt-0.5 text-[12px] font-medium leading-relaxed text-ink-500">{n.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState compact icon={Bell} title="All quiet" description="No alerts yet." />
            )}
            <button onClick={() => onNavigate('notifications')} className="mt-4 text-[12.5px] font-bold text-signal-700 hover:text-signal-800">Open all alerts →</button>
          </Card>
        </div>
      </div>
    </div>
  );
};
