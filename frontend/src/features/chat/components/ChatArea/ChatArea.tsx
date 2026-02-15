import React, { useState } from 'react';
import { MoreVertical, Search, ArrowLeft } from 'lucide-react';
import { MessageList } from '../MessageList/MessageList';
import { Composer } from '../Composer/Composer';
import { DisappearingTimerMenu } from './DisappearingTimerMenu';
import type { ChatTarget, Message, ReplyTo } from '../../../../types';

interface ChatAreaProps {
    active: ChatTarget | null;
    messages: Message[];
    currentUserId: number | null;
    onSend: (text: string, file: File | null, replyToId: number | null, messageType?: 'text' | 'image' | 'audio') => Promise<void>;
    onTyping: (text: string) => void;
    isUploading: boolean;
    isLoadingHistory: boolean;
    isLoadingMore: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
    onMobileMenuOpen: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
    active,
    messages,
    currentUserId,
    onSend,
    onTyping,
    isUploading,
    isLoadingHistory,
    isLoadingMore,
    hasMore,
    onLoadMore,
    onMobileMenuOpen
}) => {
    const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);

    if (!active) {
        return (
            <div className="flex h-full flex-col items-center justify-center bg-[var(--color-surface-alt)] text-center border-b-[6px] border-[var(--color-brand-light)]">
                <div className="max-w-md space-y-4">
                    <h1 className="text-3xl font-light text-[var(--color-text-primary)]">WhatsApp Web</h1>
                    <p className="text-[var(--color-text-muted)]">Send and receive messages without keeping your phone online.<br />Use WhatsApp on up to 4 linked devices and 1 phone at the same time.</p>
                </div>
            </div>
        );
    }

    const title = active.type === 'dm'
        ? (active.user.display_name || active.user.full_name || active.user.email)
        : active.room.name;
    const subtitle = active.type === 'dm'
        ? (active.user.username ? `@${active.user.username}` : (active.user.presence_status || ''))
        : `${active.room.members?.length ?? ''} members`;

    return (
        <div className="flex h-full flex-col relative bg-[var(--color-bg-chat)]">
            {/* Doodle Background Pattern */}
            <div className="absolute inset-0 z-0 opacity-[0.25] dark:opacity-[0.06] pointer-events-none"
                style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")' }}
            />

            {/* Header */}
            <div className="flex h-[60px] items-center justify-between bg-[var(--color-bg-header)] px-4 py-2 border-b border-[var(--color-border)] z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onMobileMenuOpen} className="md:hidden p-1 mr-[-4px]">
                        <ArrowLeft size={24} className="text-[var(--color-text-secondary)]" />
                    </button>

                    <div className="flex items-center gap-3 cursor-pointer">
                        <div className="h-10 w-10 rounded-full bg-neutral-300 dark:bg-neutral-600 flex items-center justify-center overflow-hidden">
                            {active.type === 'dm' && active.user.avatar_url ? (
                                <img src={active.user.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                                <span className="text-lg text-neutral-600 dark:text-[var(--color-text-primary)]">{title.slice(0, 1).toUpperCase()}</span>
                            )}
                        </div>
                        <div className="flex flex-col justify-center">
                            <div className="font-medium text-[var(--color-text-primary)] leading-tight">{title}</div>
                            {subtitle && <div className="text-xs text-[var(--color-text-muted)] capitalize">{subtitle}</div>}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                    <DisappearingTimerMenu active={active} />
                    <button className="hidden sm:block p-1"><Search size={20} /></button>
                    <button className="p-1"><MoreVertical size={20} /></button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-hidden relative z-10">
                {isLoadingHistory ? (
                    <div className="flex h-full items-center justify-center">
                        <span className="text-sm text-neutral-500">Loading messages...</span>
                    </div>
                ) : (
                    <MessageList
                        messages={messages}
                        currentUserId={currentUserId!}
                        onReact={() => { }}
                        onReply={(msg) => setReplyTo({ id: msg.id, content: msg.content, senderName: 'User' })}
                        isLoadingMore={isLoadingMore}
                        hasMore={hasMore}
                        onLoadMore={onLoadMore}
                    />
                )}
            </div>

            {/* Composer */}
            <div className="z-10 bg-[var(--color-surface-alt)] px-2 py-2">
                <Composer
                    onSend={(text, file, messageType) => onSend(text, file, replyTo?.id || null, messageType)}
                    onTyping={onTyping}
                    isUploading={isUploading}
                    replyTo={replyTo}
                    onCancelReply={() => setReplyTo(null)}
                    draftKey={active.type === 'dm' ? `dm:${active.user.id}` : `room:${active.room.id}`}
                />
            </div>
        </div>
    );
};
