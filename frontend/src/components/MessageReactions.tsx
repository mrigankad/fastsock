import React, { useState } from 'react';
import { Smile } from 'lucide-react';
import { Popover } from './ui/Popover';
import { cn } from '../utils/cn';

interface MessageReactionsProps {
  messageId: number;
  reactions: Record<string, string[]>; // emoji -> userIds
  currentUserId: number;
  onReaction: (messageId: number, emoji: string) => void;
}

const PICKER_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🎉', '🔥', '👏', '🤔', '👀', '🙏', '💯'];

export const MessageReactions: React.FC<MessageReactionsProps> = ({
  messageId,
  reactions,
  currentUserId,
  onReaction,
}) => {
  const [showPicker, setShowPicker] = useState(false);

  const handleReaction = (emoji: string) => {
    onReaction(messageId, emoji);
    setShowPicker(false);
  };

  const hasUserReacted = (emoji: string) => {
    const userIds = reactions[emoji] || [];
    return userIds.some(id => id.toString() === currentUserId.toString());
  };

  // Get all unique emojis that have at least one reaction
  const activeEmojis = Object.keys(reactions).filter(emoji => reactions[emoji] && reactions[emoji].length > 0);

  return (
    <div className="flex items-center gap-1 mt-1 flex-wrap min-h-[24px]">
      {/* Display active reactions */}
      {activeEmojis.map((emoji) => {
        const count = reactions[emoji].length;
        const isMe = hasUserReacted(emoji);

        return (
          <button
            key={emoji}
            onClick={() => handleReaction(emoji)}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors border",
              isMe
                ? "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
                : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700 dark:hover:bg-neutral-700"
            )}
          >
            <span>{emoji}</span>
            <span className="font-medium">{count}</span>
          </button>
        );
      })}

      {/* Add reaction button (visible on hover) */}
      <Popover
        open={showPicker}
        onOpenChange={setShowPicker}
        side="top"
        align="start"
        contentClassName="p-2 w-auto"
        trigger={
            <button
              className={cn(
                "p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-neutral-500 dark:hover:text-neutral-300 dark:hover:bg-neutral-800 transition-all",
                "opacity-0 group-hover:opacity-100 focus:opacity-100", // Hide by default, show on group hover
                showPicker && "opacity-100 bg-gray-100 dark:bg-neutral-800" // Keep visible if picker is open
              )}
            >
              <Smile size={14} />
            </button>
        }
        content={
            <div className="grid grid-cols-6 gap-1">
              {PICKER_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded text-lg transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
        }
      />
    </div>
  );
};
