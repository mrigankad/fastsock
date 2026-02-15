import React, { useEffect, useState } from 'react';
import { Monitor, Smartphone, Trash2, LogOut } from 'lucide-react';
import { authApi, type UserSession } from '../../services/api';
import { format } from 'date-fns';

function deviceIcon(userAgent?: string) {
  if (!userAgent) return <Monitor size={18} />;
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return <Smartphone size={18} />;
  }
  return <Monitor size={18} />;
}

function formatUA(ua?: string) {
  if (!ua) return 'Unknown device';
  if (ua.length > 80) return ua.slice(0, 80) + '…';
  return ua;
}

export const SessionsTab: React.FC = () => {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    authApi.getSessions()
      .then(r => setSessions(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const revokeOne = async (id: string) => {
    setRevoking(id);
    try {
      await authApi.revokeSession(id);
      setSessions(s => s.filter(x => x.id !== id));
    } finally {
      setRevoking(null);
    }
  };

  const revokeAll = async () => {
    if (!confirm('Log out all other devices?')) return;
    await authApi.revokeAllSessions();
    setSessions([]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Active Sessions</h2>
        <p className="text-sm text-[var(--color-text-muted)]">Devices currently logged in to your account</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-16 rounded-lg bg-[var(--color-surface-alt)] animate-pulse" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] italic">No active sessions found.</p>
      ) : (
        <div className="space-y-2">
          {sessions.map(s => (
            <div
              key={s.id}
              className="flex items-start gap-3 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
            >
              <div className="mt-0.5 text-[var(--color-text-secondary)]">
                {deviceIcon(s.user_agent)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--color-text-primary)] truncate">{formatUA(s.user_agent)}</p>
                <div className="flex gap-3 mt-0.5 text-xs text-[var(--color-text-muted)]">
                  {s.ip_address && <span>{s.ip_address}</span>}
                  {s.last_active_at && (
                    <span>Active {format(new Date(s.last_active_at), 'MMM d, h:mm a')}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => revokeOne(s.id)}
                disabled={revoking === s.id}
                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                title="Revoke this session"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {sessions.length > 0 && (
        <button
          onClick={revokeAll}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-400 text-red-500 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <LogOut size={15} />
          Log out all sessions
        </button>
      )}
    </div>
  );
};
