import React, { useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';

interface AudioMessageProps {
  src: string;
}

function formatTime(sec: number): string {
  if (!isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const AudioMessage: React.FC<AudioMessageProps> = ({ src }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    setCurrentTime(audioRef.current?.currentTime ?? 0);
  };

  const handleLoadedMetadata = () => {
    setDuration(audioRef.current?.duration ?? 0);
  };

  const handleEnded = () => {
    setPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="flex items-center gap-2 px-2 py-1 min-w-[200px]">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={handleEnded}
        preload="metadata"
      />

      {/* Play/Pause button */}
      <button
        onClick={toggle}
        className="w-9 h-9 flex-shrink-0 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center hover:opacity-90 transition-opacity"
      >
        {playing ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" />}
      </button>

      {/* Waveform / progress */}
      <div className="flex flex-col flex-1 gap-1">
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.01}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1 accent-[var(--color-accent)] cursor-pointer"
          style={{
            background: `linear-gradient(to right, var(--color-accent) ${progress * 100}%, var(--color-text-muted) ${progress * 100}%)`,
          }}
        />
        <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] select-none">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};
