import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../services/api';
import toast from 'react-hot-toast';

export const AccountTab: React.FC = () => {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    display_name: user?.display_name ?? '',
    username: user?.username ?? '',
    bio: user?.bio ?? '',
    status_message: user?.status_message ?? '',
    avatar_url: user?.avatar_url ?? '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await authApi.updateProfile(form);
      setUser(data);
      toast.success('Profile updated');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Account</h2>
        <p className="text-sm text-[var(--color-text-muted)]">Manage your profile and personal info</p>
      </div>

      {/* Avatar preview */}
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-neutral-300 dark:bg-neutral-600 flex items-center justify-center overflow-hidden shrink-0">
          {form.avatar_url ? (
            <img src={form.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl text-neutral-600 dark:text-white">
              {(form.display_name || user?.full_name || user?.email || '?').slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <p className="font-medium">{user?.full_name || user?.email}</p>
          <p className="text-sm text-[var(--color-text-muted)]">{user?.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Field
          label="Display name"
          value={form.display_name}
          onChange={(v) => setForm((f) => ({ ...f, display_name: v }))}
          placeholder="Your display name"
        />
        <Field
          label="Username"
          value={form.username}
          onChange={(v) => setForm((f) => ({ ...f, username: v.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
          placeholder="your_handle"
          prefix="@"
        />
        <Field
          label="Bio"
          value={form.bio}
          onChange={(v) => setForm((f) => ({ ...f, bio: v }))}
          placeholder="A short bio about yourself"
          multiline
        />
        <Field
          label="Status message"
          value={form.status_message}
          onChange={(v) => setForm((f) => ({ ...f, status_message: v }))}
          placeholder="What are you up to?"
        />
        <Field
          label="Avatar URL"
          value={form.avatar_url}
          onChange={(v) => setForm((f) => ({ ...f, avatar_url: v }))}
          placeholder="https://example.com/avatar.jpg"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-5 py-2 rounded-lg bg-[var(--color-brand)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>

      {/* Danger zone */}
      <div className="mt-8 rounded-lg border border-red-300 dark:border-red-800 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">Danger zone</h3>
        <p className="text-xs text-[var(--color-text-muted)]">
          Permanently delete your account and all messages. This cannot be undone.
        </p>
        <button
          onClick={async () => {
            if (!confirm('Delete your account permanently? This cannot be undone.')) return;
            try {
              await authApi.deleteAccount();
              logout();
              navigate('/login');
            } catch {
              toast.error('Failed to delete account');
            }
          }}
          className="px-4 py-2 rounded-lg border border-red-400 text-red-500 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          Delete my account
        </button>
      </div>
    </div>
  );
};

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  prefix?: string;
  multiline?: boolean;
}

const Field: React.FC<FieldProps> = ({ label, value, onChange, placeholder, prefix, multiline }) => (
  <div className="space-y-1">
    <label className="block text-sm font-medium text-[var(--color-text-secondary)]">{label}</label>
    <div className="flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus-within:ring-2 focus-within:ring-[var(--color-brand)] overflow-hidden">
      {prefix && (
        <span className="pl-3 text-[var(--color-text-muted)] select-none">{prefix}</span>
      )}
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="flex-1 px-3 py-2 text-sm bg-transparent outline-none resize-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 text-sm bg-transparent outline-none"
        />
      )}
    </div>
  </div>
);
