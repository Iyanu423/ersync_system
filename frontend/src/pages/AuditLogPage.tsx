import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, ScrollText, Search, Braces } from 'lucide-react';
import { ApiService } from '../services/api';
import type { AuditEvent } from '../types';
import { Badge, Button, Card, EmptyState, KV, Modal, PageHeader, Select, Skeleton } from '../ui/primitives';
import { cleanName, relTime, titleCase, type Tone } from '../utils/format';
import { clockTime, parseUtc } from '../utils/time';

const entityTone = (t: string): Tone => {
  const k = (t || '').toUpperCase();
  if (k.includes('REFERRAL')) return 'info';
  if (k.includes('EMERGENCY')) return 'alert';
  if (k.includes('HOSPITAL')) return 'signal';
  if (k.includes('BED')) return 'plum';
  return 'neutral';
};

export const AuditLogPage: React.FC = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [entity, setEntity] = useState('ALL');
  const [selected, setSelected] = useState<AuditEvent | null>(null);

  const load = async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const res = await ApiService.getTimeline();
      setEvents(res?.events || []);
    } catch (e) {
      console.error('Failed to load audit trail', e);
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  const entities = useMemo(() => Array.from(new Set(events.map((e) => e.entity_type).filter(Boolean))), [events]);
  const label = (e: AuditEvent) => titleCase((e as any).event_type || e.action);
  const time = (e: AuditEvent) => e.created_at || (e as any).timestamp;

  const visible = events.filter((e) => {
    if (entity !== 'ALL' && e.entity_type !== entity) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [label(e), e.actor, e.entity_type, e.entity_id, JSON.stringify(e.metadata || {})].some((v) => (v || '').toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ScrollText}
        tone="plum"
        eyebrow="Accountability"
        title="Audit Trail"
        description="A chronological record of every automated decision and operator action — who did what, to what, and when."
        actions={<Button data-desktop-only variant="secondary" icon={RefreshCw} loading={refreshing} onClick={() => load(true)}>Refresh</Button>}
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-300" />
          <input className="input !h-10 !pl-10" placeholder="Search actor, action or entity" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select className="sm:w-56 [&_.input]:!h-10" title="Filter by entity" value={entity} onChange={setEntity}
          options={[{ value: 'ALL', label: `All entities (${events.length})` }, ...entities.map((t) => ({ value: t, label: titleCase(t) }))]} />
      </div>

      <Card pad={false} className="overflow-hidden">
        {!loaded ? (
          <div className="space-y-px p-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="mb-2 h-14" />)}</div>
        ) : visible.length > 0 ? (
          <ul className="divide-y divide-ink-100">
            {visible.map((e, idx) => (
              <li key={e.id || idx}>
                <button onClick={() => setSelected(e)} className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition hover:bg-ink-25 sm:px-5">
                  <span className="hidden w-[72px] shrink-0 text-[12px] font-semibold text-ink-400 tabnum sm:block">{clockTime(time(e))}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] font-bold text-ink-900">{label(e)}</span>
                      <Badge tone={entityTone(e.entity_type)} small>{titleCase(e.entity_type)}</Badge>
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] font-medium text-ink-500">
                      {e.actor ? `${e.actor} · ` : ''}{cleanName((e.metadata as any)?.hospital_name) || (e.metadata as any)?.reason || (e.metadata as any)?.trigger || (e.entity_id ? `#${String(e.entity_id).slice(0, 8)}` : '')}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11.5px] font-semibold text-ink-300 sm:hidden">{relTime(time(e))}</span>
                  <Braces className="hidden size-4 shrink-0 text-ink-300 sm:block" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={ScrollText} title="No matching events" description={events.length ? 'Try clearing the search or entity filter.' : 'Events will be recorded as the system runs.'} />
        )}
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} size="md" icon={ScrollText} tone="plum" title={selected ? label(selected) : ''} subtitle={selected ? `${parseUtc(time(selected)).toLocaleString()} · ${relTime(time(selected))}` : undefined}
        footer={<Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>}>
        {selected && (
          <div className="space-y-4">
            <div className="divide-y divide-ink-100">
              <KV label="Actor">{selected.actor || '—'}</KV>
              <KV label="Entity">{titleCase(selected.entity_type)}</KV>
              <KV label="Entity ID"><span className="break-all tabnum">{selected.entity_id || '—'}</span></KV>
            </div>
            {selected.metadata && Object.keys(selected.metadata).length > 0 && (
              <div>
                <p className="eyebrow mb-2">Details</p>
                <pre className="max-h-64 overflow-auto rounded-2xl bg-ink-950 p-4 text-[12px] leading-relaxed text-signal-200">{JSON.stringify(selected.metadata, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
