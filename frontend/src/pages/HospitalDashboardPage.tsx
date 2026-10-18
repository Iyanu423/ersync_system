import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { ApiService } from '../services/api';
import type { Hospital, Referral } from '../types';
import { useWorkspace } from '../ui/WorkspaceContext';
import { useConfirm, useToast } from '../ui/UIProvider';
import { Badge, Button, Card, CardHeader, EmptyState, IconTile, PageHeader, ProgressBar, Segmented, StatCard, Switch } from '../ui/primitives';
import { ReferralCard, useReferralResponder } from '../components/ReferralList';
import { cleanName, hospitalTone, relTime } from '../utils/format';
import { Activity, Bed, Building2, Check, Inbox, Minus, Phone, Plus, MapPin, Stethoscope, Power, Clock, TriangleAlert, ShieldOff } from 'lucide-react';

interface Props {
  hospitals: Hospital[];
  selectedHospitalId: string;
  onSelectHospitalId: (id: string) => void;
  onRefreshHospitals: () => Promise<void> | void;
}

const FALLBACK: Hospital = {
  id: 'hosp_lagos_central', name: 'Lagos Central Trauma Centre', address: 'Lagos Island Medical District, Broad Street, Lagos',
  latitude: 6.4531, longitude: 3.3958, phone: '+234 1 234 5678', emergency_status: 'OPEN', overall_capacity: 75, accepting_emergencies: true,
  last_status_update: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  is_stale: false, freshness_category: 'FRESH', available_emergency_beds: 18, total_emergency_beds: 25, specialties: [], facilities: [],
};

type SubTab = 'overview' | 'specialists' | 'facilities' | 'referrals';

