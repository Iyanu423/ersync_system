import React, { useEffect, useMemo, useState } from 'react';
import { Inbox, RefreshCw, Search, Stethoscope, Building2, Bed, MapPin, Phone, Users, FileText } from 'lucide-react';
import { ApiService } from '../services/api';
import type { Hospital, Referral, UserRole } from '../types';
import { Badge, Button, Card, EmptyState, KV, Modal, PageHeader, Segmented, Skeleton, StatCard } from '../ui/primitives';
import { ReferralCard, useReferralResponder } from '../components/ReferralList';
import { cleanName, referralTone, severityTone, shortTime, titleCase } from '../utils/format';
import { parseUtc } from '../utils/time';

interface Props {
  role: UserRole;
  hospitalId: string;
  hospitals: Hospital[];
  onChanged: () => void;
}

type Filter = 'ALL' | 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CLOSED';

const matchesFilter = (r: Referral, f: Filter) => {
  switch (f) {
    case 'PENDING': return r.status === 'REQUESTED';
    case 'ACCEPTED': return r.status === 'ACCEPTED';
    case 'DECLINED': return r.status === 'REJECTED' || r.status === 'TIMEOUT' || r.status === 'REROUTED';
    case 'CLOSED': return r.status === 'COMPLETED' || r.status === 'CANCELLED';
    default: return true;
  }
};

