import React, { useState, useEffect } from 'react';
import { ApiService } from '../services/api';
import type { Hospital, Referral } from '../types';
import { clockTime } from '../utils/time';
import { 
  Building2, 
  Bed, 
  Stethoscope, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Phone, 
  MapPin, 
  Plus, 
  Minus, 
  RefreshCw,
  Inbox,
  Check
} from 'lucide-react';

interface HospitalDashboardPageProps {
  hospitals: Hospital[];
  selectedHospitalId: string;
  onSelectHospitalId: (id: string) => void;
  onRefreshHospitals: () => Promise<void>;
}

const DEFAULT_FALLBACK_HOSPITAL: Hospital = {
  id: 'hosp_lagos_central',
  name: 'Lagos Central Trauma Centre',
  address: 'Lagos Island Medical District, Broad Street, Lagos',
  latitude: 6.4531,
  longitude: 3.3958,
  phone: '+234 1 234 5678',
  emergency_status: 'OPEN',
  overall_capacity: 75,
  accepting_emergencies: true,
  last_status_update: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_stale: false,
  freshness_category: 'FRESH',
  available_emergency_beds: 18,
  total_emergency_beds: 25,
  specialties: [
    { specialty_name: 'General Medicine', available_count: 3, status: 'AVAILABLE' },
    { specialty_name: 'Surgery', available_count: 2, status: 'AVAILABLE' },
    { specialty_name: 'Orthopaedics', available_count: 1, status: 'AVAILABLE' },
    { specialty_name: 'Neurosurgery', available_count: 1, status: 'AVAILABLE' },
    { specialty_name: 'Cardiology', available_count: 1, status: 'AVAILABLE' },
    { specialty_name: 'Paediatrics', available_count: 2, status: 'AVAILABLE' },
    { specialty_name: 'Anaesthesia', available_count: 2, status: 'AVAILABLE' },
  ],
  facilities: [
    { facility_name: 'Emergency Department', available: true, quantity: 1, status: 'OPERATIONAL' },
    { facility_name: 'Operating Theatre', available: true, quantity: 3, status: 'OPERATIONAL' },
    { facility_name: 'ICU (Intensive Care)', available: true, quantity: 8, status: 'OPERATIONAL' },
    { facility_name: 'CT Scanner', available: true, quantity: 1, status: 'OPERATIONAL' },
    { facility_name: 'X-Ray Imaging', available: true, quantity: 2, status: 'OPERATIONAL' },
    { facility_name: 'Blood Bank', available: true, quantity: 1, status: 'OPERATIONAL' },
  ]
};

