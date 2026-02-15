import React, { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { format } from 'date-fns';
import {
  useUnreadNotificationCount,
  useNotifications,
  markAllRead,
  type AppNotification,
} from './useNotifications';
import { useQueryClient } from '@tanstack/react-query';

const TYPE_LABEL: Record<string, string> = {
  dm: 'New message',
  mention: 'Mentioned you',
  reaction: 'Reacted to your message',
  call: 'Missed call',
};

export const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: count = 0 } = useUnreadNotificationCount();
  const { data: notifications = [] } = useNotifications();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => setOpen(o => !o);

  const handleMarkAllRead = async () => {
    await markAllRead();
    qc.invalidateQueries({ queryKey: ['notif-count'] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-full hover:bg-black/10 transition-colors text-[var(--color-text-secondary)]"
        title="Notifications"
      >
        <Bell size={20} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--color-brand-light)] px-0.5 text-[10px] font-bold text-white leading-none">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
            <span className="text-sm font-semibold">Notifications</span>
            {count > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-[var(--color-border)]">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
                No notifications yet
              </p>
            ) : (
              notifications.map(n => <NotifRow key={n.id} n={n} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const NotifRow: React.FC<{ n: AppNotification }> = ({ n }) => (
  <div className={`flex items-start gap-3 px-4 py-3 ${!n.is_read ? 'bg-[var(--color-accent-soft)]' : ''}`}>
    {!n.is_read && (
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-brand-light)]" />
    )}
    <div className={`${n.is_read ? 'ml-5' : ''} min-w-0 flex-1`}>
      <p className="text-sm text-[var(--color-text-primary)]">
        {TYPE_LABEL[n.type] ?? n.type}
      </p>
      {n.created_at && (
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          {format(new Date(n.created_at), 'MMM d, h:mm a')}
        </p>
      )}
    </div>
  </div>
);
