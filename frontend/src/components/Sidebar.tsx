import React from 'react';
import { 
  ShieldAlert, 
  Activity, 
  Building2, 
  MapPin, 
  BarChart3, 
  Zap, 
  Layers, 
  RotateCcw,
  X,
  ChevronRight,
  Stethoscope,
  HeartPulse
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onResetSimulation: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onResetSimulation,
  isOpenMobile = false,
  onCloseMobile
}) => {
  const navItems = [
    {
      category: "OPERATIONS",
      items: [
        { id: 'command', label: 'Command Center', icon: Layers },
        { id: 'intake', label: 'Emergency Intake', icon: Activity },
        { id: 'network', label: 'Geospatial Grid', icon: MapPin },
        { id: 'analytics', label: 'Analytics & KPIs', icon: BarChart3 },
      ]
    },
    {
      category: "FACILITY",
      items: [
        { id: 'hospital', label: 'Hospital Dashboard', icon: Building2 },
      ]
    },
    {
      category: "SIMULATION",
      items: [
        { id: 'demo', label: '1-Click Failover', icon: Zap },
      ]
    }
  ];

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs md:hidden animate-in fade-in"
        />
      )}

      {/* Sidebar Container */}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 flex flex-col h-screen shrink-0 select-none transition-transform duration-300 ease-in-out shadow-xl md:shadow-none ${
        isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div 
            onClick={() => handleNavClick('command')} 
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-blue-200 shadow-sm shadow-blue-600/15 group-hover:scale-105 transition-transform bg-white flex items-center justify-center p-0.5 shrink-0">
              <img src="/logo.png" alt="ER-Sync Logo" className="w-full h-full object-contain rounded-lg" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm text-[#163b82] tracking-tight">ER-Sync.</span>
                <span className="px-1.5 py-0.2 text-[9px] font-black bg-blue-100 text-[#163b82] border border-blue-200 rounded-md">
                  EOC
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-bold truncate">Hospital Emergency System</p>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Navigation Categories */}
        <div className="flex-1 overflow-y-auto px-3.5 py-5 space-y-6">
          {navItems.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              <div className="px-3 text-[11px] font-black tracking-wider text-slate-400 uppercase mb-2">
                {group.category}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all text-left group cursor-pointer ${
                        isActive
                          ? 'bg-blue-600 text-white font-black shadow-xs'
                          : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 font-bold'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 stroke-[2.5] ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-900'}`} />
                        <span className="tracking-tight">{item.label}</span>
                      </div>
                      
                      {isActive && (
                        <ChevronRight className="w-4 h-4 text-blue-200 stroke-[3]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* System Reset & Status Footer */}
        <div className="p-4 border-t border-slate-200 space-y-2">
          <button
            onClick={onResetSimulation}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Reset Demo State</span>
          </button>
          <div className="text-[10px] text-center text-slate-400 font-semibold">
            Deterministic Engine &bull; Sub-second Triage
          </div>
        </div>
      </aside>
    </>
  );
};
