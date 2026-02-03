import React, { useState } from 'react';
import EmojiPicker, { Theme, type EmojiClickData } from 'emoji-picker-react';
import { Smile } from 'lucide-react';
import { Popover } from './ui/Popover';
import { useThemeStore } from '../store/themeStore';

interface EmojiPickerButtonProps {
  onEmojiSelect: (emoji: string) => void;
  className?: string;
}

export const EmojiPickerButton: React.FC<EmojiPickerButtonProps> = ({ onEmojiSelect, className = '' }) => {
  const [open, setOpen] = useState(false);
  const { isDarkMode } = useThemeStore();

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      side="top"
      align="start"
      contentClassName="p-0 border-none shadow-none bg-transparent w-auto"
      trigger={
        <button
          type="button"
          className={`p-2 text-gray-400 hover:text-gray-600 transition-colors ${className}`}
        >
          <Smile size={20} />
        </button>
      }
      content={
        <EmojiPicker
          onEmojiClick={handleEmojiClick}
          width={300}
          height={400}
          theme={isDarkMode ? Theme.DARK : Theme.LIGHT}
        />
      }
    />
  );
};
