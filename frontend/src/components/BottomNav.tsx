import React, { useState } from 'react';
import clsx from 'clsx';
import { ArrowLeftRight, Grid2x2, RotateCcw, Siren, ChevronRight } from 'lucide-react';
import type { UserRole } from '../types';
import { navFor, ROLE_META, type NavItem, type TabId } from '../config/workspace';
import { Modal, IconTile } from '../ui/primitives';

interface BottomNavProps {
  role: UserRole;
  activeTab: TabId;
  onNavigate: (tab: TabId) => void;
  onSwitchWorkspace: () => void;
  onResetSimulation: () => void;
  badges: Partial<Record<TabId, number>>;
}

const Tab: React.FC<{ item: NavItem; active: boolean; count: number; onClick: () => void }> = ({ item, active, count, onClick }) => (
  <button onClick={onClick} aria-current={active ? 'page' : undefined} className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 pt-2.5 transition active:scale-95">
    <span className={clsx('relative flex h-7 w-12 items-center justify-center rounded-full transition-all duration-200', active ? 'bg-signal-100 text-signal-700' : 'text-ink-400')}>
      <item.icon className="size-[21px]" strokeWidth={active ? 2.4 : 2} />
      {count > 0 && <span className="absolute right-1 top-0 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-alert-500 px-1 text-[9.5px] font-extrabold text-white ring-2 ring-white tabnum">{count > 9 ? '9+' : count}</span>}
    </span>
    <span className={clsx('max-w-full truncate text-[10.5px] font-bold', active ? 'text-signal-800' : 'text-ink-400')}>{item.short}</span>
  </button>
);

export const BottomNav: React.FC<BottomNavProps> = ({ role, activeTab, onNavigate, onSwitchWorkspace, onResetSimulation, badges }) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const items = navFor(role);
  const get = (id: TabId) => items.find((i) => i.id === id)!;

  const compact = items.length <= 5;
  const primary: NavItem[] = compact ? items : [get('command'), get('network'), get('referrals')];
  const rest = compact ? [] : items.filter((i) => !primary.includes(i) && i.id !== 'intake');
  const fab = !compact ? get('intake') : null;
  const moreActive = rest.some((r) => r.id === activeTab);
  const moreBadge = rest.reduce((n, r) => n + (badges[r.id] || 0), 0);

  const go = (id: TabId) => { setMoreOpen(false); onNavigate(id); };
  const meta = ROLE_META[role];

  return (
    <>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 bg-white/92 backdrop-blur-xl lg:hidden" aria-label="Primary">
        <div className="mx-auto flex h-[62px] max-w-xl items-stretch px-1">
          {primary.slice(0, compact ? primary.length : 2).map((i) => (
            <Tab key={i.id} item={i} active={activeTab === i.id} count={badges[i.id] || 0} onClick={() => go(i.id)} />
          ))}

          {fab && (
            <div className="relative flex w-[76px] shrink-0 justify-center">
              <button
                onClick={() => go('intake')}
                aria-label="Report emergency"
                className={clsx('absolute -top-6 flex size-[58px] items-center justify-center rounded-full border-4 border-white bg-alert-600 text-white shadow-[0_10px_24px_-6px_rgba(217,51,32,.7)] transition active:scale-90', activeTab === 'intake' && 'ring-4 ring-alert-200')}
              >
                <Siren className="size-6" strokeWidth={2.3} />
              </button>
              <span className="absolute bottom-1.5 text-[10.5px] font-bold text-alert-700">Report</span>
            </div>
          )}

          {!compact && <Tab item={primary[2]} active={activeTab === primary[2].id} count={badges[primary[2].id] || 0} onClick={() => go(primary[2].id)} />}

          {!compact && (
            <button onClick={() => setMoreOpen(true)} className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 pt-2.5 transition active:scale-95">
              <span className={clsx('relative flex h-7 w-12 items-center justify-center rounded-full transition-all', moreActive ? 'bg-signal-100 text-signal-700' : 'text-ink-400')}>
                <Grid2x2 className="size-[21px]" strokeWidth={moreActive ? 2.4 : 2} />
                {moreBadge > 0 && <span className="absolute right-2 top-0 size-2.5 rounded-full bg-alert-500 ring-2 ring-white" />}
              </span>
              <span className={clsx('text-[10.5px] font-bold', moreActive ? 'text-signal-800' : 'text-ink-400')}>More</span>
            </button>
          )}
        </div>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="More" subtitle={`${meta.label} workspace`} size="sm">
        <div className="-mx-1 space-y-1.5">
          {rest.map((i) => (
            <button key={i.id} onClick={() => go(i.id)} className={clsx('flex w-full items-center gap-3.5 rounded-2xl p-3 text-left transition active:scale-[.98]', activeTab === i.id ? 'bg-signal-50' : 'hover:bg-ink-25')}>
              <IconTile icon={i.icon} tone={activeTab === i.id ? 'signal' : 'neutral'} />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold text-ink-900">{i.label}</span>
                <span className="block truncate text-[12px] font-medium text-ink-400">{i.description}</span>
              </span>
              {(badges[i.id] || 0) > 0 && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-alert-500 px-1.5 text-[11px] font-extrabold text-white">{badges[i.id]}</span>}
              <ChevronRight className="size-4 text-ink-300" />
            </button>
          ))}
          <div className="my-2 h-px bg-ink-100" />
          <button onClick={() => { setMoreOpen(false); onSwitchWorkspace(); }} className="flex w-full items-center gap-3.5 rounded-2xl p-3 text-left transition hover:bg-ink-25 active:scale-[.98]">
            <IconTile icon={ArrowLeftRight} tone="info" />
            <span className="flex-1"><span className="block text-[14px] font-bold text-ink-900">Switch workspace</span><span className="block text-[12px] font-medium text-ink-400">Change role or hospital</span></span>
          </button>
          {role === 'ADMIN' && (
            <button onClick={() => { setMoreOpen(false); onResetSimulation(); }} className="flex w-full items-center gap-3.5 rounded-2xl p-3 text-left transition hover:bg-ink-25 active:scale-[.98]">
              <IconTile icon={RotateCcw} tone="warn" />
              <span className="flex-1"><span className="block text-[14px] font-bold text-ink-900">Reset demo data</span><span className="block text-[12px] font-medium text-ink-400">Restore hospitals to seed state</span></span>
            </button>
          )}
        </div>
      </Modal>
    </>
  );
};
