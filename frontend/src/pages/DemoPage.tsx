import React from 'react';
import clsx from 'clsx';
import type { OneClickDemoResult } from '../types';
import { Badge, Button, Card, CardHeader, IconTile, PageHeader } from '../ui/primitives';
import { cleanName } from '../utils/format';
import { clockTime } from '../utils/time';
import { Award, ArrowRight, Brain, Building2, CheckCircle2, ChevronRight, FlaskConical, ScrollText, ShieldAlert, Sliders, XCircle, Zap } from 'lucide-react';

interface Props {
  isDemoRunning: boolean;
  demoResult: OneClickDemoResult | null;
  onRunDemo: () => void;
  onViewExplanations: (emergencyId: string) => void;
  onViewCommand: () => void;
}

const STEPS = [
  { title: 'Incident intake', icon: ShieldAlert, tone: 'alert' as const },
  { title: 'Clinical triage', icon: Brain, tone: 'info' as const },
  { title: 'Hard safety gate', icon: Award, tone: 'plum' as const },
  { title: 'Hospital #1 pinged', icon: Building2, tone: 'neutral' as const },
  { title: 'Surge reject', icon: XCircle, tone: 'warn' as const },
  { title: 'Auto failover', icon: CheckCircle2, tone: 'signal' as const },
  { title: 'Bed reserved', icon: ArrowRight, tone: 'signal' as const },
];

export const DemoPage: React.FC<Props> = ({ isDemoRunning, demoResult, onRunDemo, onViewExplanations, onViewCommand }) => (
  <div className="space-y-6">
    <PageHeader icon={FlaskConical} tone="warn" eyebrow="Simulation" title="Failover Lab"
      description="Stress-test the network end to end: a critical trauma arrives, the first hospital refuses, and ER-Sync re-routes to a second one with a bed guaranteed." />

    <Card className="!p-0 overflow-hidden">
      <div className="relative flex flex-col gap-6 bg-gradient-to-br from-ink-950 to-ink-800 p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-16 size-64 rounded-full bg-signal-400/20 blur-3xl" />
        <div className="relative max-w-2xl">
          <Badge tone="warn" className="mb-3">End-to-end scenario</Badge>
          <h2 className="text-[24px] font-extrabold leading-tight sm:text-[28px]">Motorcycle collision · Lekki</h2>
          <p className="mt-2 text-[13.5px] font-medium leading-relaxed text-ink-200/90">
            Creates a real critical case in the system, simulates a bed-surge rejection at the top-ranked hospital, and shows the automatic failover — no manual steps.
          </p>
        </div>
        <Button variant="primary" size="lg" icon={Zap} loading={isDemoRunning} onClick={onRunDemo} className="relative w-full shrink-0 sm:w-auto">
          {isDemoRunning ? 'Simulating…' : demoResult ? 'Run again' : 'Run failover scenario'}
        </Button>
      </div>
    </Card>

    <div>
      <p className="eyebrow mb-3">Algorithmic lifecycle</p>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 xl:grid-cols-7">
        {STEPS.map((s, i) => (
          <div key={s.title} className={clsx('card flex min-w-[124px] shrink-0 flex-col items-center gap-2.5 p-4 text-center transition-all duration-500 sm:min-w-0', demoResult ? 'border-signal-200' : isDemoRunning ? 'animate-pulse' : 'opacity-80')}
            style={{ transitionDelay: `${i * 60}ms` }}>
            <IconTile icon={s.icon} tone={s.tone} />
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-300">Step {String(i + 1).padStart(2, '0')}</p>
              <p className="mt-0.5 text-[12.5px] font-bold leading-tight text-ink-900">{s.title}</p>
            </div>
          </div>
        ))}
      </div>
    </div>

    {demoResult && (
      <div className="animate-rise space-y-6">
        <Card>
          <CardHeader icon={CheckCircle2} tone="signal" title={demoResult.scenario_name} subtitle={`Incident ${demoResult.incident_reference} · ${demoResult.severity}`}
            right={<>
              <Button variant="secondary" size="sm" icon={Sliders} onClick={() => onViewExplanations(demoResult.emergency_id)} className="hidden sm:inline-flex">Decision audit</Button>
              <Button variant="primary" size="sm" onClick={onViewCommand}>Command Center <ChevronRight className="size-4" /></Button>
            </>} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-ink-100 bg-ink-25 p-4"><p className="eyebrow">Incident</p><p className="mt-1.5 text-[15px] font-bold text-ink-900">Motorcycle collision</p><p className="text-[12.5px] font-semibold text-alert-600">Severity: {demoResult.severity}</p></div>
            <div className="rounded-2xl border border-alert-100 bg-alert-50/60 p-4"><p className="eyebrow !text-alert-700">Hospital #1 · declined</p><p className="mt-1.5 truncate text-[15px] font-bold text-ink-900">{cleanName(demoResult.first_hospital_attempted.name)}</p><p className="text-[12.5px] font-semibold text-alert-700">{demoResult.first_rejection_reason || 'Bed surge'}</p></div>
            <div className="rounded-2xl border border-warn-100 bg-warn-50/60 p-4"><p className="eyebrow !text-warn-700">Failover</p><p className="mt-1.5 text-[15px] font-bold text-ink-900">Automatic</p><p className="text-[12.5px] font-semibold text-warn-700">Zero manual intervention</p></div>
            <div className="rounded-2xl border border-signal-100 bg-signal-50/70 p-4"><p className="eyebrow !text-signal-700">Final destination</p><p className="mt-1.5 truncate text-[15px] font-bold text-ink-900">{cleanName(demoResult.second_hospital_attempted.name)}</p><p className="text-[12.5px] font-semibold text-signal-700">{demoResult.bed_reserved ? 'Bed reserved' : 'Pending'} · ETA {demoResult.eta_minutes} min · {demoResult.distance_km} km</p></div>
          </div>
        </Card>

        {demoResult.timeline?.length > 0 && (
          <Card>
            <CardHeader icon={ScrollText} tone="plum" title="Scenario timeline" subtitle="What happened, step by step" />
            <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-ink-100">
              {demoResult.timeline.map((s) => (
                <li key={s.step_number} className="relative flex gap-4">
                  <span className="relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-signal-600 text-[12px] font-extrabold text-white ring-4 ring-white">{s.step_number}</span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[13.5px] font-bold text-ink-900">{s.title}</p>
                      <span className="shrink-0 text-[11px] font-semibold text-ink-300 tabnum">{clockTime(s.timestamp)}</span>
                    </div>
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-400">{s.status}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        )}
      </div>
    )}
  </div>
);
