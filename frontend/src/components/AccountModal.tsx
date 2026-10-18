import React from 'react';
import { LogOut, ShieldCheck, Building2, KeyRound } from 'lucide-react';
import type { AuthUser } from '../types';
import { ROLE_META } from '../config/workspace';
import { initials, parseFullName } from '../utils/format';
import { Badge, Button, KV, Modal } from '../ui/primitives';

export const AccountModal: React.FC<{ open: boolean; user: AuthUser; hospitalName?: string; onClose: () => void; onLogout: () => void }> = ({ open, user, hospitalName, onClose, onLogout }) => {
  const meta = ROLE_META[user.role];
  const { name, title } = parseFullName(user.full_name);
  return (
    <Modal open={open} onClose={onClose} size="sm" title="Your account" subtitle="Signed in to ER-Sync"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Close</Button>
        <Button variant="danger" icon={LogOut} onClick={onLogout}>Sign out</Button>
      </>}>
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <span className="inline-flex size-16 shrink-0 items-center justify-center rounded-2xl bg-ink-900 text-[22px] font-extrabold text-white">{initials(name)}</span>
          <div className="min-w-0">
            <p className="truncate text-[17px] font-extrabold text-ink-900">{name}</p>
            {title && <p className="text-[12.5px] font-medium text-ink-500">{title}</p>}
            <Badge tone={meta.tone === 'signal' ? 'signal' : meta.tone === 'alert' ? 'alert' : 'info'} className="mt-2"><meta.icon className="size-3" />{meta.label}</Badge>
          </div>
        </div>
        <div className="divide-y divide-ink-100 rounded-2xl border border-ink-100 px-4">
          <KV label="Username"><span className="inline-flex items-center gap-1.5"><KeyRound className="size-3.5 text-ink-400" />{user.username}</span></KV>
          <KV label="Access"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-ink-400" />{meta.tagline}</span></KV>
          {user.hospital_id && <KV label="Hospital"><span className="inline-flex items-center gap-1.5"><Building2 className="size-3.5 text-ink-400" />{hospitalName || user.hospital_id}</span></KV>}
        </div>
      </div>
    </Modal>
  );
};
