import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, MapPin, Timer, XCircle, Users, ChevronRight, ShieldCheck, ShieldX } from 'lucide-react';
import type { Referral } from '../types';
import { ApiService } from '../services/api';
import { useToast } from '../ui/UIProvider';
import { Badge, Button, Field, Modal, Select } from '../ui/primitives';
import { cleanName, referralTone, relTime, severityTone, shortTime, titleCase } from '../utils/format';
import { parseUtc } from '../utils/time';

export const REJECT_REASONS = [
  'Emergency Department Surge',
  'Required specialist unavailable',
  'Theatre / equipment offline',
  'No bed capacity',
  'Other',
];

/** Re-renders every second while mounted — drives live countdowns. */
function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

const Countdown: React.FC<{ until?: string }> = ({ until }) => {
  const now = useNow();
  if (!until) return null;
  const left = Math.max(0, Math.round((parseUtc(until).getTime() - now) / 1000));
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  return (
    <Badge tone={left <= 60 ? 'alert' : 'warn'} dot pulse={left <= 60}>
      <Timer className="size-3" /> {left === 0 ? 'Expiring…' : `Respond in ${mm}:${ss}`}
    </Badge>
  );
};

/* ───────── Response modal (accept / reject) ───────── */
interface Target { ref: Referral; mode: 'accept' | 'reject' }

