import React, { useState } from 'react';
import clsx from 'clsx';
import { ChevronsLeft, ChevronsRight, LogOut, RotateCcw, Wifi, WifiOff } from 'lucide-react';
import type { AuthUser } from '../types';
import { initials, parseFullName } from '../utils/format';
import { navFor, ROLE_META, type TabId } from '../config/workspace';

interface SidebarProps {
  user: AuthUser;
  workspaceName: string;
  activeTab: TabId;
  onNavigate: (tab: TabId) => void;
  onOpenAccount: () => void;
  onLogout: () => void;
  onResetSimulation: () => void;
  badges: Partial<Record<TabId, number>>;
  online: boolean;
}

const COLLAPSE_KEY = 'ersync.sidebar.collapsed';

export const BrandMark: React.FC<{ size?: number; className?: string }> = ({ size = 40, className }) => (
  <span className={clsx('relative inline-flex shrink-0 items-center justify-center rounded-[13px] bg-white shadow-[0_6px_20px_-6px_rgba(38,195,162,.7)] ring-1 ring-white/20', className)} style={{ width: size, height: size }}>
    <img src="/logo.png" alt="ER-Sync" className="size-[78%] object-contain" />
  </span>
);

export const Sidebar: React.FC<SidebarProps> = ({ user, workspaceName, activeTab, onNavigate, onOpenAccount, onLogout, onResetSimulation, badges, online }) => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });
  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1'); } catch { /* ignore */ }
      return !c;
    });
  };

  const role = user.role;
  const meta = ROLE_META[role];
  const person = parseFullName(user.full_name);
  const items = navFor(role);
  const groups = Array.from(new Set(items.map((i) => i.group)));

  return (
    <aside
      className={clsx(
        'side-pattern relative hidden h-dvh shrink-0 select-none flex-col bg-ink-950 text-white transition-[width] duration-300 ease-out lg:flex',
        collapsed ? 'w-[84px]' : 'w-[284px]',
      )}
    >
      {/* Brand */}
      <div className={clsx('flex items-center gap-3 px-5 pb-4 pt-6', collapsed && 'justify-center px-0')}>
        <BrandMark size={42} />
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-2">
              <span className="text-[19px] font-extrabold tracking-tight">ER-Sync</span>
              <span className="rounded-md bg-signal-400/15 px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider text-signal-300">Live</span>
            </div>
            <p className="truncate text-[11.5px] font-medium text-ink-300/80">Emergency Coordination Network</p>
          </div>
        )}
      </div>

      {/* Account card */}
      <div className={clsx('px-4 pb-2', collapsed && 'px-3')}>
        <button
          onClick={onOpenAccount}
          title="Your account"
          className={clsx('group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-left transition hover:border-white/20 hover:bg-white/[0.09]', collapsed && 'justify-center p-2.5')}
        >
          <span className={clsx('inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-extrabold',
            meta.tone === 'signal' ? 'bg-signal-400/20 text-signal-300' : meta.tone === 'alert' ? 'bg-alert-400/20 text-alert-300' : 'bg-info-500/25 text-info-200')}>
            {initials(person.name)}
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-bold">{person.name}</span>
              <span className="block truncate text-[11.5px] font-medium text-ink-300/70">{role === 'HOSPITAL_STAFF' ? workspaceName : meta.label}</span>
            </span>
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-4 pb-4 pt-3" aria-label="Primary">
        {groups.map((g) => (
          <div key={g} className="mb-5">
            {!collapsed ? (
              <p className="mb-1.5 px-3 text-[10.5px] font-bold uppercase tracking-[.12em] text-ink-400/80">{g}</p>
            ) : (
              <div className="mx-auto mb-2 h-px w-6 bg-white/10" />
            )}
            <div className="space-y-1">
              {items.filter((i) => i.group === g).map((item) => {
                const count = badges[item.id] || 0;
                return (
                  <button
                    key={item.id}
                    data-active={activeTab === item.id}
                    onClick={() => onNavigate(item.id)}
                    title={collapsed ? item.label : undefined}
                    className={clsx('side-link', collapsed && 'justify-center px-0')}
                  >
                    <item.icon className="side-ico size-[19px]" strokeWidth={2} />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {!collapsed && count > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-alert-500 px-1.5 text-[11px] font-extrabold text-white tabnum">{count > 99 ? '99+' : count}</span>
                    )}
                    {collapsed && count > 0 && <span className="absolute right-2 top-2 size-2.5 rounded-full bg-alert-500 ring-2 ring-ink-950" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="space-y-2.5 border-t border-white/10 p-4">
        <div className={clsx('flex items-center gap-2.5 rounded-xl bg-white/[0.04] px-3 py-2.5', collapsed && 'justify-center px-0')}>
          {online ? <Wifi className="size-4 shrink-0 text-signal-300" /> : <WifiOff className="size-4 shrink-0 text-alert-300" />}
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <p className="text-[12px] font-bold">{online ? 'All systems live' : 'Backend unreachable'}</p>
              <p className="text-[10.5px] font-medium text-ink-300/70">{online ? 'Deterministic engine online' : 'Retrying every 10s'}</p>
            </div>
          )}
          {!collapsed && <span className="relative ml-auto flex size-2"><span className={clsx('ping-soft absolute inline-flex size-full rounded-full', online ? 'bg-signal-400' : 'bg-alert-400')} /><span className={clsx('relative inline-flex size-2 rounded-full', online ? 'bg-signal-400' : 'bg-alert-400')} /></span>}
        </div>

        <div className={clsx('flex gap-2', collapsed && 'flex-col')}>
          {role === 'ADMIN' && (
            <button onClick={onResetSimulation} title="Reset demo data" className={clsx('flex h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-white/[0.06] text-[12px] font-bold text-ink-200 transition hover:bg-white/[0.12] hover:text-white')}>
              <RotateCcw className="size-3.5" />
              {!collapsed && 'Reset demo'}
            </button>
          )}
          <button onClick={onLogout} title="Sign out" className="flex size-9 items-center justify-center rounded-xl bg-white/[0.06] text-ink-300 transition hover:bg-alert-500/25 hover:text-alert-200"><LogOut className="size-4" /></button>
          <button onClick={toggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="flex size-9 items-center justify-center rounded-xl bg-white/[0.06] text-ink-300 transition hover:bg-white/[0.12] hover:text-white">
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
};
