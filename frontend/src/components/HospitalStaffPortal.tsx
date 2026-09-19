import React, { useState } from 'react';
import { 
  Building2, 
  Bed, 
  Users, 
  Stethoscope, 
  Activity, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Clock,
  Phone,
  MapPin,
  Save,
  RefreshCw,
  Sliders,
  Check
} from 'lucide-react';

export interface EmergencyDepartmentState {
  status: 'OPEN' | 'LIMITED' | 'CLOSED';
  acceptingEmergencies: boolean;
}

export interface BedCapacity {
  total: number;
  occupied: number;
  reserved: number;
  available: number;
}

export interface HospitalStaffPortalProps {
  hospital: any;
  onEmergencyStatusChange?: (status: string, accepting: boolean) => void;
  onAcceptanceChange?: (accepting: boolean) => void;
  onBedCapacityChange?: (total: number, occupied: number, reserved: number) => void;
  onSpecialistUpdate?: (specialist: string, count: number, status: string) => void;
  onFacilityUpdate?: (facility: string, available: boolean, status: string) => void;
  onEquipmentUpdate?: (equipment: string, operational: boolean, status: string) => void;
  onUpdateStatusClicked?: () => void;
}

export const HospitalStaffPortal: React.FC<HospitalStaffPortalProps> = ({
  hospital,
  onEmergencyStatusChange,
  onAcceptanceChange,
  onBedCapacityChange,
  onSpecialistUpdate,
  onFacilityUpdate,
  onEquipmentUpdate,
  onUpdateStatusClicked,
}) => {
  const [emergencyDept, setEmergencyDept] = useState({
    status: (hospital.emergency_status as 'OPEN' | 'LIMITED' | 'CLOSED') || 'OPEN',
    acceptingEmergencies: hospital.accepting_emergencies !== false,
  });

  const [bedCapacity, setBedCapacity] = useState({
    total: hospital.total_emergency_beds || 20,
    occupied: (hospital.total_emergency_beds || 20) - (hospital.available_emergency_beds || 15),
    reserved: 0,
    available: hospital.available_emergency_beds || 15,
  });

  // Names must match the backend catalog exactly, otherwise updates create rows the Governor never reads
  const defaultSpecialists = [
    'General Medicine', 'Surgery', 'Orthopaedics', 'Neurosurgery', 'Cardiology', 'Paediatrics',
    'Obstetrics/Gynaecology', 'Anaesthesia'
  ].map(name => ({ name, status: 'AVAILABLE', count: 1 }));

  const [specialists, setSpecialists] = useState<any[]>(
    hospital.specialties && hospital.specialties.length > 0 
      ? hospital.specialties.map((s: any) => ({
          name: s.specialty_name,
          status: s.status || 'AVAILABLE',
          count: s.available_count || 1
        }))
      : defaultSpecialists
  );

  const defaultFacilities = [
    'Emergency Department', 'Operating Theatre', 'ICU', 'CT Scanner', 'X-Ray', 'Ultrasound', 'Blood Bank', 'Ambulance'
  ].map(name => ({ name, available: true, status: 'OPERATIONAL' }));

  const [facilities, setFacilities] = useState<any[]>(
    hospital.facilities && hospital.facilities.length > 0
      ? hospital.facilities.map((f: any) => ({
          name: f.facility_name,
          available: f.available !== false,
          status: f.status || 'OPERATIONAL'
        }))
      : defaultFacilities
  );

  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleStatusChange = (newStatus: 'OPEN' | 'LIMITED' | 'CLOSED') => {
    setEmergencyDept(prev => ({ ...prev, status: newStatus }));
    if (onEmergencyStatusChange) {
      onEmergencyStatusChange(newStatus, emergencyDept.acceptingEmergencies);
    }
  };

  const handleAcceptanceToggle = () => {
    const newVal = !emergencyDept.acceptingEmergencies;
    setEmergencyDept(prev => ({ ...prev, acceptingEmergencies: newVal }));
    if (onEmergencyStatusChange) {
      onEmergencyStatusChange(emergencyDept.status, newVal);
    }
    if (onAcceptanceChange) {
      onAcceptanceChange(newVal);
    }
  };

  const handleBedTotalChange = (val: number) => {
    const total = Math.max(1, val);
    const available = Math.max(0, total - bedCapacity.occupied - bedCapacity.reserved);
    const updated = { ...bedCapacity, total, available };
    setBedCapacity(updated);
    if (onBedCapacityChange) {
      onBedCapacityChange(updated.total, updated.occupied, updated.reserved);
    }
  };

  const handleBedOccupiedChange = (val: number) => {
    const occupied = Math.max(0, Math.min(val, bedCapacity.total));
    const available = Math.max(0, bedCapacity.total - occupied - bedCapacity.reserved);
    const updated = { ...bedCapacity, occupied, available };
    setBedCapacity(updated);
    if (onBedCapacityChange) {
      onBedCapacityChange(updated.total, updated.occupied, updated.reserved);
    }
  };

  const handleSpecialistToggle = (index: number) => {
    const updated = [...specialists];
    const item = updated[index];
    item.status = item.status === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
    item.count = item.status === 'AVAILABLE' ? Math.max(1, item.count) : 0;
    setSpecialists(updated);
    if (onSpecialistUpdate) {
      onSpecialistUpdate(item.name, item.count, item.status);
    }
  };

  const handleFacilityToggle = (index: number) => {
    const updated = [...facilities];
    const item = updated[index];
    item.available = !item.available;
    item.status = item.available ? 'OPERATIONAL' : 'OFFLINE';
    setFacilities(updated);
    if (onFacilityUpdate) {
      onFacilityUpdate(item.name, item.available, item.status);
    }
  };

  const handleSaveAll = () => {
    setSaveSuccess(true);
    if (onUpdateStatusClicked) {
      onUpdateStatusClicked();
    }
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Hospital Info */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-teal-600/20">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{hospital.name}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                emergencyDept.status === 'OPEN' && emergencyDept.acceptingEmergencies 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : emergencyDept.status === 'LIMITED' 
                  ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {emergencyDept.status} &bull; {emergencyDept.acceptingEmergencies ? 'ACCEPTING' : 'DIVERTED'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {hospital.address || 'Lagos Central Medical District'}
              </span>
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {hospital.phone || '+234 1 234 5678'}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Telemetry updated: {new Date().toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          {saveSuccess && (
            <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
              <Check className="w-4 h-4" /> Telemetry Synced
            </span>
          )}
          <button
            onClick={handleSaveAll}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-xl shadow-xs transition"
          >
            <Save className="w-4 h-4" />
            Sync State Telemetry
          </button>
        </div>
      </div>

      {/* Grid: 7 Operational Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 1. Emergency Department Status */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-600" />
              1. Emergency Department Status
            </h3>
            <span className="text-xs text-slate-500">Intake Control</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Department Operational Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['OPEN', 'LIMITED', 'CLOSED'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleStatusChange(st)}
                    className={`py-2 px-2 text-xs font-bold rounded-lg border transition ${
                      emergencyDept.status === st
                        ? st === 'OPEN' ? 'bg-emerald-600 text-white border-emerald-600'
                        : st === 'LIMITED' ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-rose-600 text-white border-rose-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-slate-900">Accept Incoming Emergencies</span>
                  <p className="text-[11px] text-slate-500">Governor will route patients when enabled</p>
                </div>
                <input
                  type="checkbox"
                  checked={emergencyDept.acceptingEmergencies}
                  onChange={handleAcceptanceToggle}
                  className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>

        {/* 2. Bed Capacity Management */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Bed className="w-4 h-4 text-blue-600" />
              2. Emergency Bed Capacity
            </h3>
            <span className="text-xs text-slate-500">{bedCapacity.available} Available</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Total Trauma Beds</label>
              <input
                type="number"
                min="1"
                value={bedCapacity.total}
                onChange={(e) => handleBedTotalChange(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Occupied Beds</label>
              <input
                type="number"
                min="0"
                value={bedCapacity.occupied}
                onChange={(e) => handleBedOccupiedChange(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 flex items-center justify-between text-xs">
            <span className="text-blue-900 font-semibold">Available for Dispatch:</span>
            <span className="text-base font-bold text-blue-700">{bedCapacity.available} Beds</span>
          </div>
        </div>

        {/* 6. Current Capacity Overview */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              6. Operational Summary
            </h3>
            <span className="text-xs text-slate-500">Live Status</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-600">Bed Occupancy Rate:</span>
              <span className="font-bold text-slate-900">
                {Math.round((bedCapacity.occupied / bedCapacity.total) * 100)}%
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-600">Active Specialists:</span>
              <span className="font-bold text-emerald-700">
                {specialists.filter(s => s.status === 'AVAILABLE').length} / {specialists.length} On Duty
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-600">Operational Facilities:</span>
              <span className="font-bold text-teal-700">
                {facilities.filter(f => f.available).length} / {facilities.length} Online
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Specialists Availability Grid */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-indigo-600" />
            3. Specialist On-Duty Roster
          </h3>
          <span className="text-xs text-slate-500">Toggle availability for governor triage scoring</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {specialists.map((spec, idx) => (
            <div
              key={idx}
              onClick={() => handleSpecialistToggle(idx)}
              className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                spec.status === 'AVAILABLE'
                  ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-200'
                  : 'bg-slate-50 border-slate-200 opacity-60'
              }`}
            >
              <div>
                <div className="text-xs font-bold text-slate-900">{spec.name}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {spec.status === 'AVAILABLE' ? `${spec.count || 1} available` : 'Off duty'}
                </div>
              </div>

              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                spec.status === 'AVAILABLE'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-slate-200 text-slate-700'
              }`}>
                {spec.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Facilities & Equipment Grid */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-600" />
            4. Clinical Facilities &amp; Equipment Readiness
          </h3>
          <span className="text-xs text-slate-500">Hard filter verification points</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {facilities.map((fac, idx) => (
            <div
              key={idx}
              onClick={() => handleFacilityToggle(idx)}
              className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                fac.available
                  ? 'bg-purple-50/40 border-purple-300 ring-1 ring-purple-200'
                  : 'bg-slate-50 border-slate-200 opacity-60'
              }`}
            >
              <div>
                <div className="text-xs font-bold text-slate-900">{fac.name}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {fac.available ? 'Ready for Admissions' : 'Service Offline'}
                </div>
              </div>

              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                fac.available
                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                  : 'bg-slate-200 text-slate-700'
              }`}>
                {fac.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};