import React from 'react';
import { X, MessageSquare } from 'lucide-react';
import type { User, PresenceStatus } from '../types';

const PRESENCE_LABELS: Record<PresenceStatus, string> = {
  available: 'Available',
  busy: 'Busy',
  dnd: 'Do Not Disturb',
  away: 'Away',
};

const PRESENCE_COLORS: Record<PresenceStatus, string> = {
  available: '#22c55e',
  busy: '#f59e0b',
  dnd: '#ef4444',
  away: '#6b7280',
};

interface UserProfileModalProps {
  user: User;
  isMe?: boolean;
  onClose: () => void;
  onStartDM?: (user: User) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  isMe = false,
  onClose,
  onStartDM,
}) => {
  const displayName = user.display_name || user.full_name || user.email;
  const presence = (user.presence_status ?? 'available') as PresenceStatus;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative w-80 rounded-2xl bg-[var(--color-surface)] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header gradient */}
        <div className="h-24 bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-brand-light)] relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 rounded-full p-1 bg-black/20 hover:bg-black/30 text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Avatar */}
        <div className="flex justify-center -mt-10 mb-3">
          <div className="relative">
            <div className="h-20 w-20 rounded-full border-4 border-[var(--color-surface)] bg-neutral-200 dark:bg-neutral-600 flex items-center justify-center text-3xl font-bold text-neutral-600 dark:text-neutral-300 overflow-hidden shadow-md">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                displayName.slice(0, 1).toUpperCase()
              )}
            </div>
            <span
              className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-[var(--color-surface)]"
              style={{ backgroundColor: PRESENCE_COLORS[presence] }}
            />
          </div>
        </div>

        {/* Info */}
        <div className="px-6 pb-6 text-center space-y-1">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] leading-tight">
            {displayName}
          </h2>
          {user.username && (
            <p className="text-sm text-[var(--color-accent)] font-medium">
              @{user.username}
            </p>
          )}
          <p className="text-xs text-[var(--color-text-muted)]">
            {PRESENCE_LABELS[presence]}
          </p>
          {user.status_message && (
            <p className="text-sm text-[var(--color-text-secondary)] italic mt-1">
              "{user.status_message}"
            </p>
          )}
          {user.bio && (
            <p className="text-sm text-[var(--color-text-secondary)] mt-2 leading-relaxed border-t border-[var(--color-border)] pt-2">
              {user.bio}
            </p>
          )}

          {!isMe && onStartDM && (
            <button
              onClick={() => { onStartDM(user); onClose(); }}
              className="mt-4 flex items-center gap-2 mx-auto px-5 py-2 rounded-full bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <MessageSquare size={15} />
              Message
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
