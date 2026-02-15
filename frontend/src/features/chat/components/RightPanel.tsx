import React from 'react';
import { X } from 'lucide-react';
import type { ChatRoom, User } from '../../../types';
import { Button } from '../../../design-system';

type ChatTarget =
  | { type: 'dm'; user: User }
  | { type: 'room'; room: ChatRoom };

export type RightPanelProps = {
  active: ChatTarget | null;
  me: User;
  meStatus?: string;
  isConnected: boolean;
  notificationPermission: NotificationPermission;
  onEnableNotifications: () => void;
  onClose: () => void;
};

export const RightPanel: React.FC<RightPanelProps> = ({
  active,
  me,
  meStatus,
  isConnected,
  notificationPermission,
  onEnableNotifications,
  onClose,
}) => {
  const title =
    active?.type === 'dm'
      ? active.user.full_name || active.user.email
      : active?.type === 'room'
        ? active.room.name
        : 'Details';

  return (
    <div className="flex h-full flex-col bg-neutral-0">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-neutral-900">{title}</div>
          <div className="mt-0.5 text-xs text-neutral-600">
            {active?.type === 'dm' ? 'Direct message' : active?.type === 'room' ? 'Room' : ''}
          </div>
        </div>
        <Button variant="icon" size="sm" onClick={onClose} aria-label="Close details">
          <X size={18} />
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-auto px-4 py-4">
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <div className="text-xs font-semibold text-neutral-700">Connection</div>
          <div className="mt-1 flex items-center gap-2 text-sm text-neutral-900">
            <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-semantic-success' : 'bg-semantic-warning'}`} />
            <span>{isConnected ? 'Connected' : 'Reconnecting…'}</span>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <div className="text-xs font-semibold text-neutral-700">Notifications</div>
          <div className="mt-1 text-sm text-neutral-900">
            {notificationPermission === 'granted' && 'Enabled'}
            {notificationPermission === 'denied' && 'Blocked in browser settings'}
            {notificationPermission === 'default' && 'Not enabled'}
          </div>
          {notificationPermission !== 'granted' && (
            <div className="mt-2">
              <Button variant="secondary" size="sm" onClick={onEnableNotifications}>
                Enable
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <div className="text-xs font-semibold text-neutral-700">Profile</div>
          <div className="mt-1 text-sm font-semibold text-neutral-900">{me.full_name || me.email}</div>
          {meStatus?.trim() ? <div className="mt-0.5 text-xs text-neutral-600">{meStatus.trim()}</div> : <div className="mt-0.5 text-xs text-neutral-600">{me.email}</div>}
        </div>

        {active?.type === 'room' && (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <div className="text-xs font-semibold text-neutral-700">Room</div>
            <div className="mt-1 text-sm font-semibold text-neutral-900">{active.room.name}</div>
            <div className="mt-0.5 text-xs text-neutral-600">Members, files, and call timeline will live here.</div>
          </div>
        )}
      </div>
    </div>
  );
};
