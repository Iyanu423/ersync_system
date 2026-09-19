import React from 'react';
import type { OneClickDemoResult } from '../types';
import { 
  Zap, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  RefreshCw,
  Clock,
  ShieldCheck,
  ChevronRight,
  Brain,
  Building2,
  PhoneCall
} from 'lucide-react';

interface DemoBannerProps {
  isRunning: boolean;
  demoResult: OneClickDemoResult | null;
  onRunDemo: () => void;
  onViewExplanations?: (emergencyId: string) => void;
}

export const DemoBanner: React.FC<DemoBannerProps> = ({
  isRunning,
  demoResult,
  onRunDemo,
  onViewExplanations
}) => {
  return (
    <div className="bg-amber-50/80 border-b border-amber-200 px-4 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-800 border border-amber-300">
              <Zap className="w-5 h-5 fill-amber-500 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-900">Live Demonstration Scenario</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  Automated Failover
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Simulates critical trauma intake &rarr; AI Triage &rarr; Governor hard filter &rarr; Primary rejection &rarr; Auto-failover to secondary hospital &rarr; Bed reservation.
              </p>
            </div>
          </div>

          <button
            onClick={onRunDemo}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-all disabled:opacity-50 whitespace-nowrap"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Executing Scenario...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-white" />
                Run Failover Demo
              </>
            )}
          </button>
        </div>

        {/* Live Step Results Timeline */}
        {demoResult && (
          <div className="mt-1 bg-white rounded-xl p-4 border border-amber-200 shadow-xs">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900">{demoResult.scenario_name}</span>
                <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Ref: {demoResult.incident_reference}
                </span>
              </div>

              {onViewExplanations && (
                <button
                  onClick={() => onViewExplanations(demoResult.emergency_id)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 hover:underline"
                >
                  View Decision Explainability Breakdown
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Step Chips Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
              {/* Step 1: AI Triage */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700 uppercase tracking-wider mb-1">
                  <Brain className="w-3.5 h-3.5" />
                  1. AI Clinical Triage
                </div>
                <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 border border-rose-200 rounded text-[10px] font-bold">CRITICAL</span>
                  <span>Surgery + CT + Beds</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Structured requirements parsed</div>
              </div>

              {/* Step 2: Hospital #1 Contact & Rejection */}
              <div className="bg-rose-50/50 p-3 rounded-lg border border-rose-200">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700 uppercase tracking-wider mb-1">
                  <Building2 className="w-3.5 h-3.5" />
                  2. Contact Hospital #1
                </div>
                <div className="text-xs font-semibold text-slate-900 truncate">{demoResult.first_hospital_attempted.name.replace('SIMULATED HOSPITAL — ', '')}</div>
                <div className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-rose-500" />
                  Rejected (Trauma Surge)
                </div>
              </div>

              {/* Step 3: Automatic Failover */}
              <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-200">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-1">
                  <RefreshCw className="w-3.5 h-3.5" />
                  3. Auto-Failover
                </div>
                <div className="text-xs font-semibold text-amber-900">Rank #2 Selected</div>
                <div className="text-[11px] text-slate-600 mt-1">Zero human delay failover</div>
              </div>

              {/* Step 4: Hospital #2 Accepted & Confirmed */}
              <div className="bg-emerald-50/60 p-3 rounded-lg border border-emerald-200">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  4. Confirmed Destination
                </div>
                <div className="text-xs font-semibold text-emerald-950 truncate">{demoResult.second_hospital_attempted.name.replace('SIMULATED HOSPITAL — ', '')}</div>
                <div className="text-[11px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Bed Reserved &bull; ETA {demoResult.eta_minutes}m
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
