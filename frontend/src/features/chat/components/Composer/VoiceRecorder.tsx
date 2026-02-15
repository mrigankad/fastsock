import React, { useEffect, useRef } from 'react';
import { Mic, Send, Trash2, Square } from 'lucide-react';
import type { RecorderState } from '../../hooks/useVoiceRecorder';

interface VoiceRecorderProps {
  state: RecorderState;
  durationMs: number;
  onStart: () => void;
  onStop: () => void;
  onSend: () => void;
  onCancel: () => void;
  isSending: boolean;
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export const VoiceRecorderBar: React.FC<VoiceRecorderProps> = ({
  state,
  durationMs,
  onStart,
  onStop,
  onSend,
  onCancel,
  isSending,
}) => {
  const dotRef = useRef<HTMLSpanElement>(null);

  // Pulse animation while recording
  useEffect(() => {
    if (!dotRef.current) return;
    dotRef.current.style.opacity = state === 'recording' ? '1' : '0.4';
  }, [state]);

  if (state === 'idle') {
    return (
      <button
        onClick={onStart}
        className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-full text-[var(--color-text-secondary)] transition-colors"
        title="Record voice message"
      >
        <Mic size={22} />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-1 px-2">
      {/* Cancel */}
      <button
        onClick={onCancel}
        className="p-1.5 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        title="Cancel recording"
      >
        <Trash2 size={18} />
      </button>

      {/* Indicator + timer */}
      <div className="flex items-center gap-2 flex-1">
        <span
          ref={dotRef}
          className={`w-2.5 h-2.5 rounded-full bg-red-500 transition-opacity ${state === 'recording' ? 'animate-pulse' : ''}`}
        />
        <span className="text-[13px] font-mono text-[var(--color-text-primary)] tabular-nums min-w-[36px]">
          {formatDuration(durationMs)}
        </span>
        {state === 'recording' && (
          <span className="text-[11px] text-[var(--color-text-muted)]">Recording…</span>
        )}
        {state === 'stopped' && (
          <span className="text-[11px] text-[var(--color-text-muted)]">Ready to send</span>
        )}
      </div>

      {/* Stop (while recording) */}
      {state === 'recording' && (
        <button
          onClick={onStop}
          className="p-1.5 rounded-full bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
          title="Stop recording"
        >
          <Square size={16} fill="white" />
        </button>
      )}

      {/* Send (after stopped) */}
      {state === 'stopped' && (
        <button
          onClick={onSend}
          disabled={isSending}
          className="p-1.5 rounded-full bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          title="Send voice message"
        >
          <Send size={18} />
        </button>
      )}
    </div>
  );
};
