import React, { useRef, useEffect, useState } from 'react';
import type { User } from '../types';

interface MentionSuggestion {
    user: User;
    label: string;
}

interface MentionAutocompleteProps {
    query: string; // the text after the last '@'
    users: User[];
    onSelect: (username: string) => void;
    visible: boolean;
    anchorRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Floating autocomplete panel for @mentions.
 * Shown when the user types '@' in the composer.
 */
export const MentionAutocomplete: React.FC<MentionAutocompleteProps> = ({
    query,
    users,
    onSelect,
    visible,
    /* anchorRef intentionally unused; reserved for future floating position */
}) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);

    const matches: MentionSuggestion[] = users
        .map((u) => ({
            user: u,
            label: u.display_name || u.full_name || u.email,
        }))
        .filter((s) => s.label.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 6);

    // Reset selection when query changes by remounting the panel (key prop below)

    // Keyboard navigation (arrow keys, enter, escape)
    useEffect(() => {
        if (!visible) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % matches.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + matches.length) % matches.length);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                if (matches[selectedIndex]) {
                    e.preventDefault();
                    onSelect(matches[selectedIndex].label);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [visible, matches, selectedIndex, onSelect]);

    if (!visible || matches.length === 0) return null;

    return (
        <div
            key={query}
            ref={panelRef}
            className="absolute bottom-full left-0 z-50 mb-1 w-64 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-0 shadow-xl"
            style={{ maxHeight: 240 }}
        >
            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                People
            </div>
            {matches.map((s, i) => (
                <button
                    key={s.user.id}
                    type="button"
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${i === selectedIndex
                        ? 'bg-brand-primary/10 text-neutral-900'
                        : 'text-neutral-700 hover:bg-neutral-100'
                        }`}
                    onMouseEnter={() => setSelectedIndex(i)}
                    onMouseDown={(e) => {
                        e.preventDefault(); // keep focus on textarea
                        onSelect(s.label);
                    }}
                >
                    <div className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-neutral-200 text-xs font-bold text-neutral-700">
                        {s.label.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <div className="truncate font-semibold">{s.label}</div>
                        <div className="truncate text-[11px] text-neutral-500">{s.user.email}</div>
                    </div>
                </button>
            ))}
        </div>
    );
};
