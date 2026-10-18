import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { CheckCircle2, XCircle, Info, TriangleAlert, X, AlertOctagon, HelpCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Modal, Button } from './primitives';
import type { Tone } from '../utils/format';

/* ───────── Toasts ───────── */
type ToastKind = 'success' | 'error' | 'info' | 'warning';
interface ToastItem {
  id: number; kind: ToastKind; title: string; message?: string; duration: number;
  action?: { label: string; onClick: () => void };
}
interface ToastOptions { message?: string; duration?: number; action?: { label: string; onClick: () => void } }

interface ToastApi {
  success: (title: string, opts?: ToastOptions) => void;
  error: (title: string, opts?: ToastOptions) => void;
  info: (title: string, opts?: ToastOptions) => void;
  warning: (title: string, opts?: ToastOptions) => void;
}

/* ───────── Confirm ───────── */
export interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warn' | 'primary';
  icon?: LucideIcon;
}

interface UIApi { toast: ToastApi; confirm: (opts: ConfirmOptions) => Promise<boolean> }
const UIContext = createContext<UIApi | null>(null);

export const useUI = () => {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used inside <UIProvider>');
  return ctx;
};
export const useToast = () => useUI().toast;
export const useConfirm = () => useUI().confirm;

const KIND: Record<ToastKind, { icon: LucideIcon; ring: string; iconCls: string; bar: string }> = {
  success: { icon: CheckCircle2, ring: 'border-signal-200', iconCls: 'bg-signal-50 text-signal-600', bar: 'bg-signal-500' },
  error: { icon: XCircle, ring: 'border-alert-200', iconCls: 'bg-alert-50 text-alert-600', bar: 'bg-alert-500' },
  info: { icon: Info, ring: 'border-info-200', iconCls: 'bg-info-50 text-info-600', bar: 'bg-info-500' },
  warning: { icon: TriangleAlert, ring: 'border-warn-200', iconCls: 'bg-warn-50 text-warn-700', bar: 'bg-warn-500' },
};

function vibrate(ms: number | number[]) {
  try { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms); } catch { /* unsupported */ }
}

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback((kind: ToastKind, title: string, opts: ToastOptions = {}) => {
    const id = ++idRef.current;
    const duration = opts.duration ?? (kind === 'error' ? 7000 : kind === 'warning' ? 5500 : 4000);
    setToasts((t) => [...t.slice(-3), { id, kind, title, message: opts.message, duration, action: opts.action }]);
    window.setTimeout(() => dismiss(id), duration);
    if (kind === 'error') vibrate([30, 40, 30]); else if (kind === 'success') vibrate(12);
  }, [dismiss]);

  const toast = useMemo<ToastApi>(() => ({
    success: (t, o) => push('success', t, o),
    error: (t, o) => push('error', t, o),
    info: (t, o) => push('info', t, o),
    warning: (t, o) => push('warning', t, o),
  }), [push]);

  /* confirm */
  const [dialog, setDialog] = useState<(ConfirmOptions & { open: boolean }) | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => {
    resolver.current = resolve;
    setDialog({ ...opts, open: true });
  }), []);

  const settle = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setDialog((d) => (d ? { ...d, open: false } : d));
  };

  const api = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  const tone = dialog?.tone ?? 'primary';
  const modalTone: Tone = tone === 'danger' ? 'alert' : tone === 'warn' ? 'warn' : 'signal';
  const DialogIcon = dialog?.icon ?? (tone === 'danger' ? AlertOctagon : tone === 'warn' ? TriangleAlert : HelpCircle);

  return (
    <UIContext.Provider value={api}>
      {children}

      {/* Toast viewport */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2.5 p-3 pt-[calc(env(safe-area-inset-top)+12px)] sm:items-end sm:p-5" aria-live="polite">
        {toasts.map((t) => {
          const k = KIND[t.kind];
          return (
            <div key={t.id} className={clsx('animate-toast-in pointer-events-auto relative w-full max-w-[400px] overflow-hidden rounded-2xl border bg-white shadow-[var(--shadow-lift)]', k.ring)} role="status">
              <div className="flex items-start gap-3 p-3.5 pr-3">
                <span className={clsx('mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-xl', k.iconCls)}>
                  <k.icon className="size-[18px]" strokeWidth={2.3} />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[13.5px] font-bold leading-snug text-ink-900">{t.title}</p>
                  {t.message && <p className="mt-0.5 text-[12.5px] font-medium leading-snug text-ink-500">{t.message}</p>}
                  {t.action && (
                    <button onClick={() => { t.action!.onClick(); dismiss(t.id); }} className="mt-2 text-[12.5px] font-bold text-signal-700 hover:text-signal-800">
                      {t.action.label} →
                    </button>
                  )}
                </div>
                <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-ink-300 transition hover:bg-ink-50 hover:text-ink-700">
                  <X className="size-4" />
                </button>
              </div>
              <span className={clsx('absolute bottom-0 left-0 h-[3px] w-full origin-left', k.bar)} style={{ animation: `toast-bar ${t.duration}ms linear forwards` }} />
            </div>
          );
        })}
      </div>

      {/* Confirm dialog */}
      <Modal
        open={!!dialog?.open}
        onClose={() => settle(false)}
        size="sm"
        icon={DialogIcon}
        tone={modalTone}
        title={dialog?.title}
        footer={
          <>
            <Button variant="secondary" onClick={() => settle(false)}>{dialog?.cancelLabel ?? 'Cancel'}</Button>
            <Button variant={tone === 'danger' ? 'danger' : tone === 'warn' ? 'warn' : 'primary'} onClick={() => settle(true)}>
              {dialog?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        {dialog?.message && <div className="text-[13.5px] font-medium leading-relaxed text-ink-600">{dialog.message}</div>}
      </Modal>
    </UIContext.Provider>
  );
};
