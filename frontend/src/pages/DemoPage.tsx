import React from 'react';
import type { OneClickDemoResult } from '../types';
import { 
  Zap, 
  CheckCircle2, 
  XCircle, 
  ShieldAlert, 
  ArrowRight, 
  Building2, 
  Clock, 
  Award, 
  RefreshCw,
  ChevronRight,
  Brain,
  ShieldCheck
} from 'lucide-react';

interface DemoPageProps {
  isDemoRunning: boolean;
  demoResult: OneClickDemoResult | null;
  onRunDemo: () => void;
  onViewExplanations: (emergencyId: string) => void;
  onViewCommand: () => void;
}

export const DemoPage: React.FC<DemoPageProps> = ({
  isDemoRunning,
  demoResult,
  onRunDemo,
  onViewExplanations,
  onViewCommand
}) => {
  const STEPS = [
    { num: 1, title: "Incident Intake", icon: ShieldAlert, color: "text-rose-600 bg-rose-50 border-rose-200" },
    { num: 2, title: "Clinical Triage", icon: Brain, color: "text-blue-600 bg-blue-50 border-blue-200" },
    { num: 3, title: "Hard Safety Gate", icon: Award, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
    { num: 4, title: "Facility #1 Ping", icon: Building2, color: "text-purple-600 bg-purple-50 border-purple-200" },
    { num: 5, title: "Surge Reject", icon: XCircle, color: "text-amber-600 bg-amber-50 border-amber-200" },
    { num: 6, title: "Auto Failover", icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
    { num: 7, title: "Bed Reserved", icon: ArrowRight, color: "text-teal-600 bg-teal-50 border-teal-200" },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Action Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-black border border-amber-200">
              End-to-End Stress Test
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Automated Failover Simulation
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 max-w-2xl leading-relaxed">
            Simulate critical trauma intake, immediate rejection from primary hospital due to sudden bed surge, and deterministic sub-second failover with guaranteed bed reservation at secondary hospital.
          </p>
        </div>

        <button
          onClick={onRunDemo}
          disabled={isDemoRunning}
          className="flex items-center gap-2 px-6 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl shadow-md shadow-amber-500/20 transition disabled:opacity-50 shrink-0 cursor-pointer"
        >
          {isDemoRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Simulating Triage...</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 fill-white" />
              <span>RUN FAILOVER SCENARIO</span>
            </>
          )}
        </button>
      </div>

      {/* 7-Step Progression Horizontal Chips */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Algorithmic Lifecycle</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {STEPS.map((step) => (
            <div 
              key={step.num}
              className={`p-3.5 rounded-xl border flex flex-col items-center text-center space-y-2 transition-all ${
                demoResult 
                  ? 'bg-white border-slate-300 shadow-2xs' 
                  : 'bg-slate-50 border-slate-200/80'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${step.color}`}>
                <step.icon className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400">Step 0{step.num}</div>
                <span className="text-xs font-black text-slate-900 leading-tight block mt-0.5">
                  {step.title}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Result Cards */}
      {demoResult && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900">{demoResult.scenario_name}</h3>
                <span className="text-xs text-slate-500 font-mono font-bold">Incident Ref: {demoResult.incident_reference}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onViewExplanations(demoResult.emergency_id)}
                className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Explainability Audit
              </button>
              <button
                onClick={onViewCommand}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <span>Command Center</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reported Incident</span>
              <div className="text-sm font-black text-slate-900">Motorcycle Collision</div>
              <div className="text-xs text-rose-700 font-bold">Severity: Critical</div>
            </div>

            <div className="p-4 bg-rose-50/60 rounded-xl border border-rose-200 space-y-1">
              <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Hospital #1 (Diverted)</span>
              <div className="text-xs font-black text-slate-900 truncate">{demoResult.first_hospital_attempted.name.replace('SIMULATED HOSPITAL — ', '')}</div>
              <div className="text-xs text-rose-700 font-bold">Rejected (Bed Surge Divert)</div>
            </div>

            <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 space-y-1">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Failover Speed</span>
              <div className="text-lg font-black text-amber-900">&lt; 500 ms</div>
              <div className="text-xs text-amber-800 font-bold">Zero manual intervention</div>
            </div>

            <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-1">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Final Destination</span>
              <div className="text-xs font-black text-slate-900 truncate">{demoResult.second_hospital_attempted.name.replace('SIMULATED HOSPITAL — ', '')}</div>
              <div className="text-xs text-emerald-700 font-bold">Confirmed Bed &bull; ETA {demoResult.eta_minutes}m</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};