import React, { useState, useEffect } from 'react';
import { ApiService } from '../services/api';
import type { Hospital, Emergency, Match, Referral, AuditEvent, GovernorStatistics, AppNotification, UserRole } from '../types';
import { clockTime } from '../utils/time';
import { MapComponent } from '../components/MapComponent';
import { 
  ShieldAlert, 
  Activity, 
  Building2, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Bed,
  Stethoscope,
  ChevronRight,
  Sliders,
  Send,
  Flame,
  HeartPulse,
  Car,
  MapPin,
  Check,
  Bell,
  AlertTriangle,
  LogIn
} from 'lucide-react';

interface GovernorCommandPageProps {
  hospitals: Hospital[];
  onRefreshHospitals: () => void;
  activeEmergency: Emergency | null;
  onOpenExplain: (emergencyId: string) => void;
  onNavigateToHospital: () => void;
  onEmergencyTriggered?: (emergency: Emergency) => void;
  currentRole?: UserRole;
}

const EMPTY_STATS: GovernorStatistics = {
  total_emergencies: 0,
  active_emergencies: 0,
  total_hospitals: 0,
  hospitals_accepting: 0,
  total_beds: 0,
  available_beds: 0,
  referrals_accepted: 0,
  referrals_rejected: 0,
  referrals_timed_out: 0,
  reroutes_count: 0,
  average_matching_time_ms: 0,
  stale_hospitals_count: 0
};

const QUICK_PRESETS = [
  {
    title: "Motorcycle Trauma",
    location: "Admiralty Way, Lekki",
    category: "Road accident",
    lat: 6.4474,
    lng: 3.4731,
    description: "High-speed motorcycle collision with severe head injury and active hemorrhage.",
    icon: Car,
    severity: "CRITICAL",
    patients: 1
  },
  {
    title: "Acute Chest Pain / STEMI",
    location: "Ozumba Mbadiwe, VI",
    category: "Chest pain",
    lat: 6.4281,
    lng: 3.4219,
    description: "55yo male experiencing severe substernal pressure, diaphoresis and acute ischemia.",
    icon: HeartPulse,
    severity: "CRITICAL",
    patients: 1
  },
  {
    title: "Highway Multi-Rollover",
    location: "Third Mainland Bridge",
    category: "Road accident",
    lat: 6.4712,
    lng: 3.3982,
    description: "3-car pileup with trapped passengers requiring trauma surgery and ICU admission.",
    icon: Flame,
    severity: "CRITICAL",
    patients: 3
  }
];

