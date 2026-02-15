import React, { useState, useRef, useEffect } from 'react';
import { Search, X, UserPlus, Loader2 } from 'lucide-react';
import { chatApi } from '../services/api';
import type { User } from '../types';
import { StatusDot } from './PresenceSelector';

interface FindPeopleModalProps {
  onClose: () => void;
  onStartDM: (user: User) => void;
  currentUserId: number | null;
}

export const FindPeopleModal: React.FC<FindPeopleModalProps> = ({
  onClose,
  onStartDM,
  currentUserId,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await chatApi.searchUsers(query);
        setResults(data.filter(u => u.id !== currentUserId));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, currentUserId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[var(--color-surface)] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <h3 className="font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <UserPlus size={18} className="text-[var(--color-accent)]" />
            Find People
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]">
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search by @username or name…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full rounded-xl bg-[var(--color-surface-alt)] py-2.5 pl-9 pr-4 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
            />
          </div>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Tip: type @username for exact match
          </p>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto">
          {loading && (
            <div className="flex justify-center py-6">
              <Loader2 size={20} className="animate-spin text-[var(--color-accent)]" />
            </div>
          )}
          {!loading && query.trim() && results.length === 0 && (
            <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">No users found</p>
          )}
          {!loading && results.map(user => {
            const displayName = user.display_name || user.full_name || user.email;
            return (
              <div
                key={user.id}
                onClick={() => { onStartDM(user); onClose(); }}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--color-surface-alt)] transition-colors"
              >
                <div className="relative flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-neutral-200 dark:bg-neutral-600 flex items-center justify-center text-sm font-bold text-neutral-600 dark:text-neutral-300 overflow-hidden">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      displayName.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <StatusDot
                    status={user.presence_status ?? 'available'}
                    size={10}
                    className="absolute -bottom-0.5 -right-0.5 ring-2 ring-[var(--color-surface)]"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{displayName}</p>
                  {user.username && (
                    <p className="text-xs text-[var(--color-accent)] truncate">@{user.username}</p>
                  )}
                  {user.bio && (
                    <p className="text-xs text-[var(--color-text-muted)] truncate">{user.bio}</p>
                  )}
                </div>
                <MessageSquareIcon />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const MessageSquareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-text-muted)] flex-shrink-0">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
