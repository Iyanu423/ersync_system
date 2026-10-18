import React, { useState } from 'react';
import clsx from 'clsx';
import type { Hospital, Emergency, OneClickDemoResult, UserRole } from '../types';
import { MapComponent } from '../components/MapComponent';
import { ApiService } from '../services/api';
import { useConfirm, useToast } from '../ui/UIProvider';
import { Badge, Button, Card, EmptyState, PageHeader, ProgressBar, Segmented } from '../ui/primitives';
import { cleanName, hospitalTone, relTime } from '../utils/format';
import { Activity, Bed, Building2, Clock, FlaskConical, Map as MapIcon, MapPin, RefreshCw, Search } from 'lucide-react';

interface Props {
  hospitals: Hospital[];
  activeEmergency: Emergency | null;
  demoResult: OneClickDemoResult | null;
  onRefresh: () => void;
  role?: UserRole;
}

type Filter = 'ALL' | 'ACCEPTING' | 'CLOSED' | 'STALE';

export const NetworkMapPage: React.FC<Props> = ({ hospitals, activeEmergency, onRefresh, role = 'ADMIN' }) => {
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Hospital | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [staleBusy, setStaleBusy] = useState<string | null>(null);

  const filtered = hospitals.filter((h) => {
    const q = search.toLowerCase();
    const matchesSearch = h.name.toLowerCase().includes(q) || h.address.toLowerCase().includes(q);
    const matchesStatus =
      filter === 'ALL' ||
      (filter === 'ACCEPTING' && h.accepting_emergencies) ||
      (filter === 'CLOSED' && (h.emergency_status === 'CLOSED' || !h.accepting_emergencies)) ||
      (filter === 'STALE' && h.is_stale);
    return matchesSearch && matchesStatus;
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await onRefresh(); toast.success('Grid refreshed', { duration: 1800 }); } finally { setRefreshing(false); }
  };

  const handleMakeStale = async (h: Hospital) => {
    const ok = await confirm({
      title: 'Simulate stale data?',
      message: `${cleanName(h.name)} will appear to have stopped reporting for 60 minutes. Critical cases will exclude it until it updates again.`,
      confirmLabel: 'Simulate stale',
      tone: 'warn',
      icon: Clock,
    });
    if (!ok) return;
    setStaleBusy(h.id);
    try {
      await ApiService.makeHospitalStale(h.id, 60);
      toast.warning(`${cleanName(h.name)} is now stale`, { message: 'Matching will penalise or exclude it.' });
      onRefresh();
    } catch (e: any) {
      toast.error('Could not simulate stale data', { message: e?.message });
    } finally { setStaleBusy(null); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={MapIcon}
        tone="info"
        eyebrow="Geospatial grid"
        title="Facility Map"
        description="Every registered hospital in the Lagos network with live status, free beds and data freshness."
        actions={<Button data-desktop-only variant="secondary" icon={RefreshCw} loading={refreshing} onClick={handleRefresh}>Refresh grid</Button>}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-4 overflow-x-auto px-4 no-scrollbar lg:mx-0 lg:px-0">
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'ALL', label: `All (${hospitals.length})` },
              { value: 'ACCEPTING', label: 'Accepting' },
              { value: 'CLOSED', label: 'Diverted' },
              { value: 'STALE', label: 'Stale' },
            ]}
          />
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-300" />
          <input className="input !h-10 !pl-10 lg:!w-80" placeholder="Search hospital or area" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <MapComponent hospitals={filtered} emergency={activeEmergency} selectedHospital={selected} height="min(52vh, 460px)" onSelectHospital={setSelected} />

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((h) => {
            const isSel = selected?.id === h.id;
            const tone = hospitalTone(h.emergency_status, h.accepting_emergencies);
            const pct = (h.available_emergency_beds / (h.total_emergency_beds || 1)) * 100;
            return (
              <div key={h.id} onClick={() => setSelected(h)} className={clsx('card card-interactive flex cursor-pointer flex-col gap-4 p-5', isSel && '!border-signal-300 ring-4 ring-signal-100')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={clsx('mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl', tone === 'signal' ? 'bg-signal-50 text-signal-700' : tone === 'warn' ? 'bg-warn-50 text-warn-700' : 'bg-alert-50 text-alert-600')}>
                      <Building2 className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-[14.5px] font-bold leading-snug text-ink-900">{cleanName(h.name)}</h3>
                      <p className="mt-0.5 flex items-center gap-1 text-[12px] font-medium text-ink-500"><MapPin className="size-3 shrink-0 text-ink-300" /><span className="truncate">{h.address}</span></p>
                    </div>
                  </div>
                  <Badge tone={tone} dot>{h.emergency_status === 'CLOSED' ? 'Closed' : !h.accepting_emergencies ? 'Diverting' : h.emergency_status === 'LIMITED' ? 'Limited' : 'Open'}</Badge>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[12.5px] font-semibold">
                    <span className="inline-flex items-center gap-1.5 text-ink-700"><Bed className="size-4 text-info-600" />{h.available_emergency_beds} / {h.total_emergency_beds} beds free</span>
                    <span className="inline-flex items-center gap-1.5 text-ink-400"><Activity className="size-3.5" />{h.overall_capacity}% used</span>
                  </div>
                  <ProgressBar value={pct} tone={pct < 20 ? 'alert' : pct < 45 ? 'warn' : 'signal'} height={6} />
                </div>

                <div className="flex items-center justify-between border-t border-ink-100 pt-3.5 text-[12px]">
                  <span className={clsx('inline-flex items-center gap-1.5 font-semibold', h.is_stale ? 'text-warn-700' : 'text-ink-400')}>
                    <Clock className="size-3.5" />{h.is_stale ? 'Stale · ' : 'Updated '}{relTime(h.last_status_update)}
                  </span>
                  {role === 'ADMIN' && (
                    <Button variant="ghost" size="sm" icon={FlaskConical} loading={staleBusy === h.id} onClick={(e) => { e.stopPropagation(); handleMakeStale(h); }}>Simulate stale</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card><EmptyState icon={Building2} title="No hospitals match" description="Try a different filter or search term." action={<Button variant="secondary" size="sm" onClick={() => { setFilter('ALL'); setSearch(''); }}>Reset filters</Button>} /></Card>
      )}
    </div>
  );
};