export const GovernorCommandPage: React.FC<GovernorCommandPageProps> = ({
  hospitals,
  onRefreshHospitals,
  activeEmergency,
  onOpenExplain,
  onNavigateToHospital,
  onEmergencyTriggered,
  currentRole = 'ADMIN'
}) => {
  const [stats, setStats] = useState<GovernorStatistics>(EMPTY_STATS);
  const [liveEmergency, setLiveEmergency] = useState<Emergency | null>(activeEmergency);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [timeline, setTimeline] = useState<AuditEvent[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeReferrals, setActiveReferrals] = useState<Referral[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTriggeringPreset, setIsTriggeringPreset] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [statsData, timelineData, referralsData, notifData] = await Promise.all([
        ApiService.getStatistics().catch(() => null),
        ApiService.getTimeline().catch(() => ({ events: [] })),
        ApiService.getReferrals().catch(() => null),
        ApiService.getNotifications(8).catch(() => [])
      ]);
      if (!statsData) {
        setLoadError('Cannot reach the ER-Sync backend. Figures below are not live.');
      } else {
        setLoadError(null);
        setStats(statsData);
      }
      if (timelineData && timelineData.events) setTimeline(timelineData.events);
      if (referralsData) setActiveReferrals(referralsData);
      setNotifications(notifData || []);

      if (activeEmergency) {
        const fresh = await ApiService.getEmergency(activeEmergency.id).catch(() => null);
        if (fresh) setLiveEmergency(fresh);
        const matchRes = await ApiService.getMatches(activeEmergency.id).catch(() => ({ matches: [] }));
        if (matchRes && matchRes.matches) {
          setMatches(matchRes.matches);
          const topMatch = matchRes.matches.find((m: Match) => m.eligibility && m.rank === 1);
          if (topMatch) {
            const hosp = hospitals.find(h => h.id === topMatch.hospital_id);
            if (hosp) setSelectedHospital(hosp);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load command data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setLiveEmergency(activeEmergency);
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [activeEmergency]);

  const runCaseAction = async (label: string, fn: () => Promise<any>) => {
    try {
      await fn();
      setActionMsg({ ok: true, text: label });
      fetchData();
      onRefreshHospitals();
    } catch (e: any) {
      setActionMsg({ ok: false, text: e?.message || 'Action failed' });
    }
    setTimeout(() => setActionMsg(null), 5000);
  };

  const handleQuickTrigger = async (preset: typeof QUICK_PRESETS[0]) => {
    setIsTriggeringPreset(true);
    try {
      const em = await ApiService.createEmergency({
        latitude: preset.lat,
        longitude: preset.lng,
        location_name: preset.location,
        description: preset.description,
        category: preset.category,
        patient_count: preset.patients,
        caller_phone: "+234 802 000 1122"
      });
      if (onEmergencyTriggered) {
        onEmergencyTriggered(em);
      }
      fetchData();
      onRefreshHospitals();
    } catch (e: any) {
      setActionMsg({ ok: false, text: e?.message || 'Failed to trigger emergency' });
      setTimeout(() => setActionMsg(null), 5000);
    } finally {
      setIsTriggeringPreset(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {loadError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}
      {actionMsg && (
        <div className={`p-3 rounded-xl text-xs font-bold border ${actionMsg.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
          {actionMsg.text}
        </div>
      )}

      {/* 6-Metric KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hospitals Online</span>
          <div className="text-xl sm:text-2xl font-black text-slate-900">{stats.hospitals_accepting} / {stats.total_hospitals}</div>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Free Beds</span>
          <div className="text-xl sm:text-2xl font-black text-blue-600">{stats.available_beds} / {stats.total_beds}</div>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Match Latency</span>
          <div className="text-xl sm:text-2xl font-black text-slate-900">{stats.average_matching_time_ms > 0 ? `${Math.round(stats.average_matching_time_ms)} ms` : '—'}</div>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Triage</span>
          <div className="text-xl sm:text-2xl font-black text-slate-900">{stats.total_emergencies}</div>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Admitted</span>
          <div className="text-xl sm:text-2xl font-black text-emerald-600">{stats.referrals_accepted}</div>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Failovers</span>
          <div className="text-xl sm:text-2xl font-black text-amber-600">{stats.reroutes_count}</div>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Active Incident & Candidates */}
        <div className="lg:col-span-7 space-y-6">
          {activeEmergency && liveEmergency ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
              {/* Emergency Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-xs font-black border border-rose-200 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
                      {liveEmergency.severity}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-500">
                      {liveEmergency.incident_reference}
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                      liveEmergency.status === 'NO_MATCH' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      liveEmergency.status === 'AWAITING_ACCEPTANCE' || liveEmergency.status === 'REROUTING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      liveEmergency.status === 'CLOSED' || liveEmergency.status === 'CANCELLED' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                      'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {liveEmergency.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                    {liveEmergency.category} &bull; {liveEmergency.patient_count} Casualty
                  </h2>
                  <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {liveEmergency.location_name}
                  </p>
                </div>

                <button
                  onClick={() => onOpenExplain(liveEmergency.id)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition self-start cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Explainability Audit</span>
                </button>
              </div>

              {/* Case lifecycle actions */}
              {(currentRole === 'ADMIN' || currentRole === 'HOSPITAL_STAFF') && (
                <div className="flex flex-wrap gap-2">
                  {liveEmergency.status === 'NO_MATCH' && (
                    <button
                      onClick={() => runCaseAction('Re-dispatched on live hospital data', () => ApiService.redispatchEmergency(liveEmergency.id))}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Retry dispatch
                    </button>
                  )}
                  {liveEmergency.status === 'PATIENT_EN_ROUTE' && (
                    <button
                      onClick={() => runCaseAction('Patient marked arrived - bed now occupied', () => ApiService.markArrived(liveEmergency.id))}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" /> Mark patient arrived
                    </button>
                  )}
                  {(liveEmergency.status === 'ARRIVED' || liveEmergency.status === 'PATIENT_EN_ROUTE') && (
                    <button
                      onClick={() => runCaseAction('Case closed - bed released', () => ApiService.closeCase(liveEmergency.id))}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> Close case &amp; release bed
                    </button>
                  )}
                </div>
              )}
              {liveEmergency.status === 'NO_MATCH' && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold">
                  No eligible hospital right now (all rejected, timed out, or fail a mandatory requirement). Check the audit trail, then retry.
                </div>
              )}

              {/* Requirements Chips */}
              {liveEmergency.requirements && liveEmergency.requirements.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {liveEmergency.requirements.map((req, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 text-xs bg-slate-50 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg font-bold"
                    >
                      {req.requirement_type === 'SPECIALTY' ? (
                        <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
                      ) : req.requirement_type === 'FACILITY' ? (
                        <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                      ) : (
                        <Bed className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                      <span>{req.requirement_name}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Candidate Rankings */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <span>Candidate Facility Rankings</span>
                  <span>Match Score</span>
                </div>

                <div className="space-y-2.5">
                  {matches.filter(m => m.eligibility).slice(0, 4).map((match, idx) => {
                    const hosp = hospitals.find(h => h.id === match.hospital_id);
                    const isTop = match.rank === 1;

                    return (
                      <div
                        key={match.id || idx}
                        onClick={() => hosp && setSelectedHospital(hosp)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer ${
                          selectedHospital?.id === hosp?.id
                            ? 'bg-blue-50/40 border-blue-400 ring-2 ring-blue-100 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                              isTop ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700'
                            }`}>
                              #{match.rank}
                            </span>
                            <div>
                              <div className="text-xs sm:text-sm font-black text-slate-900">
                                {hosp?.name.replace('SIMULATED HOSPITAL — ', '') || match.hospital_id}
                              </div>
                              <div className="text-[11px] text-slate-500 font-medium">
                                {match.eta_minutes}m ETA &bull; {match.distance_km} km &bull; {hosp?.available_emergency_beds || 0} beds free
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5">
                            {isTop && (
                              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md hidden sm:inline">
                                RECOMMENDED
                              </span>
                            )}
                            <span className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-xs font-black">
                              {Math.round(match.score)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Quick Dispatch Simulator */
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-black text-slate-900">Instant Incident Triage</h3>
                </div>
                <span className="text-[11px] font-bold text-slate-400">Select to simulate</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {QUICK_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickTrigger(p)}
                    disabled={isTriggeringPreset}
                    className="p-3.5 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 rounded-xl text-left transition space-y-2 group cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 group-hover:text-blue-600 transition">
                        <p.icon className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded">
                        {p.severity}
                      </span>
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 group-hover:text-blue-600 transition">
                        {p.title}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                        {p.location}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Referral Dispatches */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs font-bold text-slate-900">
              <span className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" />
                Live Dispatches &amp; Bed Reservations
              </span>
              <span className="text-slate-400 font-bold">{activeReferrals.filter(r => r.status === 'REQUESTED' || r.status === 'ACCEPTED').length} Active</span>
            </div>

            {activeReferrals.some(r => r.status === 'REQUESTED' || r.status === 'ACCEPTED') ? (
              <div className="space-y-2">
                {activeReferrals.filter(r => r.status === 'REQUESTED' || r.status === 'ACCEPTED').slice(0, 5).map((ref) => (
                  <div key={ref.id} className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-black text-slate-900">{ref.hospital_name || ref.hospital_id}</div>
                      <div className="text-[11px] text-slate-500 font-medium">ETA: {ref.eta_minutes}m &bull; Ref: {ref.id.slice(0, 8)}</div>
                    </div>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${
                      ref.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-800' :
                      ref.status === 'REJECTED' || ref.status === 'TIMEOUT' ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {ref.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-3 text-center font-medium">No active patient dispatches in queue.</div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Map & Timeline */}
        <div className="lg:col-span-5 space-y-6">
          <MapComponent
            hospitals={hospitals}
            emergency={activeEmergency}
            selectedHospital={selectedHospital}
            height="320px"
            onSelectHospital={setSelectedHospital}
          />

          {/* Audit Timeline */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs font-bold text-slate-900">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-500" />
                Live Dispatch Audit Trail
              </span>
              <button onClick={fetchData} className="text-blue-600 hover:text-blue-800 font-bold cursor-pointer">
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {timeline.slice(0, 6).map((evt, idx) => (
                <div key={evt.id || idx} className="flex items-start gap-2.5 text-xs pb-2 border-b border-slate-100 last:border-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0"></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 truncate">{(evt as any).event_type || evt.action}</span>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-1">
                        {clockTime(evt.created_at || (evt as any).timestamp)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{(evt.metadata as any)?.hospital_name || (evt.metadata as any)?.reason || (evt.metadata as any)?.trigger || evt.entity_type}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dispatch notifications */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100 text-xs font-bold text-slate-900">
              <Bell className="w-4 h-4 text-slate-500" />
              Alerts &amp; Notifications
            </div>
            {notifications.length > 0 ? (
              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                {notifications.map((n) => (
                  <div key={n.id} className="text-xs pb-2 border-b border-slate-100 last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 truncate">{n.title}</span>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">{clockTime(n.created_at)}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{n.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-2 text-center font-medium">No alerts yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