export const HospitalDashboardPage: React.FC<Props> = ({ hospitals, selectedHospitalId, onSelectHospitalId, onRefreshHospitals }) => {
  const { role } = useWorkspace();
  const toast = useToast();
  const confirm = useConfirm();

  const initial = hospitals.find((h) => h.id === selectedHospitalId) || hospitals[0] || FALLBACK;
  const [hospital, setHospital] = useState<Hospital>(initial);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    const matched = hospitals.find((h) => h.id === selectedHospitalId);
    if (matched) setHospital((prev) => (prev.id === matched.id ? { ...prev, ...matched } : matched));
  }, [selectedHospitalId, hospitals]);

  const loadHospitalData = async () => {
    const targetId = selectedHospitalId || hospital.id;
    try {
      const [hData, refs] = await Promise.all([
        ApiService.getHospital(targetId).catch(() => null),
        ApiService.getReferrals(undefined, targetId).catch(() => null),
      ]);
      if (hData) setHospital(hData);
      if (refs) setReferrals(refs);
    } catch (e) {
      console.error('Failed to load hospital details', e);
    }
  };

  useEffect(() => {
    loadHospitalData();
    const interval = setInterval(loadHospitalData, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHospitalId]);

  const responder = useReferralResponder(() => { loadHospitalData(); onRefreshHospitals(); });

  /** Show the server's real reason and roll the screen back to what is actually stored. */
  const failAndResync = (action: string, e: any) => {
    console.error(e);
    toast.error(`${action} failed`, { message: e?.message || 'Unknown error' });
    loadHospitalData();
  };

  const handleStatusChange = async (newStatus: 'OPEN' | 'LIMITED' | 'CLOSED') => {
    if (newStatus === hospital.emergency_status) return;
    if (newStatus === 'CLOSED') {
      const ok = await confirm({
        title: 'Close the emergency department?',
        message: 'ER-Sync will stop sending new emergencies to this hospital until you reopen it. Patients already accepted are not affected.',
        confirmLabel: 'Close department',
        tone: 'danger',
        icon: Power,
      });
      if (!ok) return;
    }
    setBusyKey('status');
    try {
      setHospital((prev) => ({ ...prev, emergency_status: newStatus }));
      await ApiService.updateHospitalStatus(hospital.id, newStatus, hospital.accepting_emergencies);
      const msg = newStatus === 'OPEN' ? 'Open for emergencies' : newStatus === 'LIMITED' ? 'Limited capacity' : 'Department closed';
      if (newStatus === 'CLOSED') toast.warning(msg, { message: 'No new emergencies will be routed here.' });
      else toast.success(`Status: ${msg}`, { message: newStatus === 'LIMITED' ? 'Ranked lower in matching but still eligible.' : 'Matching engine updated.' });
      onRefreshHospitals();
    } catch (e) { failAndResync('Status change', e); } finally { setBusyKey(null); }
  };

  const handleToggleAccepting = async () => {
    const newVal = !hospital.accepting_emergencies;
    if (!newVal) {
      const ok = await confirm({
        title: 'Divert incoming emergencies?',
        message: 'New cases will skip this hospital. You can re-enable intake at any time.',
        confirmLabel: 'Divert intake',
        tone: 'warn',
        icon: ShieldOff,
      });
      if (!ok) return;
    }
    setBusyKey('accepting');
    try {
      setHospital((prev) => ({ ...prev, accepting_emergencies: newVal }));
      await ApiService.updateHospitalStatus(hospital.id, hospital.emergency_status, newVal);
      if (newVal) toast.success('Intake enabled', { message: 'This hospital can receive new emergencies.' });
      else toast.warning('Intake diverted', { message: 'New emergencies will skip this hospital.' });
      onRefreshHospitals();
    } catch (e) { failAndResync('Intake toggle', e); } finally { setBusyKey(null); }
  };

  const handleQuickBedAdjust = async (delta: number) => {
    const total = hospital.total_emergency_beds;
    const newAvailable = Math.max(0, Math.min(total, hospital.available_emergency_beds + delta));
    if (newAvailable === hospital.available_emergency_beds) {
      toast.info(delta > 0 ? 'Already at maximum' : 'No free beds to remove', { duration: 2200 });
      return;
    }
    try {
      setHospital((prev) => ({ ...prev, available_emergency_beds: newAvailable }));
      // Changes the real bed rows the Governor counts (reserved beds stay locked to their cases)
      const updated = await ApiService.updateHospitalBeds(hospital.id, total, newAvailable);
      setHospital((prev) => ({ ...prev, ...updated }));
      toast.success(`Free beds: ${updated.available_emergency_beds} of ${updated.total_emergency_beds}`, { duration: 2400 });
      onRefreshHospitals();
    } catch (e) { failAndResync('Bed update', e); }
  };

  const handleSpecialistToggle = async (specName: string, currentStatus: string, count: number) => {
    const newStatus = currentStatus === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
    const newCount = newStatus === 'AVAILABLE' ? Math.max(1, count) : 0;
    try {
      setHospital((prev) => ({ ...prev, specialties: (prev.specialties || []).map((s) => (s.specialty_name === specName ? { ...s, status: newStatus as any, available_count: newCount } : s)) }));
      await ApiService.updateSpecialist(hospital.id, specName, newCount, newStatus);
      toast.success(`${specName} ${newStatus === 'AVAILABLE' ? 'on duty' : 'off duty'}`, { duration: 2400 });
      onRefreshHospitals();
    } catch (e) { failAndResync('Specialist update', e); }
  };

  const handleFacilityToggle = async (facName: string, currentAvailable: boolean) => {
    const newAvailable = !currentAvailable;
    const newStatus = newAvailable ? 'OPERATIONAL' : 'OFFLINE';
    if (!newAvailable) {
      const ok = await confirm({
        title: `Take ${facName} offline?`,
        message: 'Cases that require this facility will no longer be routed here until it is back online.',
        confirmLabel: 'Set offline',
        tone: 'warn',
      });
      if (!ok) return;
    }
    try {
      setHospital((prev) => ({ ...prev, facilities: (prev.facilities || []).map((f) => (f.facility_name === facName ? { ...f, available: newAvailable, status: newStatus as any } : f)) }));
      await ApiService.updateFacility(hospital.id, facName, newAvailable, newStatus);
      if (newAvailable) toast.success(`${facName} is operational`, { duration: 2400 }); else toast.warning(`${facName} set offline`, { duration: 3500 });
      onRefreshHospitals();
    } catch (e) { failAndResync('Facility update', e); }
  };

  const pending = referrals.filter((r) => r.status === 'REQUESTED');
  const onDuty = hospital.specialties?.filter((s) => s.status === 'AVAILABLE').length || 0;
  const online = hospital.facilities?.filter((f) => f.available).length || 0;
  const occupied = hospital.total_emergency_beds - hospital.available_emergency_beds;
  const bedPct = (hospital.available_emergency_beds / (hospital.total_emergency_beds || 1)) * 100;
  const statusTone = hospitalTone(hospital.emergency_status, hospital.accepting_emergencies);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Building2}
        tone="signal"
        eyebrow="Facility control"
        title="Hospital Desk"
        description="What you change here is what ER-Sync sees. Keep beds, specialists and equipment accurate and the network routes the right patients to you."
        actions={
          role === 'ADMIN' && hospitals.length > 0 ? (
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-signal-600" />
              <select className="input !h-10 !w-full !pl-10 sm:!w-72" value={selectedHospitalId} onChange={(e) => onSelectHospitalId(e.target.value)} aria-label="Select hospital">
                {hospitals.map((h) => <option key={h.id} value={h.id}>{cleanName(h.name)}</option>)}
              </select>
            </div>
          ) : undefined
        }
      />

      {/* Identity + control panel */}
      <Card className="!p-0 overflow-hidden">
        <div className={clsx('h-1.5', statusTone === 'signal' ? 'bg-signal-500' : statusTone === 'warn' ? 'bg-warn-500' : 'bg-alert-500')} />
        <div className="flex flex-col gap-6 p-5 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <IconTile icon={Building2} tone={statusTone} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-[22px] font-extrabold leading-tight text-ink-900">{cleanName(hospital.name)}</h2>
                <Badge tone={statusTone} dot pulse={hospital.accepting_emergencies && hospital.emergency_status !== 'CLOSED'}>
                  {hospital.emergency_status === 'CLOSED' ? 'Closed' : !hospital.accepting_emergencies ? 'Diverting' : hospital.emergency_status === 'LIMITED' ? 'Limited' : 'Accepting'}
                </Badge>
                {hospital.is_stale && <Badge tone="warn"><TriangleAlert className="size-3" /> Stale data</Badge>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] font-semibold text-ink-500">
                <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5 text-ink-400" />{hospital.address}</span>
                <span className="inline-flex items-center gap-1.5"><Phone className="size-3.5 text-ink-400" />{hospital.phone}</span>
                <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5 text-ink-400" />Updated {relTime(hospital.last_status_update)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="eyebrow mb-1.5">Emergency department</p>
              <div className="segmented w-full sm:w-auto">
                {(['OPEN', 'LIMITED', 'CLOSED'] as const).map((st) => (
                  <button key={st} disabled={busyKey === 'status'} data-active={hospital.emergency_status === st} onClick={() => handleStatusChange(st)}
                    className={clsx('flex-1 sm:flex-none', hospital.emergency_status === st && (st === 'OPEN' ? '!text-signal-700' : st === 'LIMITED' ? '!text-warn-700' : '!text-alert-700'))}>
                    <span className={clsx('size-2 rounded-full', st === 'OPEN' ? 'bg-signal-500' : st === 'LIMITED' ? 'bg-warn-500' : 'bg-alert-500')} />
                    {st === 'OPEN' ? 'Open' : st === 'LIMITED' ? 'Limited' : 'Closed'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-ink-100 bg-ink-25 px-4 py-2.5 sm:min-w-[210px]">
              <div className="leading-tight">
                <p className="text-[13px] font-bold text-ink-900">Accepting intake</p>
                <p className="text-[11.5px] font-medium text-ink-400">{hospital.accepting_emergencies ? 'Receiving cases' : 'Diverted'}</p>
              </div>
              <Switch checked={hospital.accepting_emergencies} onChange={handleToggleAccepting} disabled={busyKey === 'accepting'} label="Accepting emergencies" />
            </div>
          </div>
        </div>
      </Card>

      {/* Pending referral banner */}
      {pending.length > 0 && (
        <button onClick={() => setSubTab('referrals')} className="animate-pop-in flex w-full items-center gap-4 rounded-2xl border border-info-200 bg-info-50 p-4 text-left transition hover:bg-info-100/70">
          <IconTile icon={Inbox} tone="info" />
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-extrabold text-info-700">{pending.length} referral{pending.length === 1 ? '' : 's'} waiting for your response</span>
            <span className="block text-[12.5px] font-medium text-info-700/80">Patients are on the way — accept or decline before the timer runs out.</span>
          </span>
          <span className="hidden text-[13px] font-bold text-info-700 sm:block">Review →</span>
        </button>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Free emergency beds" icon={Bed} tone="info" value={<>{hospital.available_emergency_beds}<span className="text-[16px] font-bold text-ink-300"> / {hospital.total_emergency_beds}</span></>}>
          <ProgressBar value={bedPct} tone={bedPct < 20 ? 'alert' : bedPct < 45 ? 'warn' : 'info'} className="mt-3" />
          <div className="mt-3 flex items-center gap-2">
            <Button variant="secondary" size="sm" iconOnly icon={Minus} onClick={() => handleQuickBedAdjust(-1)} aria-label="Decrease free beds" />
            <Button variant="primary" size="sm" iconOnly icon={Plus} onClick={() => handleQuickBedAdjust(1)} aria-label="Increase free beds" />
            <span className="ml-1 text-[11.5px] font-semibold text-ink-400">Adjust live</span>
          </div>
        </StatCard>
        <StatCard label="Specialists on duty" icon={Stethoscope} tone="plum" value={<>{onDuty}<span className="text-[16px] font-bold text-ink-300"> / {hospital.specialties?.length || 0}</span></>} hint="Used for clinical matching" />
        <StatCard label="Facilities online" icon={Activity} tone="signal" value={<>{online}<span className="text-[16px] font-bold text-ink-300"> / {hospital.facilities?.length || 0}</span></>} hint="Theatre, ICU, imaging…" />
        <StatCard label="Referrals" icon={Inbox} tone="warn" value={referrals.length} hint={`${referrals.filter((r) => r.status === 'ACCEPTED').length} confirmed bed reservation(s)`} />
      </div>

      {/* Sub-tabs */}
      <div className="-mx-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
        <Segmented<SubTab>
          value={subTab}
          onChange={setSubTab}
          options={[
            { value: 'overview', label: 'Beds', icon: Bed },
            { value: 'specialists', label: `Specialists (${onDuty})`, icon: Stethoscope },
            { value: 'facilities', label: `Facilities (${online})`, icon: Activity },
            { value: 'referrals', label: pending.length ? `Referrals · ${pending.length} new` : 'Referrals', icon: Inbox },
          ]}
        />
      </div>

      {subTab === 'overview' && (
        <Card key="beds" className="animate-rise">
          <CardHeader icon={Bed} tone="info" title="Emergency bed allocation" subtitle="The free-bed count directly calibrates matching scores" right={<Badge tone="info">{hospital.available_emergency_beds} free for intake</Badge>} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: 'Licensed capacity', value: hospital.total_emergency_beds, hint: 'Total trauma & emergency beds', cls: 'bg-ink-25 border-ink-100' },
              { label: 'Occupied or reserved', value: occupied, hint: 'Currently unavailable', cls: 'bg-warn-50/60 border-warn-100' },
              { label: 'Free for dispatch', value: hospital.available_emergency_beds, hint: 'Ready for referral', cls: 'bg-signal-50/70 border-signal-100' },
            ].map((b) => (
              <div key={b.label} className={clsx('rounded-2xl border p-4', b.cls)}>
                <p className="eyebrow">{b.label}</p>
                <p className="mt-1.5 text-[30px] font-extrabold leading-none text-ink-900 tabnum">{b.value}</p>
                <p className="mt-1.5 text-[12px] font-medium text-ink-500">{b.hint}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {subTab === 'specialists' && (
        <Card key="spec" className="animate-rise">
          <CardHeader icon={Stethoscope} tone="plum" title="On-duty specialist roster" subtitle="Tap a specialty to toggle it — required for clinical hard constraints" right={<Badge tone="plum">{onDuty} active</Badge>} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {hospital.specialties?.map((spec) => {
              const avail = spec.status === 'AVAILABLE';
              return (
                <button key={spec.specialty_name} onClick={() => handleSpecialistToggle(spec.specialty_name, spec.status, spec.available_count || 1)}
                  className={clsx('flex items-center gap-3 rounded-2xl border p-4 text-left transition active:scale-[.98]', avail ? 'border-signal-200 bg-signal-50/60 hover:bg-signal-50' : 'border-ink-100 bg-ink-25 hover:border-ink-200')}>
                  <span className={clsx('inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition', avail ? 'border-signal-600 bg-signal-600 text-white' : 'border-ink-200 bg-white')}>
                    {avail && <Check className="size-3.5" strokeWidth={3.5} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-bold text-ink-900">{spec.specialty_name}</span>
                    <span className="block text-[12px] font-medium text-ink-500">{avail ? `${spec.available_count || 1} on duty` : 'Off duty'}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {subTab === 'facilities' && (
        <Card key="fac" className="animate-rise">
          <CardHeader icon={Activity} tone="signal" title="Facilities & equipment readiness" subtitle="Live operational status of diagnostic and surgical suites" right={<Badge tone="signal">{online} online</Badge>} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {hospital.facilities?.map((fac) => (
              <button key={fac.facility_name} onClick={() => handleFacilityToggle(fac.facility_name, fac.available)}
                className={clsx('flex items-center gap-3 rounded-2xl border p-4 text-left transition active:scale-[.98]', fac.available ? 'border-signal-200 bg-signal-50/60 hover:bg-signal-50' : 'border-alert-100 bg-alert-50/40 hover:bg-alert-50')}>
                <span className={clsx('size-2.5 shrink-0 rounded-full', fac.available ? 'bg-signal-500' : 'bg-alert-500')} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-bold text-ink-900">{fac.facility_name}</span>
                  <span className="block text-[12px] font-medium text-ink-500">{fac.available ? 'Operational' : 'Offline'}{fac.quantity > 1 ? ` · ×${fac.quantity}` : ''}</span>
                </span>
                <Badge tone={fac.available ? 'signal' : 'alert'} small>{fac.available ? 'Online' : 'Offline'}</Badge>
              </button>
            ))}
          </div>
        </Card>
      )}

      {subTab === 'referrals' && (
        <div key="refs" className="animate-rise space-y-3">
          {referrals.length > 0 ? (
            referrals.map((r) => <ReferralCard key={r.id} referral={r} canRespond onAccept={responder.openAccept} onReject={responder.openReject} />)
          ) : (
            <Card><EmptyState icon={Inbox} title="No referrals yet" description="Patients routed to this hospital will appear here with a live response timer." /></Card>
          )}
        </div>
      )}

      {responder.modal}
    </div>
  );
};
