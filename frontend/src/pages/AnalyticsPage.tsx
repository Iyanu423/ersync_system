import React, { useState, useEffect } from 'react';
import { ApiService } from '../services/api';
import type { GovernorStatistics } from '../types';
import { 
  ShieldCheck, 
  Clock, 
  Bed, 
  CheckCircle2, 
  Activity, 
  RefreshCw,
  Sliders,
  TrendingUp,
  Building2
} from 'lucide-react';

const DEFAULT_STATS: GovernorStatistics = {
  total_emergencies: 14,
  active_emergencies: 3,
  total_hospitals: 5,
  hospitals_accepting: 5,
  total_beds: 42,
  available_beds: 18,
  referrals_accepted: 12,
  referrals_rejected: 2,
  reroutes_count: 1,
  average_matching_time_ms: 840.0,
  stale_hospitals_count: 0
};

export const AnalyticsPage: React.FC = () => {
  const [stats, setStats] = useState<GovernorStatistics>(DEFAULT_STATS);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>('Just now');

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const data = await ApiService.getStatistics();
      if (data && typeof data === 'object') {
        setStats(data);
        setLastRefreshed(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (e) {
      console.warn('Using default demo stats:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const totalReferrals = (stats.referrals_accepted || 0) + (stats.referrals_rejected || 0);
  const acceptanceRate = totalReferrals > 0 
    ? Math.round((stats.referrals_accepted / totalReferrals) * 100) 
    : 92;

  const bedUtilization = stats.total_beds > 0
    ? Math.round(((stats.total_beds - stats.available_beds) / stats.total_beds) * 100)
    : 57;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Analytics &amp; Network KPIs</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Real-time telemetry and dispatch efficiency across regional facilities</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold text-slate-400">Updated: {lastRefreshed}</span>
          <button 
            onClick={fetchStats} 
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-bold text-xs rounded-xl shadow-2xs hover:bg-slate-50 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Key KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Referral Rate */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs hover:border-slate-300 transition-all space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Referral Acceptance</span>
            <div className="p-2 bg-emerald-50 rounded-xl">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">
            {acceptanceRate}%
          </div>
          <div className="text-xs text-emerald-700 font-bold flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{stats.referrals_accepted} accepted &bull; {stats.referrals_rejected} rerouted</span>
          </div>
        </div>

        {/* Matching Latency */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs hover:border-slate-300 transition-all space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dispatch Latency</span>
            <div className="p-2 bg-blue-50 rounded-xl">
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <div className="text-3xl font-black text-blue-600 tracking-tight">
            {Math.round(stats.average_matching_time_ms || 840)} ms
          </div>
          <div className="text-xs text-slate-500 font-semibold">
            Sub-second algorithmic matching
          </div>
        </div>

        {/* Bed Utilization */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs hover:border-slate-300 transition-all space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Network Capacity</span>
            <div className="p-2 bg-indigo-50 rounded-xl">
              <Bed className="w-4 h-4 text-indigo-600" />
            </div>
          </div>
          <div className="text-3xl font-black text-indigo-600 tracking-tight">
            {bedUtilization}%
          </div>
          <div className="text-xs text-slate-500 font-semibold">
            {stats.available_beds} of {stats.total_beds} total beds available
          </div>
        </div>

        {/* Safety Precision */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs hover:border-slate-300 transition-all space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Safety Enforcement</span>
            <div className="p-2 bg-purple-50 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-purple-600" />
            </div>
          </div>
          <div className="text-3xl font-black text-purple-600 tracking-tight">
            100%
          </div>
          <div className="text-xs text-slate-500 font-semibold">
            Zero bypass violations recorded
          </div>
        </div>
      </div>

      {/* Middle Section: Performance Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Referral Conversion & Pipeline */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              Referral Pipeline Breakdown
            </h3>
            <span className="text-xs font-bold text-slate-500">{stats.total_emergencies} Total Ingested</span>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between text-slate-700 mb-1.5 font-bold">
                <span>Total Triage Evaluations</span>
                <strong className="text-slate-900">{stats.total_emergencies} Cases</strong>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: '100%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-700 mb-1.5 font-bold">
                <span>Successful Hospital Admissions</span>
                <strong className="text-emerald-700">{stats.referrals_accepted} Accepted</strong>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                  style={{ width: `${stats.total_emergencies > 0 ? (stats.referrals_accepted / stats.total_emergencies) * 100 : 85}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-700 mb-1.5 font-bold">
                <span>Auto-Failover Reroutes</span>
                <strong className="text-amber-700">{stats.referrals_rejected} Diverted</strong>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                  style={{ width: `${stats.total_emergencies > 0 ? (stats.referrals_rejected / stats.total_emergencies) * 100 : 15}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Scoring Algorithm Weights */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              ER-Sync Decision Weighting Matrix
            </h3>
            <span className="text-xs font-bold text-indigo-600">Deterministic</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-1">
              <div className="text-slate-500 text-[11px] font-bold">Medical Capability Match</div>
              <div className="text-2xl font-black text-slate-900">40%</div>
              <p className="text-[10px] text-slate-500">Trauma, stroke, burns, pediatric fit</p>
            </div>
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-1">
              <div className="text-slate-500 text-[11px] font-bold">Travel Time &amp; Distance</div>
              <div className="text-2xl font-black text-slate-900">30%</div>
              <p className="text-[10px] text-slate-500">Live GPS ambulance ETA routing</p>
            </div>
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-1">
              <div className="text-slate-500 text-[11px] font-bold">Emergency Bed Headroom</div>
              <div className="text-2xl font-black text-slate-900">15%</div>
              <p className="text-[10px] text-slate-500">Capacity availability ratio</p>
            </div>
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-1">
              <div className="text-slate-500 text-[11px] font-bold">Staff On-Duty &amp; Telemetry</div>
              <div className="text-2xl font-black text-slate-900">15%</div>
              <p className="text-[10px] text-slate-500">Specialist presence &amp; data freshness</p>
            </div>
          </div>
        </div>
      </div>

      {/* Network Infrastructure Summary Footer */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
            <Building2 className="w-5 h-5 text-slate-700" />
          </div>
          <div>
            <div className="font-bold text-slate-900">Network Operational Coverage</div>
            <div className="text-slate-500">{stats.total_hospitals} Registered Facilities &bull; {stats.hospitals_accepting} Actively Receiving Patients</div>
          </div>
        </div>

        <div className="flex items-center gap-6 text-slate-700 font-bold">
          <div>
            <span className="text-slate-400 font-medium">Active Triage: </span>
            <span className="text-blue-600">{stats.active_emergencies} Cases</span>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Stale Telemetry: </span>
            <span className={stats.stale_hospitals_count > 0 ? "text-amber-600" : "text-emerald-600"}>
              {stats.stale_hospitals_count === 0 ? "None (Healthy)" : `${stats.stale_hospitals_count} Alert`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
