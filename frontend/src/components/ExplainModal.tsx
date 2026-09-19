import React from 'react';
import { 
  X, 
  CheckCircle2, 
  XCircle, 
  Layers, 
  Clock, 
  Activity,
  Award,
  ShieldAlert,
  Sliders
} from 'lucide-react';

interface ExplainModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    emergency_id: string;
    summary: string;
    eligible_hospitals: Array<{
      id: string;
      name: string;
      rank: number;
      score: number;
      eta_minutes: number;
      distance_km: number;
      score_breakdown?: {
        capability_score: number;
        eta_score: number;
        capacity_score: number;
        specialist_score: number;
        freshness_score: number;
        final_score: number;
        weights_applied: Record<string, number>;
      };
      why_selected: string[];
    }>;
    excluded_hospitals: Array<{
      id: string;
      name: string;
      eligibility: boolean;
      rejection_reason: string;
      why_excluded: string;
    }>;
  } | null;
}

export const ExplainModal: React.FC<ExplainModalProps> = ({ isOpen, onClose, data }) => {
  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700 border border-blue-200">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">ER-Sync Decision Explainability Engine</h2>
              <p className="text-xs text-slate-500">
                Transparent mathematical audit trail &amp; deterministic hard filter breakdown
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Summary Banner */}
          <div className="bg-blue-50/60 border border-blue-200 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">ER-Sync Evaluation Summary</div>
              <div className="text-sm font-semibold text-slate-900">{data.summary}</div>
            </div>
            <div className="text-xs text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs shrink-0">
              Incident Ref: <span className="text-slate-900 font-mono font-medium">{data.emergency_id.slice(0, 8)}</span>
            </div>
          </div>

          {/* Section 1: Eligible & Ranked Candidates */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Eligible &amp; Ranked Candidates ({data.eligible_hospitals.length})
              </h3>
            </div>

            <div className="space-y-3">
              {data.eligible_hospitals.map(hosp => (
                <div 
                  key={hosp.id} 
                  className={`p-4 rounded-xl border transition-all ${
                    hosp.rank === 1 
                      ? 'bg-blue-50/30 border-blue-300 ring-1 ring-blue-200' 
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                        hosp.rank === 1 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-slate-100 text-slate-700 border border-slate-300'
                      }`}>
                        #{hosp.rank}
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        {hosp.name.replace('SIMULATED HOSPITAL — ', '')}
                      </span>
                      {hosp.rank === 1 && (
                        <span className="text-[10px] uppercase font-bold bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                          Optimal Destination
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <div className="text-slate-600 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>ETA: <strong className="text-slate-900">{hosp.eta_minutes}m</strong> ({hosp.distance_km} km)</span>
                      </div>
                      <div className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg font-bold border border-slate-200">
                        Score: {hosp.score.toFixed(1)}/100
                      </div>
                    </div>
                  </div>

                  {/* Multi-Factor Scoring Breakdown */}
                  {hosp.score_breakdown && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-3 border-t border-slate-100 text-[11px]">
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <div className="text-slate-500 text-[10px]">Capability (40%)</div>
                        <div className="font-bold text-slate-900">{Math.round(hosp.score_breakdown.capability_score)}%</div>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <div className="text-slate-500 text-[10px]">ETA Proximity (30%)</div>
                        <div className="font-bold text-slate-900">{Math.round(hosp.score_breakdown.eta_score)}%</div>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <div className="text-slate-500 text-[10px]">Bed Capacity (15%)</div>
                        <div className="font-bold text-slate-900">{Math.round(hosp.score_breakdown.capacity_score)}%</div>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <div className="text-slate-500 text-[10px]">Specialists (10%)</div>
                        <div className="font-bold text-slate-900">{Math.round(hosp.score_breakdown.specialist_score)}%</div>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <div className="text-slate-500 text-[10px]">Freshness (5%)</div>
                        <div className="font-bold text-slate-900">{Math.round(hosp.score_breakdown.freshness_score)}%</div>
                      </div>
                    </div>
                  )}

                  {/* Positive factors */}
                  {hosp.why_selected && hosp.why_selected.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {hosp.why_selected.map((factor, idx) => (
                        <span key={idx} className="flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-medium">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          {factor}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Excluded Candidates via Hard Filters */}
          {data.excluded_hospitals && data.excluded_hospitals.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="w-4 h-4 text-rose-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Excluded Hospitals ({data.excluded_hospitals.length}) &mdash; Hard Safety Filters Triggered
                </h3>
              </div>

              <div className="space-y-2">
                {data.excluded_hospitals.map(hosp => (
                  <div key={hosp.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-xs font-bold">
                        <X className="w-3 h-3 text-rose-600" />
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {hosp.name.replace('SIMULATED HOSPITAL — ', '')}
                      </span>
                    </div>

                    <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg font-medium self-start sm:self-auto">
                      {hosp.rejection_reason || hosp.why_excluded || 'Failed Hard Filter Constraint'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            Close Breakdown
          </button>
        </div>
      </div>
    </div>
  );
};
