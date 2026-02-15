import { useRef, useState, useCallback } from 'react';

export type RecorderState = 'idle' | 'recording' | 'stopped';

export interface VoiceRecorderResult {
  state: RecorderState;
  durationMs: number;
  audioBlob: Blob | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  reset: () => void;
}

export function useVoiceRecorder(): VoiceRecorderResult {
  const [state, setState] = useState<RecorderState>('idle');
  const [durationMs, setDurationMs] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startRecording = useCallback(async () => {
    if (state !== 'idle') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Prefer webm/opus, fallback to whatever browser supports
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeType || 'audio/webm',
        });
        setAudioBlob(blob);
        setState('stopped');
        stopStream();
      };

      recorder.start(100); // collect in 100ms chunks
      startTimeRef.current = Date.now();
      setState('recording');
      setDurationMs(0);

      timerRef.current = setInterval(() => {
        setDurationMs(Date.now() - startTimeRef.current);
      }, 100);
    } catch {
      // User denied mic permission or browser doesn't support it
      setState('idle');
    }
  }, [state]);

  const stopRecording = useCallback(() => {
    if (state !== 'recording') return;
    clearTimer();
    mediaRecorderRef.current?.stop();
    // setState('stopped') is called in recorder.onstop
  }, [state]);

  const cancelRecording = useCallback(() => {
    clearTimer();
    if (mediaRecorderRef.current && state === 'recording') {
      // Remove onstop handler so no blob is created
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    stopStream();
    chunksRef.current = [];
    setAudioBlob(null);
    setDurationMs(0);
    setState('idle');
  }, [state]);

  const reset = useCallback(() => {
    cancelRecording();
  }, [cancelRecording]);

  return { state, durationMs, audioBlob, startRecording, stopRecording, cancelRecording, reset };
}
