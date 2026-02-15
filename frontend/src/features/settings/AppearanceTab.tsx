import React from 'react';
import { useThemeStore } from '../../store/themeStore';
import { Moon, Sun } from 'lucide-react';

export const AppearanceTab: React.FC = () => {
  const { isDarkMode, toggleDarkMode } = useThemeStore();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Appearance</h2>
        <p className="text-sm text-[var(--color-text-muted)]">Customize the look and feel</p>
      </div>

      <div className="flex items-center justify-between py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          {isDarkMode ? <Moon size={20} /> : <Sun size={20} />}
          <div>
            <p className="text-sm font-medium">Dark mode</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {isDarkMode ? 'Dark theme is on' : 'Light theme is on'}
            </p>
          </div>
        </div>
        <button
          onClick={toggleDarkMode}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
            isDarkMode ? 'bg-[var(--color-brand)]' : 'bg-neutral-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${
              isDarkMode ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <div className="rounded-xl overflow-hidden border border-[var(--color-border)]">
        <div className="p-4 bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Preview</p>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-bg-header)]">
            <div className="h-9 w-9 rounded-full bg-[var(--color-brand)] flex items-center justify-center text-white text-sm font-bold">
              A
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Alice</p>
              <p className="text-xs text-[var(--color-text-muted)]">Hey, how's it going?</p>
            </div>
            <span className="ml-auto text-xs text-[var(--color-text-muted)]">12:34</span>
          </div>
        </div>
      </div>
    </div>
  );
};