export const HospitalDashboardPage: React.FC<HospitalDashboardPageProps> = ({ 
  hospitals,
  selectedHospitalId,
  onRefreshHospitals 
}) => {
  const initialHospital = hospitals.find(h => h.id === selectedHospitalId) || hospitals[0] || DEFAULT_FALLBACK_HOSPITAL;
  
  const [hospital, setHospital] = useState<Hospital>(initialHospital);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'specialists' | 'facilities' | 'referrals'>('overview');
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [toastIsError, setToastIsError] = useState(false);

  useEffect(() => {
    const matched = hospitals.find(h => h.id === selectedHospitalId);
    if (matched) {
      setHospital(matched);
    }
  }, [selectedHospitalId, hospitals]);

  const loadHospitalData = async () => {
    const targetId = selectedHospitalId || hospital.id;
    try {
      const [hData, refs] = await Promise.all([
        ApiService.getHospital(targetId).catch(() => null),
        ApiService.getReferrals(undefined, targetId).catch(() => null)
      ]);
      if (hData) setHospital(hData);
      if (refs) setReferrals(refs);
    } catch (e) {
      console.error('Failed to load hospital details', e);
    }
  };

  useEffect(() => {
    loadHospitalData();
    // New referrals arrive while this page is open - poll so staff actually see them
    const interval = setInterval(loadHospitalData, 5000);
    return () => clearInterval(interval);
  }, [selectedHospitalId]);

  const handleStatusChange = async (newStatus: 'OPEN' | 'LIMITED' | 'CLOSED') => {
    try {
      setHospital(prev => ({ ...prev, emergency_status: newStatus }));
      await ApiService.updateHospitalStatus(hospital.id, newStatus, hospital.accepting_emergencies);
      showNotification(`Emergency status set to ${newStatus}`);
      onRefreshHospitals();
    } catch (e) {
      failAndResync('Status change', e);
    }
  };

  const handleToggleAccepting = async () => {
    const newVal = !hospital.accepting_emergencies;
    try {
      setHospital(prev => ({ ...prev, accepting_emergencies: newVal }));
      await ApiService.updateHospitalStatus(hospital.id, hospital.emergency_status, newVal);
      showNotification(`Intake ${newVal ? 'ENABLED' : 'DIVERTED'}`);
      onRefreshHospitals();
    } catch (e) {
      failAndResync('Intake toggle', e);
    }
  };

  const handleQuickBedAdjust = async (delta: number) => {
    const total = hospital.total_emergency_beds;
    const newAvailable = Math.max(0, Math.min(total, hospital.available_emergency_beds + delta));
    if (newAvailable === hospital.available_emergency_beds) return;
    try {
      setHospital(prev => ({ ...prev, available_emergency_beds: newAvailable }));
      // Changes the real bed rows the Governor counts (reserved beds stay locked to their cases)
      const updated = await ApiService.updateHospitalBeds(hospital.id, total, newAvailable);
      setHospital(prev => ({ ...prev, ...updated }));
      showNotification(`Free beds: ${updated.available_emergency_beds} of ${updated.total_emergency_beds}`);
      onRefreshHospitals();
    } catch (e) {
      failAndResync('Bed update', e);
    }
  };

  const handleSpecialistToggle = async (specName: string, currentStatus: string, count: number) => {
    const newStatus = currentStatus === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
    const newCount = newStatus === 'AVAILABLE' ? Math.max(1, count) : 0;
    try {
      setHospital(prev => {
        const updated = (prev.specialties || []).map(s => 
          s.specialty_name === specName ? { ...s, status: newStatus as any, available_count: newCount } : s
        );
        return { ...prev, specialties: updated };
      });
      await ApiService.updateSpecialist(hospital.id, specName, newCount, newStatus);
      showNotification(`${specName}: ${newStatus}`);
      onRefreshHospitals();
    } catch (e) {
      failAndResync('Specialist update', e);
    }
  };

  const handleFacilityToggle = async (facName: string, currentAvailable: boolean) => {
    const newAvailable = !currentAvailable;
    const newStatus = newAvailable ? 'OPERATIONAL' : 'OFFLINE';
    try {
      setHospital(prev => {
        const updated = (prev.facilities || []).map(f => 
          f.facility_name === facName ? { ...f, available: newAvailable, status: newStatus as any } : f
        );
        return { ...prev, facilities: updated };
      });
      await ApiService.updateFacility(hospital.id, facName, newAvailable, newStatus);
      showNotification(`${facName} set to ${newStatus}`);
      onRefreshHospitals();
    } catch (e) {
      failAndResync('Facility update', e);
    }
  };

  const handleReferralResponse = async (referralId: string, action: 'accept' | 'reject') => {
    try {
      const result: any = await ApiService.respondToReferral(referralId, action, action === 'reject' ? 'Emergency Department Surge' : undefined);
      if (action === 'accept') {
        showNotification(`ACCEPTED - ${result.beds_reserved ?? 1} bed(s) reserved`);
      } else if (result.next_hospital_contacted) {
        showNotification(`REJECTED - re-routed to ${String(result.next_hospital_contacted).replace('SIMULATED HOSPITAL — ', '')}`);
      } else {
        showNotification('REJECTED - no other eligible hospital; command centre alerted', true);
      }
      loadHospitalData();
      onRefreshHospitals();
    } catch (e) {
      failAndResync(action === 'accept' ? 'Accept' : 'Reject', e);
    }
  };

  const showNotification = (msg: string, isError = false) => {
    setToastIsError(isError);
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), isError ? 6000 : 3000);
  };

  // Show the server's real reason and roll the screen back to what is actually stored
  const failAndResync = (action: string, e: any) => {
    console.error(e);
    showNotification(`${action} failed: ${e?.message || 'unknown error'}`, true);
    loadHospitalData();
  };

  const pendingCount = referrals.filter(r => r.status === 'REQUESTED').length;
  const onDutySpecialistsCount = hospital.specialties?.filter(s => s.status === 'AVAILABLE').length || 0;
  const operationalFacilitiesCount = hospital.facilities?.filter(f => f.available).length || 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {saveToast && (
        <div className={`fixed bottom-6 right-6 z-50 text-white px-4 py-2.5 rounded-xl shadow-xl border text-xs font-bold flex items-center gap-2 max-w-sm ${toastIsError ? 'bg-rose-700 border-rose-500' : 'bg-slate-900 border-slate-700'}`}>
          {toastIsError ? <XCircle className="w-4 h-4 text-rose-200 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          <span>{saveToast}</span>
        </div>
      )}

      {/* Clean Hospital Identity & Fast Status Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-600/20">
            <Building2 className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                {hospital.name.replace('SIMULATED HOSPITAL — ', '')}
              </h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black ${
                hospital.emergency_status === 'OPEN' && hospital.accepting_emergencies 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : hospital.emergency_status === 'LIMITED' 
                  ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                <span className={`w-2 h-2 rounded-full ${hospital.accepting_emergencies ? 'bg-emerald-600 animate-pulse' : 'bg-rose-600'}`}></span>
                <span>{hospital.emergency_status} &bull; {hospital.accepting_emergencies ? 'Accepting Admissions' : 'Diverted'}</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 stroke-[2.5]" />
                <span>{hospital.address}</span>
              </span>
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0 stroke-[2.5]" />
                <span>{hospital.phone}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Quick Intake Status Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status buttons */}
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            {(['OPEN', 'LIMITED', 'CLOSED'] as const).map(st => (
              <button
                key={st}
                onClick={() => handleStatusChange(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                  hospital.emergency_status === st
                    ? st === 'OPEN' ? 'bg-emerald-600 text-white shadow-xs'
                    : st === 'LIMITED' ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Toggle button */}
          <button
            onClick={handleToggleAccepting}
            className={`px-3.5 py-2 rounded-xl text-xs font-black border transition flex items-center gap-2 shadow-2xs cursor-pointer ${
              hospital.accepting_emergencies
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
            }`}
          >
            <span>{hospital.accepting_emergencies ? 'Intake Active' : 'Intake Diverted'}</span>
          </button>
        </div>
      </div>

      {/* 4-Metric Operations Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Bed Counter Card with Quick +/- Stepper */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Free Trauma Beds</span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Bed className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {hospital.available_emergency_beds}
              </span>
              <span className="text-xs text-slate-400 font-bold ml-1.5">
                / {hospital.total_emergency_beds} total
              </span>
            </div>

            {/* Quick Adjust Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleQuickBedAdjust(-1)}
                title="Decrease free beds"
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center font-black text-sm transition cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5 stroke-[3]" />
              </button>
              <button
                onClick={() => handleQuickBedAdjust(1)}
                title="Increase free beds"
                className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center font-black text-sm transition shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            </div>
          </div>

          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 rounded-full transition-all duration-300" 
              style={{ width: `${Math.min(100, (hospital.available_emergency_beds / (hospital.total_emergency_beds || 1)) * 100)}%` }}
            />
          </div>
        </div>

        {/* 2. Specialists On Duty */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Specialists On Duty</span>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Stethoscope className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-black text-indigo-600 tracking-tight">
              {onDutySpecialistsCount}
            </span>
            <span className="text-xs text-slate-400 font-bold ml-1.5">
              / {hospital.specialties?.length || 7} on-call
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Active for ER-Sync matching
          </div>
        </div>

        {/* 3. Operational Facilities */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Clinical Facilities</span>
            <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
              <Activity className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-black text-purple-600 tracking-tight">
              {operationalFacilitiesCount}
            </span>
            <span className="text-xs text-slate-400 font-bold ml-1.5">
              / {hospital.facilities?.length || 6} online
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Theatres, ICU, &amp; CT Scanner verified
          </div>
        </div>

        {/* 4. Active Referrals / Reservations */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Assigned Cases</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Inbox className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-black text-emerald-600 tracking-tight">
              {referrals.length}
            </span>
            <span className="text-xs text-slate-400 font-bold ml-1.5">
              referrals
            </span>
          </div>
          <div className="text-[11px] text-emerald-700 font-bold">
            {referrals.filter(r => r.status === 'ACCEPTED').length} Confirmed Bed Reservations
          </div>
        </div>
      </div>

      {/* Segmented Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'overview'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Bed className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Bed Allocation</span>
        </button>

        <button
          onClick={() => setActiveSubTab('specialists')}
          className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'specialists'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Stethoscope className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Specialists ({onDutySpecialistsCount})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('facilities')}
          className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'facilities'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Activity className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Facilities ({operationalFacilitiesCount})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('referrals')}
          className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'referrals'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Inbox className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Incoming Referrals ({pendingCount} pending)</span>
        </button>
      </div>

      {/* Sub-Tab 1: Bed Allocation */}
      {activeSubTab === 'overview' && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900">Trauma &amp; Emergency Bed Allocation</h3>
              <p className="text-xs text-slate-500 font-medium">Free bed count directly calibrates ER-Sync matching scores</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-lg">
                {hospital.available_emergency_beds} Beds Free for Intake
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Department Capacity</span>
              <div className="text-2xl font-black text-slate-900">{hospital.total_emergency_beds}</div>
              <p className="text-[11px] text-slate-500 font-medium">Licensed trauma beds</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Occupied Beds</span>
              <div className="text-2xl font-black text-slate-900">
                {hospital.total_emergency_beds - hospital.available_emergency_beds}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Currently admitted</p>
            </div>

            <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-1">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Free for Dispatch</span>
              <div className="text-2xl font-black text-emerald-700">{hospital.available_emergency_beds}</div>
              <p className="text-[11px] text-emerald-700 font-bold">Ready for emergency referral</p>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Specialists */}
      {activeSubTab === 'specialists' && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900">On-Duty Specialist Roster</h3>
              <p className="text-xs text-slate-500 font-medium">Toggle availability to satisfy ER-Sync clinical hard constraints</p>
            </div>
            <span className="text-xs font-bold text-slate-500">{onDutySpecialistsCount} Active</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {hospital.specialties?.map((spec, idx) => {
              const isAvail = spec.status === 'AVAILABLE';
              return (
                <div
                  key={idx}
                  onClick={() => handleSpecialistToggle(spec.specialty_name, spec.status, spec.available_count || 1)}
                  className={`p-4 rounded-xl border transition cursor-pointer flex items-center justify-between group ${
                    isAvail
                      ? 'bg-emerald-50/30 border-emerald-300 ring-1 ring-emerald-200 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 opacity-60 hover:opacity-100'
                  }`}
                >
                  <div>
                    <div className="text-xs font-black text-slate-900">{spec.specialty_name}</div>
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                      {isAvail ? `${spec.available_count || 1} on duty` : 'Off duty'}
                    </div>
                  </div>

                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                    isAvail
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    {isAvail ? 'ON DUTY' : 'OFF'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Facilities */}
      {activeSubTab === 'facilities' && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900">Clinical Facilities &amp; Equipment Readiness</h3>
              <p className="text-xs text-slate-500 font-medium">Live operational status of diagnostic and surgical suites</p>
            </div>
            <span className="text-xs font-bold text-slate-500">{operationalFacilitiesCount} Online</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {hospital.facilities?.map((fac, idx) => {
              const isOnline = fac.available;
              return (
                <div
                  key={idx}
                  onClick={() => handleFacilityToggle(fac.facility_name, fac.available)}
                  className={`p-4 rounded-xl border transition cursor-pointer flex items-center justify-between group ${
                    isOnline
                      ? 'bg-purple-50/30 border-purple-300 ring-1 ring-purple-200 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 opacity-60 hover:opacity-100'
                  }`}
                >
                  <div>
                    <div className="text-xs font-black text-slate-900">{fac.facility_name}</div>
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                      {isOnline ? 'Operational' : 'Offline'}
                    </div>
                  </div>

                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                    isOnline
                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    {isOnline ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-Tab 4: Referrals */}
      {activeSubTab === 'referrals' && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900">Incoming Patient Referrals</h3>
              <p className="text-xs text-slate-500 font-medium">Dispatched requests routed by the ER-Sync Engine</p>
            </div>
            <span className="text-xs font-bold text-slate-500">{referrals.length} Cases</span>
          </div>

          {referrals.length > 0 ? (
            <div className="space-y-3">
              {referrals.map((ref) => (
                <div
                  key={ref.id}
                  className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                        ref.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        ref.status === 'REJECTED' || ref.status === 'TIMEOUT' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                        'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        {ref.status}
                      </span>
                      <span className="text-xs font-bold text-slate-900 font-mono">
                        {ref.emergency?.incident_reference || `Incident #${ref.emergency_id.slice(0, 8)}`}
                      </span>
                      {ref.emergency && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${ref.emergency.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                          {ref.emergency.severity}
                        </span>
                      )}
                    </div>
                    {ref.emergency && (
                      <div className="text-xs text-slate-700 font-medium">
                        {ref.emergency.category} &bull; {ref.emergency.patient_count} patient(s) &bull; {ref.emergency.location_name}
                        <p className="text-[11px] text-slate-500 mt-0.5">{ref.emergency.description}</p>
                      </div>
                    )}
                    <div className="text-xs text-slate-500 font-medium">
                      ETA: <strong className="text-slate-900">{ref.eta_minutes} mins</strong> &bull; Requested: {clockTime(ref.requested_at)}
                      {ref.status === 'REQUESTED' && ref.reservation_expiry && (
                        <> &bull; <span className="text-amber-700 font-bold">Respond by {clockTime(ref.reservation_expiry)}</span></>
                      )}
                    </div>
                  </div>

                  {ref.status === 'REQUESTED' ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReferralResponse(ref.id, 'reject')}
                        className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                      >
                        Divert / Reject
                      </button>
                      <button
                        onClick={() => handleReferralResponse(ref.id, 'accept')}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-2xs flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Accept &amp; Reserve Bed</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs font-bold text-slate-600">
                      {ref.status === 'ACCEPTED' ? (
                        <span className="text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Bed Reserved
                        </span>
                      ) : ref.status === 'COMPLETED' ? (
                        <span className="text-slate-600">Case closed</span>
                      ) : ref.status === 'TIMEOUT' ? (
                        <span className="text-rose-700">No response - re-routed</span>
                      ) : (
                        <span className="text-rose-700">Diverted to Next Facility</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Inbox className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-medium">No active referrals currently assigned to this hospital.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HospitalDashboardPage;