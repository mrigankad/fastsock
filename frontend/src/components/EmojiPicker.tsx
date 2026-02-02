import React, { useState, useRef, useEffect } from 'react';
import EmojiPicker, { Theme, type EmojiClickData } from 'emoji-picker-react';
import { Smile } from 'lucide-react';

interface EmojiPickerButtonProps {
  onEmojiSelect: (emoji: string) => void;
  className?: string;
}

export const EmojiPickerButton: React.FC<EmojiPickerButtonProps> = ({ onEmojiSelect, className = '' }) => {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
    setShowPicker(false);
  };

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        className={`p-2 text-gray-400 hover:text-gray-600 transition-colors ${className}`}
      >
        <Smile size={20} />
      </button>
      
      {showPicker && (
        <div className="absolute bottom-full left-0 mb-2 z-50">
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            width={300}
            height={400}
            theme={Theme.LIGHT}
          />
        </div>
      )}
    </div>
  );
};
