import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Bell, BellRing, CheckCheck, RefreshCw, Siren, Inbox, ShieldCheck, ShieldX, Shuffle, BedDouble, Clock, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ApiService } from '../services/api';
import type { AppNotification } from '../types';
import { useToast } from '../ui/UIProvider';
import { Badge, Button, Card, EmptyState, IconTile, PageHeader, Segmented, Skeleton } from '../ui/primitives';
import { relTime, titleCase, type Tone } from '../utils/format';

const TYPE_META: Record<string, { icon: LucideIcon; tone: Tone }> = {
  EMERGENCY_DISPATCH: { icon: Siren, tone: 'alert' },
  ACCEPTANCE_REQUEST: { icon: Inbox, tone: 'info' },
  REFERRAL_CONFIRMED: { icon: ShieldCheck, tone: 'signal' },
  REFERRAL_REJECTED: { icon: ShieldX, tone: 'alert' },
  FAILOVER_TRIGGERED: { icon: Shuffle, tone: 'warn' },
  BED_RESERVED: { icon: BedDouble, tone: 'signal' },
  STALE_ALERT: { icon: Clock, tone: 'warn' },
};

export const NotificationsPage: React.FC<{ onChanged?: () => void }> = ({ onChanged }) => {
  const toast = useToast();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [markingAll, setMarkingAll] = useState(false);

  const load = async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      setItems(await ApiService.getNotifications(60));
    } catch (e: any) {
      if (manual) toast.error('Could not load alerts', { message: e?.message });
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unread = items.filter((n) => n.status !== 'READ');

  const markRead = async (n: AppNotification) => {
    if (n.status === 'READ') return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, status: 'READ' } : x)));
    try {
      await ApiService.markNotificationRead(n.id);
      onChanged?.();
    } catch (e: any) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, status: n.status } : x)));
      toast.error('Could not mark as read', { message: e?.message });
    }
  };

  const markAll = async () => {
    if (!unread.length) return;
    setMarkingAll(true);
    const ids = unread.map((n) => n.id);
    setItems((prev) => prev.map((x) => (ids.includes(x.id) ? { ...x, status: 'READ' } : x)));
    try {
      await Promise.all(ids.map((id) => ApiService.markNotificationRead(id)));
      toast.success('All alerts marked as read');
      onChanged?.();
    } catch (e: any) {
      toast.error('Some alerts could not be updated', { message: e?.message });
      load();
    } finally {
      setMarkingAll(false);
    }
  };

  const visible = filter === 'UNREAD' ? unread : items;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BellRing}
        tone="warn"
        eyebrow="Notifications"
        title="Alerts"
        description="Dispatch, referral and system events addressed to your workspace."
        actions={
          <>
            <Button data-desktop-only variant="secondary" icon={RefreshCw} loading={refreshing} onClick={() => load(true)}>Refresh</Button>
            <Button variant="dark" icon={CheckCheck} loading={markingAll} disabled={!unread.length} onClick={markAll}>Mark all read</Button>
          </>
        }
      />

      <Segmented<'ALL' | 'UNREAD'> value={filter} onChange={setFilter} options={[{ value: 'ALL', label: `All (${items.length})` }, { value: 'UNREAD', label: `Unread (${unread.length})` }]} />

      {!loaded ? (
        <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      ) : visible.length > 0 ? (
        <div className="space-y-2.5">
          {visible.map((n) => {
            const meta = TYPE_META[n.type] || { icon: Info, tone: 'neutral' as Tone };
            const isUnread = n.status !== 'READ';
            return (
              <button key={n.id} onClick={() => markRead(n)} className={clsx('card flex w-full items-start gap-4 p-4 text-left transition active:scale-[.995] sm:p-5', isUnread ? 'border-signal-200 bg-signal-50/30' : 'hover:border-ink-200')}>
                <IconTile icon={meta.icon} tone={meta.tone} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-bold text-ink-900">{n.title}</span>
                    {isUnread && <Badge tone="signal" small dot pulse>New</Badge>}
                  </span>
                  <span className="mt-1 block text-[13px] font-medium leading-relaxed text-ink-600">{n.message}</span>
                  <span className="mt-2 flex items-center gap-2 text-[11.5px] font-semibold text-ink-400">
                    <span>{titleCase(n.type)}</span><span>·</span><span>{relTime(n.created_at)}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <Card><EmptyState icon={Bell} title={filter === 'UNREAD' ? "You're all caught up" : 'No alerts yet'} description={filter === 'UNREAD' ? 'There are no unread alerts.' : 'Dispatch and referral events will appear here.'} /></Card>
      )}
    </div>
  );
};
