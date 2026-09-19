import React, { useState } from 'react';
import type { Hospital, Emergency, OneClickDemoResult } from '../types';
import { MapComponent } from '../components/MapComponent';
import { Building2, Search, Filter, RefreshCw, MapPin, Bed, Activity, Clock } from 'lucide-react';
import { ApiService } from '../services/api';

interface NetworkMapPageProps {
  hospitals: Hospital[];
  activeEmergency: Emergency | null;
  demoResult: OneClickDemoResult | null;
  onRefresh: () => void;
}

export const NetworkMapPage: React.FC<NetworkMapPageProps> = ({
  hospitals,
  activeEmergency,
  onRefresh
}) => {
  const [search, setSearch] = useState('');
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredHospitals = hospitals.filter(h => {
    const matchesSearch = h.name.toLowerCase().includes(search.toLowerCase()) || 
                          h.address.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || 
                          (statusFilter === 'ACCEPTING' && h.accepting_emergencies) ||
                          (statusFilter === 'CLOSED' && h.emergency_status === 'CLOSED') ||
                          (statusFilter === 'STALE' && h.is_stale);
    return matchesSearch && matchesStatus;
  });

  const handleMakeStale = async (hospId: string) => {
    try {
      await ApiService.makeHospitalStale(hospId, 60);
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Geospatial Facility Grid</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Real-time GPS mapping and capacity telemetry for registered Lagos hospitals</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
            <span>Refresh Grid</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            placeholder="Search hospitals by name, area, or medical district..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-3 py-2 outline-none cursor-pointer w-full sm:w-auto"
          >
            <option value="ALL">All Facilities ({hospitals.length})</option>
            <option value="ACCEPTING">Accepting Admissions</option>
            <option value="CLOSED">Diverted / Full</option>
            <option value="STALE">Stale Telemetry (&gt;30m)</option>
          </select>
        </div>
      </div>

      {/* Main Map */}
      <MapComponent
        hospitals={filteredHospitals}
        emergency={activeEmergency}
        selectedHospital={selectedHospital}
        height="400px"
        onSelectHospital={setSelectedHospital}
      />

      {/* Hospital Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredHospitals.map(h => {
          const isSelected = selectedHospital?.id === h.id;
          return (
            <div
              key={h.id}
              onClick={() => setSelectedHospital(h)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                isSelected 
                  ? 'bg-blue-50/40 border-blue-400 ring-2 ring-blue-100 shadow-xs' 
                  : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 leading-tight">
                      {h.name.replace('SIMULATED HOSPITAL — ', '')}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{h.address}</span>
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                    h.emergency_status === 'OPEN' && h.accepting_emergencies 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    h.emergency_status === 'LIMITED' 
                      ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {h.emergency_status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-2.5 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                    <Bed className="w-3.5 h-3.5 text-blue-600" />
                    <span>{h.available_emergency_beds} / {h.total_emergency_beds} Beds Free</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                    <Activity className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{h.overall_capacity}% Utilized</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className={`font-bold ${h.is_stale ? 'text-amber-700' : 'text-slate-400'}`}>
                  {h.freshness_category === 'FRESH' ? 'Telemetry Active' : 'Stale (>30m)'}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleMakeStale(h.id); }}
                  className="text-[10px] text-purple-700 hover:text-purple-900 font-bold px-2 py-1 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition cursor-pointer"
                >
                  Simulate Stale
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
