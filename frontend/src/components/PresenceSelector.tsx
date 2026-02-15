import React, { useState, useRef, useEffect } from 'react';
import type { PresenceStatus } from '../types';

const STATUSES: { value: PresenceStatus; label: string; description: string }[] = [
    { value: 'available', label: 'Available', description: 'Show as active and available' },
    { value: 'busy', label: 'Busy', description: 'Calls will be blocked' },
    { value: 'dnd', label: 'Do Not Disturb', description: 'No calls or notifications' },
    { value: 'away', label: 'Away', description: 'Appear as away' },
];

const STATUS_COLORS: Record<PresenceStatus, string> = {
    available: '#22c55e',
    busy: '#ef4444',
    dnd: '#ef4444',
    away: '#f59e0b',
};

interface PresenceSelectorProps {
    current: PresenceStatus;
    onChange: (status: PresenceStatus) => void;
    className?: string;
}

export const PresenceSelector: React.FC<PresenceSelectorProps> = ({
    current,
    onChange,
    className = '',
}) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const currentStatus = STATUSES.find((s) => s.value === current) || STATUSES[0];

    return (
        <div ref={ref} className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-0 px-3 py-1.5 text-sm font-semibold text-neutral-800 shadow-sm transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
                <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: STATUS_COLORS[current] }}
                />
                {currentStatus.label}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-neutral-500">
                    <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            {open && (
                <div className="absolute left-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-0 shadow-xl">
                    {STATUSES.map((s) => (
                        <button
                            key={s.value}
                            type="button"
                            onClick={() => {
                                onChange(s.value);
                                setOpen(false);
                            }}
                            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${s.value === current
                                    ? 'bg-neutral-100 font-semibold text-neutral-900'
                                    : 'text-neutral-700 hover:bg-neutral-50'
                                }`}
                        >
                            <span
                                className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                                style={{ background: STATUS_COLORS[s.value] }}
                            />
                            <div className="min-w-0">
                                <div className="text-sm font-semibold">{s.label}</div>
                                <div className="text-[11px] text-neutral-500">{s.description}</div>
                            </div>
                            {s.value === current && (
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="ml-auto text-brand-primary flex-shrink-0">
                                    <path d="M4 8L7 11L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

/**
 * Inline status dot: tiny colored circle to show next to user names.
 */
export const StatusDot: React.FC<{ status?: PresenceStatus; size?: number; className?: string }> = ({
    status = 'available',
    size = 10,
    className = '',
}) => (
    <span
        className={`status-indicator status-${status} ${className}`}
        style={{ width: size, height: size }}
        title={STATUSES.find((s) => s.value === status)?.label || 'Unknown'}
    />
);
