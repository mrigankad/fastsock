import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { Smile, Loader2 } from 'lucide-react';
import { useThemeStore } from '../store/themeStore';
import { cn } from '../design-system/utils/cn';

// Lazy load emoji picker
const EmojiPicker = lazy(() => import('emoji-picker-react'));

interface EmojiPickerButtonProps {
  onEmojiSelect: (emoji: string) => void;
  className?: string;
}

export const EmojiPickerButton: React.FC<EmojiPickerButtonProps> = ({ onEmojiSelect, className = '' }) => {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const { isDarkMode } = useThemeStore();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleEmojiClick = (emojiData: any) => {
    onEmojiSelect(emojiData.emoji);
    setShowPicker(false);
  };

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        className={cn(
          'grid h-9 w-9 place-items-center rounded-full text-neutral-600 transition-colors',
          'hover:bg-neutral-100 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2',
          className,
        )}
        aria-label="Insert emoji"
      >
        <Smile size={18} />
      </button>

      {showPicker && (
        <div className="absolute bottom-full left-0 z-50 mb-2 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-0 dark:bg-neutral-800 shadow-lg min-w-[300px] min-h-[400px]">
          <Suspense fallback={
            <div className="flex h-[400px] w-[300px] items-center justify-center bg-neutral-0 dark:bg-neutral-800">
              <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
            </div>
          }>
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              width={300}
              height={400}
              theme={(isDarkMode ? 'dark' : 'light') as any}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
};

