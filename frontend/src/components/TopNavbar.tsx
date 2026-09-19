import React from 'react';
import type { UserRole, Hospital } from '../types';
import { ApiService } from '../services/api';
import { 
  UserCheck, 
  Building2, 
  Zap, 
  RefreshCw,
  Menu,
  Shield,
  Activity,
  ChevronDown
} from 'lucide-react';

interface TopNavbarProps {
  activeTab: string;
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  hospitals: Hospital[];
  selectedHospitalId?: string;
  onSelectHospitalId?: (id: string) => void;
  onRunDemo?: () => void;
  isDemoRunning?: boolean;
  onOpenMobileMenu?: () => void;
  onNavigateToIntake?: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  activeTab,
  currentRole,
  setCurrentRole,
  hospitals,
  selectedHospitalId,
  onSelectHospitalId,
  onRunDemo,
  isDemoRunning,
  onOpenMobileMenu,
  onNavigateToIntake
}) => {
  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const role = e.target.value as UserRole;
    setCurrentRole(role);
    ApiService.setRole(role, selectedHospitalId || 'hosp_lagos_central');
  };

  const getPageInfo = () => {
    switch (activeTab) {
      case 'command': 
        return { title: 'Command Center', subtitle: 'Live Multi-Facility Dispatch Grid' };
      case 'intake': 
        return { title: 'Emergency Intake', subtitle: 'AI Clinical Triage & Dispatch' };
      case 'hospital': 
        return { title: 'Hospital Dashboard', subtitle: 'Facility Bed & Specialist Management' };
      case 'network': 
        return { title: 'Geospatial Grid', subtitle: 'Lagos Medical Infrastructure Map' };
      case 'analytics': 
        return { title: 'Analytics & KPIs', subtitle: 'System Performance & Referral Telemetry' };
      case 'demo': 
        return { title: 'Failover Simulation', subtitle: '1-Click End-to-End Stress Test' };
      default: 
        return { title: 'ER-Sync', subtitle: 'Emergency Coordination' };
    }
  };

  const pageInfo = getPageInfo();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 z-30 select-none">
      {/* Page Title & Mobile Trigger */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5 stroke-[2.5]" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
              {pageInfo.title}
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
              Live Grid
            </span>
          </div>
          <p className="hidden md:block text-[11px] text-slate-500 font-medium truncate">
            {pageInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Hospital selector when on hospital tab */}
        {activeTab === 'hospital' && hospitals.length > 0 && onSelectHospitalId && (
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs">
            <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0 stroke-[2.5]" />
            <select
              value={selectedHospitalId}
              onChange={(e) => onSelectHospitalId(e.target.value)}
              className="bg-transparent text-slate-900 font-bold outline-none cursor-pointer max-w-[130px] sm:max-w-[190px] truncate text-xs"
            >
              {hospitals.map(h => (
                <option key={h.id} value={h.id}>
                  {h.name.replace('SIMULATED HOSPITAL — ', '')}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Demo Fast Trigger */}
        {onRunDemo && activeTab !== 'demo' && (
          <button
            onClick={onRunDemo}
            disabled={isDemoRunning}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black transition shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {isDemoRunning ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5 fill-white" />
            )}
            <span>Simulate Failover</span>
          </button>
        )}

        {/* Role Persona Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs">
          <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0 stroke-[2.5]" />
          <select
            value={currentRole}
            onChange={handleRoleChange}
            aria-label="User Persona"
            className="bg-transparent text-slate-900 font-black outline-none cursor-pointer text-xs"
          >
            <option value="ADMIN">Admin (State EOC)</option>
            <option value="HOSPITAL_STAFF">Hospital Staff</option>
            <option value="PATIENT">Responder / Patient</option>
          </select>
        </div>
      </div>
    </header>
  );
};
