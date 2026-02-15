import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Lock, Monitor, Smartphone } from 'lucide-react';
import { AccountTab } from './AccountTab';
import { PrivacyTab } from './PrivacyTab';
import { AppearanceTab } from './AppearanceTab';
import { SessionsTab } from './SessionsTab';

type Tab = 'account' | 'privacy' | 'appearance' | 'sessions';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'account', label: 'Account', icon: <User size={18} /> },
  { id: 'privacy', label: 'Privacy', icon: <Lock size={18} /> },
  { id: 'appearance', label: 'Appearance', icon: <Monitor size={18} /> },
  { id: 'sessions', label: 'Sessions', icon: <Smartphone size={18} /> },
];

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('account');

  return (
    <div className="flex h-screen bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      {/* Sidebar */}
      <div className="w-64 border-r border-[var(--color-border)] flex flex-col bg-[var(--color-surface)]">
        <div className="flex items-center gap-3 p-4 border-b border-[var(--color-border)]">
          <button
            onClick={() => navigate('/')}
            className="p-1 rounded-full hover:bg-[var(--color-surface-alt)] transition-colors"
            aria-label="Back to chat"
          >
            <ArrowLeft size={20} className="text-[var(--color-text-secondary)]" />
          </button>
          <h1 className="text-base font-semibold">Settings</h1>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activeTab === tab.id
                  ? 'bg-[var(--color-brand)] text-white'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)]'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
        {activeTab === 'account' && <AccountTab />}
        {activeTab === 'privacy' && <PrivacyTab />}
        {activeTab === 'appearance' && <AppearanceTab />}
        {activeTab === 'sessions' && <SessionsTab />}
      </div>
    </div>
  );
};

export default SettingsPage;
