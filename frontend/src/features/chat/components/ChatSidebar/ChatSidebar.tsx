import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MoreVertical, MessageSquarePlus, CircleDashed, Users, UserCircle, UserPlus, Settings } from 'lucide-react';
import { Skeleton } from '../../../../components/Skeleton';
import { StatusDot } from '../../../../components/PresenceSelector';
import { NotificationBell } from '../../../notifications/NotificationBell';
import type { ChatTarget, User, ChatRoom, UnreadCounts } from '../../../../types';
import { format } from 'date-fns';

// Helper to format time like "12:30 PM" or "Yesterday"
const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
        return format(date, 'h:mm a');
    }
    return format(date, 'MMM d');
};

interface ChatManager {
    users: User[];
    rooms: ChatRoom[];
    unreadCounts: UnreadCounts;
    active: ChatTarget | null;
    selectTarget: (target: ChatTarget) => void | Promise<void>;
    onlineUsers: Record<number, boolean>;
    lastPreviews: Record<string, { text: string; timestamp: string }>;
    isUsersLoading: boolean;
    isRoomsLoading: boolean;
    currentUserId: number | null;
    isConnected: boolean;
}

interface ChatSidebarProps extends ChatManager {
    onOpenCreateRoom: () => void;
    onOpenFindPeople: () => void;
    userProfile: { name: string; avatarUrl?: string };
}

