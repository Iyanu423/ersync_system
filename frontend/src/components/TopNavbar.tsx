import React from 'react';
import clsx from 'clsx';
import { Bell, ChevronRight, Siren } from 'lucide-react';
import type { AuthUser } from '../types';
import { initials, parseFullName } from '../utils/format';
import { NAV_ITEMS, ROLE_META, type TabId } from '../config/workspace';
import { BrandMark } from './Sidebar';
import { Badge } from '../ui/primitives';

interface TopNavbarProps {
  user: AuthUser;
  workspaceName: string;
  activeTab: TabId;
  onNavigate: (tab: TabId) => void;
  onOpenAccount: () => void;
  unreadCount: number;
  online: boolean;
  canReport: boolean;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({ user, workspaceName, activeTab, onNavigate, onOpenAccount, unreadCount, online, canReport }) => {
  const role = user.role;
  const meta = ROLE_META[role];
  const person = parseFullName(user.full_name);
  const page = NAV_ITEMS.find((n) => n.id === activeTab);

  return (
    <header className="pt-safe z-30 shrink-0 border-b border-ink-100 bg-white/85 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {/* Left: brand on mobile, breadcrumb on desktop */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="lg:hidden"><BrandMark size={36} className="!bg-ink-950 ring-0" /></div>
          <div className="hidden min-w-0 items-center gap-2 text-[13px] font-semibold lg:flex">
            <span className="text-ink-400">{role === 'HOSPITAL_STAFF' ? workspaceName : meta.label}</span>
            <ChevronRight className="size-4 text-ink-300" />
            <span className="truncate text-ink-900">{page?.label}</span>
          </div>
          <div className="min-w-0 leading-tight lg:hidden">
            <p className="truncate text-[15px] font-extrabold text-ink-900">{page?.label}</p>
            <p className="truncate text-[11.5px] font-semibold text-ink-400">{role === 'HOSPITAL_STAFF' ? workspaceName : meta.label}</p>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden sm:inline-flex">
            <Badge tone={online ? 'signal' : 'alert'} dot pulse={online}>{online ? 'Live' : 'Offline'}</Badge>
          </span>

          {canReport && activeTab !== 'intake' && (
            <button onClick={() => onNavigate('intake')} className="btn btn-danger btn-sm hidden sm:inline-flex">
              <Siren className="size-4" strokeWidth={2.3} /> Report emergency
            </button>
          )}

          <button
            onClick={() => onNavigate('notifications')}
            aria-label={`Alerts${unreadCount ? `, ${unreadCount} unread` : ''}`}
            className={clsx('relative inline-flex size-10 items-center justify-center rounded-xl border border-ink-100 bg-white text-ink-600 transition hover:border-ink-200 hover:text-ink-900', activeTab === 'notifications' && 'border-signal-200 bg-signal-50 text-signal-700')}
          >
            <Bell className="size-[19px]" strokeWidth={2} />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-alert-500 px-1 text-[10px] font-extrabold text-white ring-2 ring-white tabnum">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={onOpenAccount}
            className="flex h-10 items-center gap-2.5 rounded-xl border border-ink-100 bg-white pl-1.5 pr-1.5 transition hover:border-ink-200 sm:pr-3"
            aria-label="Open account menu"
          >
            <span className={clsx('inline-flex size-7 items-center justify-center rounded-lg text-[11px] font-extrabold', meta.tone === 'signal' ? 'bg-signal-50 text-signal-700' : meta.tone === 'alert' ? 'bg-alert-50 text-alert-600' : 'bg-info-50 text-info-600')}>
              {initials(person.name)}
            </span>
            <span className="hidden max-w-[150px] text-left leading-tight sm:block">
              <span className="block truncate text-[12.5px] font-bold text-ink-900">{person.name}</span>
              <span className="block text-[10.5px] font-semibold text-ink-400">{meta.short}</span>
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
