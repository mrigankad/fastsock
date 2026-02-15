import React, { useState } from 'react';
import { Plus } from 'lucide-react';

interface MessageReactionsProps {
  messageId: number;
  reactions: Record<string, string[]>; // emoji -> userIds
  currentUserId: number;
  onReaction: (messageId: number, emoji: string) => void;
}

const REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🎉'];

export const MessageReactions: React.FC<MessageReactionsProps> = ({
  messageId,
  reactions,
  currentUserId,
  onReaction,
}) => {
  const [showPicker, setShowPicker] = useState(false);

  const pillBase =
    'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold transition-colors' +
    ' hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2';

  const handleReaction = (emoji: string) => {
    onReaction(messageId, emoji);
    setShowPicker(false);
  };

  const getReactionCount = (emoji: string) => {
    return reactions[emoji]?.length || 0;
  };

  const hasUserReacted = (emoji: string) => {
    return reactions[emoji]?.includes(currentUserId.toString()) || false;
  };

  return (
    <div className="flex items-center gap-1 mt-1 flex-wrap">
      {/* Display existing reactions */}
      {Object.entries(reactions).map(([emoji, userIds]) => {
        const count = userIds.length;
        if (count === 0) return null;
        
        return (
          <button
            key={emoji}
            onClick={() => handleReaction(emoji)}
            className={`${pillBase} ${
              hasUserReacted(emoji)
                ? 'border-brand-primary bg-neutral-0 text-neutral-900'
                : 'border-neutral-200 bg-neutral-0 text-neutral-700'
            }`}
            aria-label={`React with ${emoji}`}
          >
            <span>{emoji}</span>
            <span className="font-medium">{count}</span>
          </button>
        );
      })}

      {/* Quick reaction buttons */}
      {REACTION_EMOJIS.map((emoji) => {
        const count = getReactionCount(emoji);
        return (
          <button
            key={emoji}
            onClick={() => handleReaction(emoji)}
            className={`${pillBase} ${
              hasUserReacted(emoji)
                ? 'border-brand-primary bg-neutral-0 text-neutral-900'
                : 'border-neutral-200 bg-neutral-0 text-neutral-700'
            }`}
            aria-label={`React with ${emoji}`}
          >
            <span>{emoji}</span>
            {count > 0 && <span className="font-medium">{count}</span>}
          </button>
        );
      })}

      {/* More reactions picker */}
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="grid h-7 w-7 place-items-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          aria-label="More reactions"
        >
          <Plus size={14} />
        </button>

        {showPicker && (
          <div className="absolute bottom-full left-0 z-10 mb-2 rounded-xl border border-neutral-200 bg-neutral-0 p-2 shadow-lg">
            <div className="grid grid-cols-6 gap-1">
              {['❤️', '👍', '😂', '😮', '😢', '🎉', '🔥', '👏', '🤔', '👀', '🙏', '💯'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className="grid h-9 w-9 place-items-center rounded-lg text-lg hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
                  aria-label={`React with ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