export function ChatSidebar({
    users,
    rooms,
    unreadCounts,
    active,
    selectTarget,
    onlineUsers,
    lastPreviews,
    isUsersLoading,
    isRoomsLoading,
    isConnected,
    onOpenCreateRoom,
    onOpenFindPeople,
    userProfile,
}: ChatSidebarProps) {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'groups'>('all');

    const allItems = useMemo(() => {
        const dmItems = users.map(u => ({
            type: 'dm' as const,
            data: u,
            key: `dm:${u.id}`,
            name: u.full_name || u.email,
            lastMsg: lastPreviews[`dm:${u.id}`],
            unread: unreadCounts.users[u.id] || 0,
            timestamp: lastPreviews[`dm:${u.id}`]?.timestamp ? new Date(lastPreviews[`dm:${u.id}`].timestamp).getTime() : 0
        }));

        const roomItems = rooms.map(r => ({
            type: 'room' as const,
            data: r,
            key: `room:${r.id}`,
            name: r.name,
            lastMsg: lastPreviews[`room:${r.id}`],
            unread: unreadCounts.rooms[r.id] || 0,
            timestamp: lastPreviews[`room:${r.id}`]?.timestamp ? new Date(lastPreviews[`room:${r.id}`].timestamp).getTime() : 0
        }));

        return [...dmItems, ...roomItems].sort((a, b) => b.timestamp - a.timestamp);
    }, [users, rooms, lastPreviews, unreadCounts]);

    const filteredItems = useMemo(() => {
        let res = allItems;
        if (query.trim()) {
            res = res.filter(i => i.name.toLowerCase().includes(query.toLowerCase()));
        }
        if (activeFilter === 'unread') {
            res = res.filter(i => i.unread > 0);
        }
        if (activeFilter === 'groups') {
            res = res.filter(i => i.type === 'room');
        }
        return res;
    }, [allItems, query, activeFilter]);

    return (
        <div className="flex h-full w-full flex-col bg-[var(--color-surface)]">
            {/* WhatsApp Header */}
            <div className="flex h-[60px] flex-shrink-0 items-center justify-between px-4 py-2 bg-[var(--color-bg-header)]">
                <div className="relative h-10 w-10 rounded-full bg-neutral-300 dark:bg-neutral-600 overflow-hidden cursor-pointer group">
                    {userProfile.avatarUrl ? (
                        <img src={userProfile.avatarUrl} alt="Me" className="h-full w-full object-cover" />
                    ) : (
                        <UserCircleIcon />
                    )}
                    {isConnected && (
                        <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[var(--color-bg-header)] bg-emerald-500" title="Connected" />
                    )}
                </div>

                <div className="flex items-center gap-1 text-[var(--color-text-secondary)]">
                    <button className="p-2 rounded-full hover:bg-black/10 transition-colors" title="Communities">
                        <Users size={20} />
                    </button>
                    <button className="p-2 rounded-full hover:bg-black/10 transition-colors" title="Status">
                        <CircleDashed size={20} />
                    </button>
                    <NotificationBell />
                    <button className="p-2 rounded-full hover:bg-black/10 transition-colors" title="Find People" onClick={onOpenFindPeople}>
                        <UserPlus size={20} />
                    </button>
                    <button className="p-2 rounded-full hover:bg-black/10 transition-colors" title="New Group Chat" onClick={onOpenCreateRoom}>
                        <MessageSquarePlus size={20} />
                    </button>
                    <button className="p-2 rounded-full hover:bg-black/10 transition-colors" title="Settings" onClick={() => navigate('/settings')}>
                        <Settings size={20} />
                    </button>
                    <button className="p-2 rounded-full hover:bg-black/10 transition-colors" title="Menu">
                        <MoreVertical size={20} />
                    </button>
                </div>
            </div>

            {/* Search & Filter */}
            <div className="p-2 border-b border-[var(--color-border)] space-y-2">
                <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pl-1">
                        <Search size={18} className="text-[var(--color-text-secondary)]" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search or start new chat"
                        className="w-full rounded-lg bg-[var(--color-surface-alt)] py-2 pl-12 pr-4 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                </div>

                {/* Filter Chips */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {['All', 'Unread', 'Groups'].map(f => {
                        const isActive = activeFilter === f.toLowerCase();
                        return (
                            <button
                                key={f}
                                onClick={() => setActiveFilter(f.toLowerCase() as 'all' | 'unread' | 'groups')}
                                className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${isActive
                                    ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                                    : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt-hover)]'
                                    }`}
                            >
                                {f}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto scrollbar-thin hover:scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-600">
                {isUsersLoading || isRoomsLoading ? (
                    <div className="space-y-2 p-2">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3 px-3 py-2">
                                <Skeleton className="h-12 w-12 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div>
                        {filteredItems.map(item => {
                            const isActive = active?.type === item.type && (
                                item.type === 'dm'
                                    ? (active.type === 'dm' && active.user.id === (item.data as User).id)
                                    : (active.type === 'room' && active.room.id === (item.data as ChatRoom).id)
                            );
                            const isRoom = item.type === 'room';

                            return (
                                <div
                                    key={item.key}
                                    onClick={() => selectTarget(isRoom ? { type: 'room', room: item.data as ChatRoom } : { type: 'dm', user: item.data as User })}
                                    className={`group flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--color-surface-alt-hover)] ${isActive ? 'bg-[var(--color-surface-alt)]' : ''
                                        }`}
                                >
                                    <div className="relative flex-shrink-0">
                                        <div className="h-12 w-12 rounded-full bg-neutral-200 dark:bg-neutral-600 flex items-center justify-center text-lg font-medium text-neutral-600 dark:text-neutral-300">
                                            {(item.data as User).avatar_url ? (
                                                <img src={(item.data as User).avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                                            ) : (
                                                item.name.slice(0, 1).toUpperCase()
                                            )}
                                        </div>
                                        {!isRoom && onlineUsers[(item.data as User).id] && (
                                            <StatusDot status="available" size={12} className="absolute -bottom-0.5 -right-0.5 ring-2 ring-[var(--color-surface)]" />
                                        )}
                                    </div>

                                    <div className="min-w-0 flex-1 border-b border-[var(--color-border)] pb-2.5 group-last:border-0 h-full flex flex-col justify-center">
                                        <div className="flex items-center justify-between">
                                            <span className="truncate text-[16px] font-normal text-[var(--color-text-primary)]">{item.name}</span>
                                            {item.timestamp > 0 && (
                                                <span className={`text-xs ${item.unread > 0 ? 'font-semibold text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}>
                                                    {formatTime(item.lastMsg?.timestamp)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between mt-0.5">
                                            <div className="truncate text-[13px] text-[var(--color-text-muted)] pr-2">
                                                {item.lastMsg
                                                    ? item.lastMsg.text
                                                    : !isRoom && (item.data as User).username
                                                        ? <span className="text-[var(--color-accent)] opacity-80">@{(item.data as User).username}</span>
                                                        : <span className="italic opacity-80 text-xs text-[var(--color-text-muted)]">Tap to chat</span>
                                                }
                                            </div>
                                            {item.unread > 0 && (
                                                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--color-brand-light)] px-1 text-[11px] font-bold text-white">
                                                    {item.unread}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

const UserCircleIcon = () => (
    <UserCircle className="h-full w-full text-neutral-500" />
);
