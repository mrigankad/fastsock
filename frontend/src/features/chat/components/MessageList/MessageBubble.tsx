import React from 'react';
import { cn } from '../../../../design-system/utils/cn';
import type { Message, LinkPreview } from '../../../../types';
import { format } from 'date-fns';
import { Check, CheckCheck, ExternalLink } from 'lucide-react';
import { AudioMessage } from './AudioMessage';

interface MessageBubbleProps {
    message: Message;
    isMe: boolean;
    onReact?: (emoji: string) => void;
    onReply?: () => void;
    onDelete?: () => void;
    previousMessage?: Message;
}

const renderStatus = (status: Message['status']) => {
    const iconSize = 15;
    if (!status || (status as string) === 'sending') return <Check size={iconSize} className="text-neutral-500 opacity-50" />;
    if (status === 'sent') return <Check size={iconSize} className="text-neutral-500" />;
    if (status === 'delivered') return <CheckCheck size={iconSize} className="text-neutral-500" />;
    if (status === 'read') return <CheckCheck size={iconSize} className="text-[var(--color-receipt-read)]" />;
    return null;
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
    message,
    isMe,
}) => {
    // Outgoing: Light Green (#d9fdd3), Incoming: White

    return (
        <div className={cn("flex w-full mb-[2px] px-4 md:px-8 lg:px-12", isMe ? "justify-end" : "justify-start")}>
            <div
                className={cn(
                    "relative max-w-[85%] sm:max-w-[75%] md:max-w-[65%] rounded-lg shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] text-[14.2px] break-words flex flex-col",
                    isMe
                        ? "bg-[var(--color-bubble-out)] text-[var(--color-text-primary)] dark:text-[#e9edef] rounded-tr-none"
                        : "bg-[var(--color-bubble-in)] text-[var(--color-text-primary)] dark:text-[#e9edef] rounded-tl-none"
                )}
            >
                {/* Link Preview Card */}
                {message.link_preview && <LinkPreviewCard preview={message.link_preview} />}

                {/* Content Wrapper */}
                <div className="pl-2.5 pr-3 pt-1.5 pb-1 flex flex-wrap items-end gap-x-2">
                    <div className="flex-1 pb-1 min-w-[60px]">
                        {message.message_type === 'audio'
                            ? <AudioMessage src={message.content} />
                            : message.content}
                    </div>

                    {/* Metadata (Timestamp & Status) */}
                    <div className={cn(
                        "flex items-center gap-1 text-[11px] h-[15px] select-none ml-auto pb-0.5",
                        isMe ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-muted)]"
                    )}>
                        <span>{format(new Date(message.timestamp), 'h:mm a')}</span>
                        {isMe && renderStatus(message.status)}
                    </div>
                </div>
            </div>
        </div>
    );
};

const LinkPreviewCard: React.FC<{ preview: LinkPreview }> = ({ preview }) => (
    <a
        href={preview.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mx-0.5 mt-1 flex flex-col overflow-hidden rounded-md border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-inherit no-underline hover:bg-black/10 transition-colors"
    >
        {preview.image_url && (
            <img
                src={preview.image_url}
                alt=""
                className="w-full max-h-40 object-cover"
                onError={(e) => (e.currentTarget.style.display = 'none')}
            />
        )}
        <div className="px-3 py-2 space-y-0.5">
            {preview.site_name && (
                <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-accent)] opacity-80">{preview.site_name}</p>
            )}
            {preview.title && (
                <p className="text-[13px] font-semibold leading-snug line-clamp-2">{preview.title}</p>
            )}
            {preview.description && (
                <p className="text-[11px] text-[var(--color-text-muted)] line-clamp-2">{preview.description}</p>
            )}
            <p className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] truncate">
                <ExternalLink size={10} />
                {preview.url.replace(/^https?:\/\//, '').slice(0, 60)}
            </p>
        </div>
    </a>
);
