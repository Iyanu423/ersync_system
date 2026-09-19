import React from 'react';
import type { UserRole } from '../types';
import { ApiService } from '../services/api';
import { 
  ShieldAlert, 
  Activity, 
  Building2, 
  MapPin, 
  BarChart3, 
  Zap, 
  Layers, 
  UserCheck,
  RotateCcw,
  Stethoscope
} from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  onResetSimulation: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  currentRole,
  setCurrentRole,
  onResetSimulation
}) => {
  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const role = e.target.value as UserRole;
    setCurrentRole(role);
    ApiService.setRole(role);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 lg:px-8 py-3 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & Tagline */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('intake')}>
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-slate-900">ER-SYNC</span>
              <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                LIVE EOC
              </span>
            </div>
            <p className="text-xs text-slate-500 font-normal">Emergency medical coordination & triage network</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('intake')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'intake'
                ? 'bg-white text-rose-700 shadow-xs border border-slate-200/80 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-rose-600" />
            Report Emergency
          </button>

          <button
            onClick={() => setActiveTab('command')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'command'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            Governor Command
          </button>

          <button
            onClick={() => setActiveTab('hospital')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'hospital'
                ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
            Hospital Network
          </button>

          <button
            onClick={() => setActiveTab('network')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'network'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-indigo-600" />
            Geospatial Map
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'analytics'
                ? 'bg-white text-purple-700 shadow-xs border border-slate-200/80 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-purple-600" />
            Analytics
          </button>

          <button
            onClick={() => setActiveTab('demo')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'demo'
                ? 'bg-amber-500 text-white shadow-xs font-semibold'
                : 'text-amber-700 hover:text-amber-800 hover:bg-amber-100/60'
            }`}
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            Demo Scenario
          </button>

          <button
            onClick={() => setActiveTab('hospital_staff')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'hospital_staff'
                ? 'bg-white text-teal-700 shadow-xs border border-slate-200/80 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
            Staff Portal
          </button>
        </nav>

        {/* Role Selector & Simulation Reset */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-2.5 py-1.5 rounded-lg text-xs shadow-2xs">
            <UserCheck className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-slate-500 font-medium">Role:</span>
            <select
              value={currentRole}
              onChange={handleRoleChange}
              aria-label="Active Role Selection"
              className="bg-transparent text-slate-800 font-semibold outline-none cursor-pointer"
            >
              <option value="ADMIN">Admin (State EOC)</option>
              <option value="PATIENT">Patient / Responder</option>
              <option value="HOSPITAL_STAFF">Hospital Staff (Lagos Central)</option>
            </select>
          </div>

          <button
            onClick={onResetSimulation}
            title="Reset Simulated Hospital Network to fresh seed state"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-medium border border-slate-300 shadow-2xs transition"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset Seed</span>
          </button>
        </div>
      </div>
    </header>
  );
};