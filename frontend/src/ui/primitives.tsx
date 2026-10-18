import React, { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { X, Loader2, Inbox } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Tone } from '../utils/format';
import { useWorkspace } from './WorkspaceContext';
import { ROLE_META } from '../config/workspace';

/* ───────── Button ───────── */
type Variant = 'primary' | 'secondary' | 'danger' | 'danger-soft' | 'ghost' | 'dark' | 'warn';
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: LucideIcon;
  iconOnly?: boolean;
}
export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary', size = 'md', loading, icon: Icon, iconOnly, className, children, disabled, type = 'button', ...rest
}) => (
  <button
    type={type}
    disabled={disabled || loading}
    className={clsx('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', size === 'lg' && 'btn-lg', iconOnly && 'btn-icon', className)}
    {...rest}
  >
    {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" strokeWidth={2.2} /> : null}
    {!iconOnly && children}
  </button>
);

/* ───────── Badge ───────── */
export const Badge: React.FC<{ tone?: Tone; dot?: boolean; pulse?: boolean; small?: boolean; className?: string; children: React.ReactNode }> = ({
  tone = 'neutral', dot, pulse, small, className, children,
}) => {
  const dotColor: Record<Tone, string> = {
    neutral: 'bg-ink-400', signal: 'bg-signal-500', alert: 'bg-alert-500', warn: 'bg-warn-500', info: 'bg-info-500', plum: 'bg-plum-600', dark: 'bg-white',
  };
  return (
    <span className={clsx('badge', `badge-${tone}`, small && 'badge-sm', className)}>
      {dot && (
        <span className="relative flex size-1.5">
          {pulse && <span className={clsx('ping-soft absolute inline-flex size-full rounded-full opacity-70', dotColor[tone])} />}
          <span className={clsx('relative inline-flex size-1.5 rounded-full', dotColor[tone])} />
        </span>
      )}
      {children}
    </span>
  );
};

/* ───────── Icon tile ───────── */
const tileTone: Record<Tone, string> = {
  neutral: 'bg-ink-50 text-ink-600', signal: 'bg-signal-50 text-signal-700', alert: 'bg-alert-50 text-alert-600',
  warn: 'bg-warn-50 text-warn-700', info: 'bg-info-50 text-info-600', plum: 'bg-plum-50 text-plum-600', dark: 'bg-ink-900 text-white',
};
export const IconTile: React.FC<{ icon: LucideIcon; tone?: Tone; size?: 'sm' | 'md' | 'lg'; className?: string }> = ({ icon: Icon, tone = 'neutral', size = 'md', className }) => (
  <span className={clsx('inline-flex shrink-0 items-center justify-center', tileTone[tone],
    size === 'sm' ? 'size-8 rounded-[10px]' : size === 'lg' ? 'size-12 rounded-2xl' : 'size-10 rounded-xl', className)}>
    <Icon className={size === 'lg' ? 'size-6' : size === 'sm' ? 'size-4' : 'size-5'} strokeWidth={2} />
  </span>
);

/* ───────── Card ───────── */
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { pad?: boolean; interactive?: boolean }> = ({ pad = true, interactive, className, children, ...rest }) => (
  <div className={clsx('card', pad && 'card-pad', interactive && 'card-interactive cursor-pointer', className)} {...rest}>{children}</div>
);

export const CardHeader: React.FC<{ icon?: LucideIcon; tone?: Tone; title: string; subtitle?: string; right?: React.ReactNode; className?: string }> = ({ icon, tone = 'neutral', title, subtitle, right, className }) => (
  <div className={clsx('mb-4 flex items-start justify-between gap-3', className)}>
    <div className="flex min-w-0 items-center gap-3">
      {icon && <IconTile icon={icon} tone={tone} size="sm" />}
      <div className="min-w-0">
        <h3 className="truncate text-[14.5px] font-bold text-ink-900">{title}</h3>
        {subtitle && <p className="truncate text-[12px] font-medium text-ink-400">{subtitle}</p>}
      </div>
    </div>
    {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
  </div>
);

/* ───────── Page header ───────── */
export const PageHeader: React.FC<{
  title: string; description?: string; eyebrow?: string; actions?: React.ReactNode; icon?: LucideIcon; tone?: Tone;
}> = ({ title, description, eyebrow, actions, icon, tone = 'signal' }) => {
  const { role } = useWorkspace();
  const meta = ROLE_META[role];
  return (
    <header className="animate-rise mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        {icon && <IconTile icon={icon} tone={tone} size="lg" className="hidden sm:inline-flex" />}
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="eyebrow">{meta.label}{eyebrow ? ` · ${eyebrow}` : ''}</span>
          </div>
          <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-[30px]">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-[13.5px] font-medium leading-relaxed text-ink-500">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </header>
  );
};

/* ───────── Stat card ───────── */
export const StatCard: React.FC<{
  label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: LucideIcon; tone?: Tone; loading?: boolean; children?: React.ReactNode;
}> = ({ label, value, hint, icon, tone = 'neutral', loading, children }) => {
  const rail: Record<Tone, string> = {
    neutral: 'bg-ink-200', signal: 'bg-signal-500', alert: 'bg-alert-500', warn: 'bg-warn-500', info: 'bg-info-500', plum: 'bg-plum-600', dark: 'bg-ink-900',
  };
  return (
    <div className="card relative overflow-hidden p-4 sm:p-5">
      <span className={clsx('absolute inset-y-4 left-0 w-1 rounded-r-full', rail[tone])} />
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">{label}</span>
        {icon && <IconTile icon={icon} tone={tone} size="sm" />}
      </div>
      <div className="mt-2.5 text-[28px] font-extrabold leading-none tracking-tight text-ink-900 tabnum">
        {loading ? <div className="skeleton h-7 w-20" /> : value}
      </div>
      {hint && <div className="mt-2 text-[12px] font-medium text-ink-500">{hint}</div>}
      {children}
    </div>
  );
};

/* ───────── Progress ───────── */
export const ProgressBar: React.FC<{ value: number; tone?: Tone; className?: string; height?: number }> = ({ value, tone = 'signal', className, height = 8 }) => {
  const fill: Record<Tone, string> = {
    neutral: 'bg-ink-400', signal: 'bg-signal-500', alert: 'bg-alert-500', warn: 'bg-warn-500', info: 'bg-info-500', plum: 'bg-plum-600', dark: 'bg-ink-900',
  };
  return (
    <div className={clsx('w-full overflow-hidden rounded-full bg-ink-100', className)} style={{ height }}>
      <div className={clsx('h-full rounded-full transition-all duration-500', fill[tone])} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
};

/* ───────── Empty state ───────── */
export const EmptyState: React.FC<{ icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode; compact?: boolean }> = ({
  icon: Icon = Inbox, title, description, action, compact,
}) => (
  <div className={clsx('flex flex-col items-center justify-center text-center', compact ? 'py-8' : 'py-14')}>
    <span className="mb-3 inline-flex size-12 items-center justify-center rounded-2xl bg-ink-50 text-ink-300"><Icon className="size-6" strokeWidth={1.8} /></span>
    <p className="text-[14px] font-bold text-ink-800">{title}</p>
    {description && <p className="mt-1 max-w-xs text-[12.5px] font-medium text-ink-400">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

/* ───────── Alert banner ───────── */
export const Alert: React.FC<{ tone?: 'warn' | 'alert' | 'info' | 'signal'; icon?: LucideIcon; title?: string; children?: React.ReactNode; action?: React.ReactNode; className?: string }> = ({
  tone = 'info', icon: Icon, title, children, action, className,
}) => {
  const styles = { warn: 'bg-warn-50 border-warn-100 text-warn-800', alert: 'bg-alert-50 border-alert-100 text-alert-800', info: 'bg-info-50 border-info-100 text-info-700', signal: 'bg-signal-50 border-signal-100 text-signal-800' } as const;
  return (
    <div className={clsx('flex items-start gap-3 rounded-2xl border p-3.5 text-[13px] font-medium', styles[tone], className)} role="alert">
      {Icon && <Icon className="mt-0.5 size-4.5 shrink-0" strokeWidth={2.2} />}
      <div className="min-w-0 flex-1">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
      </div>
      {action}
    </div>
  );
};

/* ───────── Switch ───────── */
export const Switch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }> = ({ checked, onChange, disabled, label }) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className="switch" onClick={() => onChange(!checked)} />
);

/* ───────── Segmented ───────── */
export function Segmented<T extends string>({ value, options, onChange, className }: {
  value: T; options: Array<{ value: T; label: React.ReactNode; icon?: LucideIcon }>; onChange: (v: T) => void; className?: string;
}) {
  return (
    <div className={clsx('segmented', className)} role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} data-active={value === o.value} onClick={() => onChange(o.value)}>
          {o.icon && <o.icon className="size-4" strokeWidth={2.1} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ───────── Field ───────── */
export const Field: React.FC<{ label: string; hint?: string; error?: string | null; className?: string; children: React.ReactNode }> = ({ label, hint, error, className, children }) => (
  <div className={className}>
    <label className="label">{label}</label>
    {children}
    {error ? <p className="mt-1.5 text-[12px] font-semibold text-alert-600">{error}</p> : hint ? <p className="mt-1.5 text-[12px] font-medium text-ink-400">{hint}</p> : null}
  </div>
);

/* ───────── Modal / bottom-sheet ───────── */
export const Modal: React.FC<{
  open: boolean; onClose: () => void; title?: string; subtitle?: string; icon?: LucideIcon; tone?: Tone;
  size?: 'sm' | 'md' | 'lg' | 'xl'; children: React.ReactNode; footer?: React.ReactNode; dismissible?: boolean;
}> = ({ open, onClose, title, subtitle, icon, tone = 'signal', size = 'md', children, footer, dismissible = true }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && dismissible) onClose(); };
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, dismissible, onClose]);

  if (!open) return null;
  const width = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }[size];

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="animate-fade-in absolute inset-0 bg-ink-950/55 backdrop-blur-[3px]" onClick={() => dismissible && onClose()} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={clsx(
          'animate-sheet-up sm:animate-pop-in relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-white shadow-[var(--shadow-pop)] outline-none',
          'rounded-t-[26px] sm:max-h-[88dvh] sm:rounded-[24px]', width,
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-ink-200 sm:hidden" />
        {(title || icon) && (
          <div className="flex items-start gap-3.5 border-b border-ink-100 px-5 pb-4 pt-4 sm:px-6 sm:pt-5">
            {icon && <IconTile icon={icon} tone={tone} />}
            <div className="min-w-0 flex-1">
              {title && <h2 className="text-[17px] font-extrabold leading-snug text-ink-900">{title}</h2>}
              {subtitle && <p className="mt-0.5 text-[13px] font-medium text-ink-500">{subtitle}</p>}
            </div>
            {dismissible && (
              <button onClick={onClose} aria-label="Close" className="-mr-1.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-ink-400 transition hover:bg-ink-50 hover:text-ink-800">
                <X className="size-5" />
              </button>
            )}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="pb-safe flex flex-col-reverse gap-2 border-t border-ink-100 bg-ink-25 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">{footer}</div>}
      </div>
    </div>
  );
};

/* ───────── Key-value row ───────── */
export const KV: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 py-2 text-[13px]">
    <span className="shrink-0 font-medium text-ink-400">{label}</span>
    <span className="text-right font-semibold text-ink-800">{children}</span>
  </div>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => <div className={clsx('skeleton', className)} />;