export const ReferralsPage: React.FC<Props> = ({ role, hospitalId, hospitals, onChanged }) => {
  const isStaff = role === 'HOSPITAL_STAFF';
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const [hospitalFilter, setHospitalFilter] = useState<string>('ALL');
  const [detail, setDetail] = useState<Referral | null>(null);

  const scopeId = isStaff ? hospitalId : hospitalFilter === 'ALL' ? undefined : hospitalFilter;

  const load = async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const data = await ApiService.getReferrals(undefined, scopeId);
      setReferrals(data);
      // keep an open detail view fresh
      setDetail((d) => (d ? data.find((x) => x.id === d.id) || d : d));
    } catch (e) {
      console.error('Failed to load referrals', e);
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoaded(false);
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId]);

  const responder = useReferralResponder(() => { load(); onChanged(); });

  const counts = useMemo(() => ({
    pending: referrals.filter((r) => r.status === 'REQUESTED').length,
    accepted: referrals.filter((r) => r.status === 'ACCEPTED').length,
    declined: referrals.filter((r) => matchesFilter(r, 'DECLINED')).length,
    closed: referrals.filter((r) => matchesFilter(r, 'CLOSED')).length,
  }), [referrals]);

  const visible = referrals.filter((r) => {
    if (!matchesFilter(r, filter)) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [r.emergency?.incident_reference, r.emergency?.category, r.emergency?.location_name, r.hospital_name, r.id].some((v) => (v || '').toLowerCase().includes(q));
  });

  const em = detail?.emergency;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Inbox}
        tone="info"
        eyebrow={isStaff ? 'Incoming patients' : 'Network referrals'}
        title="Referrals"
        description={isStaff ? 'Patients ER-Sync has routed to your hospital. Respond before the timer ends or the case moves on automatically.' : 'Every referral sent across the network, with its outcome and response time.'}
        actions={<Button variant="secondary" icon={RefreshCw} loading={refreshing} onClick={() => load(true)}>Refresh</Button>}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Awaiting response" tone="info" icon={Inbox} value={counts.pending} loading={!loaded} />
        <StatCard label="Beds reserved" tone="signal" icon={Bed} value={counts.accepted} loading={!loaded} />
        <StatCard label="Declined / expired" tone="alert" icon={Building2} value={counts.declined} loading={!loaded} />
        <StatCard label="Closed" tone="neutral" icon={FileText} value={counts.closed} loading={!loaded} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-4 overflow-x-auto px-4 no-scrollbar lg:mx-0 lg:px-0">
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'ALL', label: `All (${referrals.length})` },
              { value: 'PENDING', label: `Pending (${counts.pending})` },
              { value: 'ACCEPTED', label: `Accepted (${counts.accepted})` },
              { value: 'DECLINED', label: `Declined (${counts.declined})` },
              { value: 'CLOSED', label: `Closed (${counts.closed})` },
            ]}
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {!isStaff && hospitals.length > 0 && (
            <select className="input !h-10 sm:!w-60" value={hospitalFilter} onChange={(e) => setHospitalFilter(e.target.value)} aria-label="Filter by hospital">
              <option value="ALL">All hospitals</option>
              {hospitals.map((h) => <option key={h.id} value={h.id}>{cleanName(h.name)}</option>)}
            </select>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-300" />
            <input className="input !h-10 !pl-10 sm:!w-64" placeholder="Search incident or location" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {!loaded ? (
        <div className="space-y-3"><Skeleton className="h-36" /><Skeleton className="h-36" /></div>
      ) : visible.length > 0 ? (
        <div className="space-y-3">
          {visible.map((r) => (
            <ReferralCard key={r.id} referral={r} canRespond showHospital={!isStaff} onAccept={responder.openAccept} onReject={responder.openReject} onOpen={setDetail} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={Inbox} title={referrals.length ? 'No referrals match your filters' : 'No referrals yet'}
            description={referrals.length ? 'Try a different status or clear the search.' : 'When ER-Sync routes a patient, the request lands here.'}
            action={referrals.length ? <Button variant="secondary" size="sm" onClick={() => { setFilter('ALL'); setSearch(''); }}>Clear filters</Button> : undefined} />
        </Card>
      )}

      {/* Detail */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        size="lg"
        icon={FileText}
        tone="info"
        title={em?.incident_reference || (detail ? `Referral ${detail.id.slice(0, 8)}` : '')}
        subtitle={detail ? `Sent to ${cleanName(detail.hospital_name || detail.hospital_id)}` : undefined}
        footer={
          detail?.status === 'REQUESTED' ? (
            <>
              <Button variant="danger-soft" onClick={() => { const r = detail; setDetail(null); responder.openReject(r); }}>Decline</Button>
              <Button variant="primary" onClick={() => { const r = detail; setDetail(null); responder.openAccept(r); }}>Accept & reserve bed</Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>
          )
        }
      >
        {detail && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge tone={referralTone(detail.status)} dot>{titleCase(detail.status)}</Badge>
              {em && <Badge tone={severityTone(em.severity)}>{titleCase(em.severity)}</Badge>}
              {em && <Badge tone="neutral"><Users className="size-3" />{em.patient_count} patient(s)</Badge>}
            </div>

            {em && (
              <div className="rounded-2xl border border-ink-100 bg-ink-25 p-4">
                <p className="text-[15px] font-bold text-ink-900">{em.category}</p>
                <p className="mt-1 text-[13px] font-medium leading-relaxed text-ink-600">{em.description}</p>
                {em.symptoms && <p className="mt-2 text-[12.5px] font-medium text-ink-500"><span className="font-bold text-ink-700">Symptoms:</span> {em.symptoms}</p>}
                {em.requirements?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {em.requirements.map((rq, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-ink-100 bg-white px-2 py-1 text-[12px] font-semibold text-ink-700">
                        {rq.requirement_type === 'SPECIALTY' ? <Stethoscope className="size-3.5 text-info-600" /> : rq.requirement_type === 'FACILITY' ? <Building2 className="size-3.5 text-plum-600" /> : <Bed className="size-3.5 text-signal-600" />}
                        {rq.requirement_name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="divide-y divide-ink-100">
              {em && <KV label="Pick-up location"><span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5 text-ink-400" />{em.location_name}</span></KV>}
              {em?.caller_phone && <KV label="Responder phone"><span className="inline-flex items-center gap-1.5"><Phone className="size-3.5 text-ink-400" />{em.caller_phone}</span></KV>}
              <KV label="Estimated arrival">{detail.eta_minutes} min</KV>
              <KV label="Requested">{shortTime(detail.requested_at)} · {parseUtc(detail.requested_at).toLocaleDateString()}</KV>
              {detail.accepted_at && <KV label="Accepted">{shortTime(detail.accepted_at)}</KV>}
              {detail.rejected_at && <KV label="Declined">{shortTime(detail.rejected_at)}</KV>}
              {detail.rejection_reason && <KV label="Reason">{detail.rejection_reason}</KV>}
              {detail.notes && <KV label="Notes">{detail.notes}</KV>}
              <KV label="Referral ID"><span className="tabnum">{detail.id.slice(0, 8)}</span></KV>
            </div>
          </div>
        )}
      </Modal>

      {responder.modal}
    </div>
  );
};
