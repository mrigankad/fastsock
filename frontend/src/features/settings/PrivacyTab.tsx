import React, { useEffect, useState } from 'react';
import { authApi, type PrivacySettings } from '../../services/api';

type Visibility = 'everyone' | 'contacts' | 'nobody';

const DEFAULT: PrivacySettings = {
  show_last_seen: 'everyone',
  show_avatar: 'everyone',
  show_bio: 'everyone',
  allow_dms: 'everyone',
  show_read_receipts: true,
};

const VISIBILITY_OPTIONS: { value: Visibility; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'contacts', label: 'Contacts only' },
  { value: 'nobody', label: 'Nobody' },
];

export const PrivacyTab: React.FC = () => {
  const [settings, setSettings] = useState<PrivacySettings>(DEFAULT);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    authApi.getPrivacy().then(r => setSettings(r.data)).catch(() => {});
  }, []);

  const handleSave = async () => {
    setStatus('saving');
    try {
      const r = await authApi.updatePrivacy(settings);
      setSettings(r.data);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Privacy</h2>
        <p className="text-sm text-[var(--color-text-muted)]">Control who can see your information</p>
      </div>

      <div className="space-y-4">
        <VisibilityRow
          label="Last seen"
          description="Who can see when you were last online"
          value={settings.show_last_seen}
          onChange={(v) => setSettings((s) => ({ ...s, show_last_seen: v }))}
        />
        <VisibilityRow
          label="Profile photo"
          description="Who can see your avatar"
          value={settings.show_avatar}
          onChange={(v) => setSettings((s) => ({ ...s, show_avatar: v }))}
        />
        <VisibilityRow
          label="Bio"
          description="Who can see your bio"
          value={settings.show_bio}
          onChange={(v) => setSettings((s) => ({ ...s, show_bio: v }))}
        />
        <VisibilityRow
          label="Direct messages"
          description="Who can send you direct messages"
          value={settings.allow_dms}
          onChange={(v) => setSettings((s) => ({ ...s, allow_dms: v }))}
        />

        {/* Read receipts toggle */}
        <div className="flex items-start justify-between py-3 border-b border-[var(--color-border)]">
          <div>
            <p className="text-sm font-medium">Read receipts</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Let others see when you've read their messages.
            </p>
          </div>
          <button
            onClick={() => setSettings((s) => ({ ...s, show_read_receipts: !s.show_read_receipts }))}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
              settings.show_read_receipts ? 'bg-[var(--color-brand)]' : 'bg-neutral-300 dark:bg-neutral-600'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${
                settings.show_read_receipts ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {status === 'error' && (
        <p className="text-sm text-red-500">Failed to save. Please try again.</p>
      )}

      <button
        onClick={handleSave}
        disabled={status === 'saving'}
        className="px-5 py-2 rounded-lg bg-[var(--color-brand)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {status === 'saving' ? 'Saving…' : status === 'saved' ? '✓ Saved' : 'Save changes'}
      </button>
    </div>
  );
};

interface VisibilityRowProps {
  label: string;
  description: string;
  value: Visibility;
  onChange: (v: Visibility) => void;
}

const VisibilityRow: React.FC<VisibilityRowProps> = ({ label, description, value, onChange }) => (
  <div className="flex items-start justify-between py-3 border-b border-[var(--color-border)]">
    <div className="mr-4">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{description}</p>
    </div>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Visibility)}
      className="text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 outline-none focus:ring-2 focus:ring-[var(--color-brand)] shrink-0"
    >
      {VISIBILITY_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
);
