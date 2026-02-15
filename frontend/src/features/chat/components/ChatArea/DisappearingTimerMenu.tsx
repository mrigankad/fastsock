import React, { useState, useEffect, useRef } from 'react';
import { Timer, ChevronDown } from 'lucide-react';
import { chatApi } from '../../../../services/api';
import type { ChatTarget } from '../../../../types';

const TIMER_OPTIONS = [
  { label: 'Off', seconds: 0 },
  { label: '30 seconds', seconds: 30 },
  { label: '5 minutes', seconds: 300 },
  { label: '1 hour', seconds: 3600 },
  { label: '24 hours', seconds: 86400 },
  { label: '7 days', seconds: 604800 },
];

interface Props {
  active: ChatTarget;
}

function getTargetParams(active: ChatTarget): { type: string; id: number } {
  return active.type === 'dm'
    ? { type: 'dm', id: active.user.id }
    : { type: 'room', id: active.room.id };
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return 'Off';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${seconds / 60}m`;
  if (seconds < 86400) return `${seconds / 3600}h`;
  return `${seconds / 86400}d`;
}

export const DisappearingTimerMenu: React.FC<Props> = ({ active }) => {
  const [duration, setDuration] = useState(0);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { type, id } = getTargetParams(active);

  // Load current timer when active conversation changes
  useEffect(() => {
    let cancelled = false;
    chatApi.getDisappearingTimer(type, id)
      .then(res => { if (!cancelled) setDuration(res.data.duration_seconds); })
      .catch(() => { if (!cancelled) setDuration(0); });
    return () => { cancelled = true; };
  }, [type, id]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = async (seconds: number) => {
    setOpen(false);
    if (seconds === duration) return;
    setSaving(true);
    try {
      await chatApi.setDisappearingTimer(type, id, seconds);
      setDuration(seconds);
    } catch {
      // silently fail — timer just won't be set
    } finally {
      setSaving(false);
    }
  };

  const isActive = duration > 0;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(p => !p)}
        title={`Disappearing messages: ${formatDuration(duration)}`}
        className={`flex items-center gap-1 rounded-full px-2 py-1 text-[12px] transition-colors ${
          isActive
            ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
            : 'text-[var(--color-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5'
        } ${saving ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <Timer size={15} />
        {isActive && <span className="font-medium">{formatDuration(duration)}</span>}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl bg-[var(--color-surface)] shadow-lg border border-black/10 dark:border-white/10 overflow-hidden">
          <div className="px-3 py-2 border-b border-black/5 dark:border-white/5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Disappearing messages
            </p>
          </div>
          {TIMER_OPTIONS.map(opt => (
            <button
              key={opt.seconds}
              onClick={() => handleSelect(opt.seconds)}
              className={`w-full text-left px-3 py-2 text-[13px] flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
                duration === opt.seconds ? 'text-[var(--color-accent)] font-medium' : 'text-[var(--color-text-primary)]'
              }`}
            >
              {opt.label}
              {duration === opt.seconds && (
                <span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
