import React from 'react';
import { Award, Check, CheckCircle2, Clock, Layers, X } from 'lucide-react';
import { Badge, Button, Modal } from '../ui/primitives';
import { cleanName } from '../utils/format';

interface ExplainModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    emergency_id: string;
    summary: string;
    eligible_hospitals: Array<{
      id: string; name: string; rank: number; score: number; eta_minutes: number; distance_km: number;
      score_breakdown?: {
        capability_score: number; eta_score: number; capacity_score: number; specialist_score: number; freshness_score: number;
        final_score: number; weights_applied: Record<string, number>;
      };
      why_selected: string[];
    }>;
    excluded_hospitals: Array<{ id: string; name: string; eligibility: boolean; rejection_reason: string; why_excluded: string }>;
  } | null;
}

const FACTORS = [
  { key: 'capability_score', label: 'Capability', weight: 40, color: '#10A98B' },
  { key: 'eta_score', label: 'ETA', weight: 30, color: '#3D7BF0' },
  { key: 'capacity_score', label: 'Beds', weight: 15, color: '#6D4AE0' },
  { key: 'specialist_score', label: 'Specialists', weight: 10, color: '#E5A00D' },
  { key: 'freshness_score', label: 'Freshness', weight: 5, color: '#8393AB' },
] as const;

export const ExplainModal: React.FC<ExplainModalProps> = ({ isOpen, onClose, data }) => {
  if (!data) return null;
  return (
    <Modal open={isOpen} onClose={onClose} size="xl" icon={Layers} tone="info" title="Decision audit"
      subtitle="Exactly why each hospital was ranked, or excluded, for this incident"
      footer={<Button variant="dark" onClick={onClose}>Close</Button>}>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 rounded-2xl border border-info-100 bg-info-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow !text-info-700">Evaluation summary</p>
            <p className="mt-0.5 text-[14px] font-bold text-ink-900">{data.summary}</p>
          </div>
          <Badge tone="neutral" className="self-start bg-white">Incident {data.emergency_id.slice(0, 8)}</Badge>
        </div>

        <div>
          <p className="mb-3 flex items-center gap-2 text-[13px] font-extrabold text-ink-900"><Award className="size-4 text-signal-600" />Eligible & ranked ({data.eligible_hospitals.length})</p>
          <div className="space-y-3">
            {data.eligible_hospitals.map((h) => (
              <div key={h.id} className={h.rank === 1 ? 'rounded-2xl border border-signal-300 bg-signal-50/40 p-4 ring-4 ring-signal-100' : 'rounded-2xl border border-ink-100 bg-white p-4'}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={h.rank === 1 ? 'inline-flex size-8 items-center justify-center rounded-xl bg-signal-600 text-[12px] font-extrabold text-white' : 'inline-flex size-8 items-center justify-center rounded-xl bg-ink-50 text-[12px] font-extrabold text-ink-600'}>#{h.rank}</span>
                    <span className="truncate text-[14.5px] font-bold text-ink-900">{cleanName(h.name)}</span>
                    {h.rank === 1 && <Badge tone="signal" small>Optimal</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-[12.5px] font-semibold text-ink-500">
                    <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5 text-ink-400" />{h.eta_minutes} min · {h.distance_km} km</span>
                    <span className="rounded-lg bg-ink-900 px-2.5 py-1 font-extrabold text-white tabnum">{h.score.toFixed(1)}</span>
                  </div>
                </div>

                {h.score_breakdown && (
                  <div className="mt-4 space-y-2">
                    {FACTORS.map((f) => {
                      const v = Math.round((h.score_breakdown as any)[f.key] ?? 0);
                      return (
                        <div key={f.key} className="flex items-center gap-3 text-[12px]">
                          <span className="w-24 shrink-0 font-semibold text-ink-500">{f.label} <span className="text-ink-300">{f.weight}%</span></span>
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100"><span className="block h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, v)}%`, background: f.color }} /></span>
                          <span className="w-9 shrink-0 text-right font-extrabold text-ink-800 tabnum">{v}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {h.why_selected?.length > 0 && (
                  <div className="mt-3.5 flex flex-wrap gap-1.5">
                    {h.why_selected.map((w, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-signal-100 bg-signal-50 px-2 py-1 text-[11.5px] font-semibold text-signal-800"><CheckCircle2 className="size-3" />{w}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {data.excluded_hospitals?.length > 0 && (
          <div>
            <p className="mb-3 flex items-center gap-2 text-[13px] font-extrabold text-ink-900"><X className="size-4 text-alert-600" />Excluded by safety filters ({data.excluded_hospitals.length})</p>
            <div className="space-y-2">
              {data.excluded_hospitals.map((h) => (
                <div key={h.id} className="flex flex-col gap-1.5 rounded-2xl border border-ink-100 bg-ink-25 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <span className="inline-flex items-center gap-2.5 text-[13px] font-bold text-ink-800"><span className="inline-flex size-5 items-center justify-center rounded-full bg-alert-100 text-alert-600"><Check className="hidden" /><X className="size-3" strokeWidth={3} /></span>{cleanName(h.name)}</span>
                  <Badge tone="alert" className="self-start">{h.rejection_reason || h.why_excluded || 'Failed a hard constraint'}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