export function useReferralResponder(onDone: () => void) {
  const toast = useToast();
  const [target, setTarget] = useState<Target | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [notes, setNotes] = useState('');

  const open = (ref: Referral, mode: Target['mode']) => {
    setReason(REJECT_REASONS[0]);
    setNotes('');
    setTarget({ ref, mode });
  };

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    try {
      if (target.mode === 'accept') {
        const result: any = await ApiService.acceptReferral(target.ref.id, notes.trim() || undefined);
        toast.success('Referral accepted', { message: `${result?.beds_reserved ?? 1} bed(s) reserved for the incoming patient.` });
      } else {
        const result: any = await ApiService.rejectReferral(target.ref.id, reason, notes.trim() || undefined);
        if (result?.next_hospital_contacted) {
          toast.warning('Referral declined — case re-routed', { message: `Now with ${cleanName(String(result.next_hospital_contacted))}.` });
        } else {
          toast.error('Referral declined — no other hospital eligible', { message: 'The command centre has been alerted.' });
        }
      }
      setTarget(null);
      onDone();
    } catch (e: any) {
      toast.error(target.mode === 'accept' ? 'Could not accept referral' : 'Could not decline referral', { message: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const em = target?.ref.emergency;
  const accept = target?.mode === 'accept';

  const modal = (
    <Modal
      open={!!target}
      onClose={() => !busy && setTarget(null)}
      size="md"
      icon={accept ? ShieldCheck : ShieldX}
      tone={accept ? 'signal' : 'alert'}
      title={accept ? 'Accept & reserve a bed' : 'Decline this referral'}
      subtitle={em ? `${em.incident_reference} · ${em.category} · ${em.patient_count} patient(s)` : target ? `Referral ${target.ref.id.slice(0, 8)}` : undefined}
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={() => setTarget(null)} disabled={busy}>Cancel</Button>
          <Button variant={accept ? 'primary' : 'danger'} loading={busy} icon={accept ? CheckCircle2 : XCircle} onClick={submit}>
            {accept ? 'Accept & reserve bed' : 'Decline & re-route'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {accept ? (
          <p className="text-[13.5px] font-medium leading-relaxed text-ink-600">
            An emergency bed will be locked for this patient immediately and the dispatcher will be notified. ETA is <strong className="text-ink-900">{target?.ref.eta_minutes} min</strong>.
          </p>
        ) : (
          <>
            <p className="text-[13.5px] font-medium leading-relaxed text-ink-600">
              The case will automatically fail over to the next best hospital. Tell the network why you can't take this patient.
            </p>
            <Field label="Reason">
              <Select title="Reason for declining" value={reason} onChange={setReason} options={REJECT_REASONS.map((r) => ({ value: r, label: r }))} />
            </Field>
          </>
        )}
        <Field label="Notes (optional)">
          <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={accept ? 'e.g. Trauma team on standby at bay 2' : 'Any detail the next hospital or dispatcher should know'} />
        </Field>
      </div>
    </Modal>
  );

  return { openAccept: (r: Referral) => open(r, 'accept'), openReject: (r: Referral) => open(r, 'reject'), modal };
}

/* ───────── Card ───────── */
export const ReferralCard: React.FC<{
  referral: Referral;
  canRespond: boolean;
  showHospital?: boolean;
  onAccept?: (r: Referral) => void;
  onReject?: (r: Referral) => void;
  onOpen?: (r: Referral) => void;
}> = ({ referral: r, canRespond, showHospital, onAccept, onReject, onOpen }) => {
  const em = r.emergency;
  const pending = r.status === 'REQUESTED';

  return (
    <div className={`card overflow-hidden transition ${pending ? 'border-info-200 shadow-[0_0_0_3px_rgba(61,123,240,.06)]' : ''}`}>
      <div className={`flex flex-col gap-4 p-4 sm:p-5 ${onOpen ? 'cursor-pointer' : ''}`} onClick={() => onOpen?.(r)}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={referralTone(r.status)} dot pulse={pending}>{titleCase(r.status)}</Badge>
          {em && <Badge tone={severityTone(em.severity)}>{titleCase(em.severity)}</Badge>}
          <span className="text-[12.5px] font-bold text-ink-700 tabnum">{em?.incident_reference || `#${r.emergency_id.slice(0, 8)}`}</span>
          {pending && <Countdown until={r.reservation_expiry} />}
          <span className="ml-auto text-[12px] font-medium text-ink-400">{relTime(r.requested_at)}</span>
        </div>

        {em ? (
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-ink-900">{em.category}</p>
            <p className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-relaxed text-ink-500">{em.description}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] font-semibold text-ink-500">
              <span className="inline-flex items-center gap-1.5"><Users className="size-3.5 text-ink-400" />{em.patient_count} patient{em.patient_count === 1 ? '' : 's'}</span>
              <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5 text-ink-400" />{em.location_name}</span>
              <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5 text-ink-400" />ETA {r.eta_minutes} min</span>
            </div>
          </div>
        ) : (
          <p className="text-[13px] font-medium text-ink-500">ETA {r.eta_minutes} min · requested {shortTime(r.requested_at)}</p>
        )}

        {showHospital && (
          <p className="text-[12.5px] font-semibold text-ink-500">Sent to <span className="text-ink-900">{cleanName(r.hospital_name || r.hospital_id)}</span></p>
        )}
      </div>

      {pending && canRespond ? (
        <div className="flex flex-col gap-2 border-t border-ink-100 bg-ink-25 p-3 sm:flex-row sm:justify-end sm:px-5">
          <Button variant="danger-soft" icon={XCircle} onClick={() => onReject?.(r)}>Decline</Button>
          <Button variant="primary" icon={CheckCircle2} onClick={() => onAccept?.(r)}>Accept & reserve bed</Button>
        </div>
      ) : (
        <div className="flex items-center justify-between border-t border-ink-100 bg-ink-25 px-4 py-2.5 text-[12.5px] font-semibold sm:px-5">
          <span className={r.status === 'ACCEPTED' ? 'text-signal-700' : r.status === 'REJECTED' || r.status === 'TIMEOUT' ? 'text-alert-700' : 'text-ink-500'}>
            {r.status === 'ACCEPTED' ? 'Bed reserved for patient'
              : r.status === 'COMPLETED' ? 'Case closed'
              : r.status === 'TIMEOUT' ? 'No response — re-routed automatically'
              : r.status === 'REJECTED' ? (r.rejection_reason ? `Declined: ${r.rejection_reason}` : 'Declined — diverted to next facility')
              : r.status === 'REROUTED' ? 'Re-routed to another facility'
              : r.status === 'REQUESTED' ? 'Awaiting hospital response'
              : titleCase(r.status)}
          </span>
          {onOpen && <button onClick={(e) => { e.stopPropagation(); onOpen(r); }} className="inline-flex items-center gap-1 text-ink-500 transition hover:text-ink-900">Details <ChevronRight className="size-3.5" /></button>}
        </div>
      )}
    </div>
  );
};
