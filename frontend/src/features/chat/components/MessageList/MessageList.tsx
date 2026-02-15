import React, { useEffect, useRef } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { MessageBubble } from './MessageBubble';
import type { Message } from '../../../../types';

interface MessageListProps {
    messages: Message[];
    currentUserId: number;
    onReact: (msgId: number, emoji: string) => void;
    onReply: (msg: Message) => void;
    onDelete?: (msg: Message) => void;
    isLoadingMore: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
}

const DateDivider = ({ date }: { date: string }) => {
    let label = date;
    const d = new Date(date);
    if (isToday(d)) label = 'Today';
    else if (isYesterday(d)) label = 'Yesterday';
    else label = format(d, 'MMMM d, yyyy');

    return (
        <div className="flex items-center justify-center my-4">
            <span className="bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 text-[11px] font-medium px-2.5 py-0.5 rounded-md border border-neutral-200 dark:border-neutral-700 shadow-sm uppercase tracking-wide">
                {label}
            </span>
        </div>
    );

};

export const MessageList: React.FC<MessageListProps> = ({
    messages,
    currentUserId,
    onReact,
    onReply,
    onDelete,
    isLoadingMore,
    hasMore,
    onLoadMore
}) => {
    const bottomRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Group messages by day
    const groupedMessages = React.useMemo(() => {
        const groups: Array<{ date: string; msgs: Message[] }> = [];
        messages.forEach((msg) => {
            const date = format(new Date(msg.timestamp), 'yyyy-MM-dd');
            const lastGroup = groups[groups.length - 1];
            if (lastGroup && lastGroup.date === date) {
                lastGroup.msgs.push(msg);
            } else {
                groups.push({ date, msgs: [msg] });
            }
        });
        return groups;
    }, [messages]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (e.currentTarget.scrollTop === 0 && hasMore && !isLoadingMore) {
            onLoadMore();
        }
    };

    return (
        <div
            ref={containerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-2 py-4 scrollbar-thin scrollbar-thumb-neutral-200 dark:scrollbar-thumb-neutral-700"
        >

            {isLoadingMore && <div className="text-center py-2 text-xs text-neutral-400">Loading history...</div>}

            {groupedMessages.map((group) => (
                <React.Fragment key={group.date}>
                    <DateDivider date={group.date} />
                    {group.msgs.map((msg, idx) => (
                        <MessageBubble
                            key={msg.id}
                            message={msg}
                            isMe={msg.sender_id === currentUserId}
                            onReact={(emoji) => onReact(msg.id, emoji)}
                            onReply={() => onReply(msg)}
                            onDelete={onDelete ? () => onDelete(msg) : undefined}
                            previousMessage={idx > 0 ? group.msgs[idx - 1] : undefined}
                        />
                    ))}
                </React.Fragment>
            ))}
            <div ref={bottomRef} />
        </div>
    );
};
