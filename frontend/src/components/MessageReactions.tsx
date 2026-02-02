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
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
              hasUserReacted(emoji)
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
            }`}
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
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
              hasUserReacted(emoji)
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
            }`}
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
          className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <Plus size={14} />
        </button>

        {showPicker && (
          <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-10">
            <div className="grid grid-cols-6 gap-1">
              {['❤️', '👍', '😂', '😮', '😢', '🎉', '🔥', '👏', '🤔', '👀', '🙏', '💯'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className="p-2 hover:bg-gray-100 rounded text-lg"
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
