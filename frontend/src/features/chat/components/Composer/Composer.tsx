import React, { useRef, useState, useEffect } from 'react';
import { Send, Plus, X, Loader2 } from 'lucide-react';
import { EmojiPickerButton } from '../../../../components/EmojiPicker';
import type { ReplyTo } from '../../../../types';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { VoiceRecorderBar } from './VoiceRecorder';
import { chatApi } from '../../../../services/api';

interface ComposerProps {
    onSend: (text: string, file: File | null, messageType?: 'text' | 'image' | 'audio') => Promise<void>;
    onTyping: (text: string) => void;
    isUploading: boolean;
    replyTo: ReplyTo | null;
    onCancelReply: () => void;
    disabled?: boolean;
    draftKey?: string;  // e.g. "dm:3" or "room:7" — used for localStorage draft
}

const DRAFT_PREFIX = 'fastsock_draft_';

function loadDraft(key?: string): string {
    if (!key) return '';
    try { return localStorage.getItem(DRAFT_PREFIX + key) ?? ''; } catch { return ''; }
}
function saveDraft(key: string | undefined, value: string) {
    if (!key) return;
    try {
        if (value) localStorage.setItem(DRAFT_PREFIX + key, value);
        else localStorage.removeItem(DRAFT_PREFIX + key);
    } catch { /* storage full */ }
}

export const Composer: React.FC<ComposerProps> = ({
    onSend,
    onTyping,
    isUploading,
    replyTo,
    onCancelReply,
    disabled,
    draftKey,
}) => {
    const [text, setText] = useState(() => loadDraft(draftKey));
    const [file, setFile] = useState<File | null>(null);
    const [isSendingAudio, setIsSendingAudio] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const prevDraftKey = useRef(draftKey);
    const voice = useVoiceRecorder();

    // When conversation changes: save old draft, load new draft
    useEffect(() => {
        if (prevDraftKey.current !== draftKey) {
            saveDraft(prevDraftKey.current, text);
            const loaded = loadDraft(draftKey);
            setText(loaded);
            prevDraftKey.current = draftKey;
        }
    }, [draftKey]);  // eslint-disable-line react-hooks/exhaustive-deps

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setText(val);
        saveDraft(draftKey, val);
        onTyping(val);
    };

    const handleSend = async () => {
        if ((!text.trim() && !file) || disabled || isUploading) return;
        await onSend(text, file);
        setText('');
        setFile(null);
        saveDraft(draftKey, '');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSend();
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) setFile(f);
    };

    const handleSendVoice = async () => {
        if (!voice.audioBlob || isSendingAudio) return;
        setIsSendingAudio(true);
        try {
            const ext = voice.audioBlob.type.includes('ogg') ? '.ogg' : '.webm';
            const res = await chatApi.uploadAudio(voice.audioBlob, `voice${ext}`);
            await onSend(res.data.url, null, 'audio');
            voice.reset();
        } catch {
            // Upload failed — stay in stopped state so user can retry
        } finally {
            setIsSendingAudio(false);
        }
    };

    const isVoiceActive = voice.state !== 'idle';

    return (
        <div className="flex flex-col bg-transparent">
            {replyTo && !isVoiceActive && (
                <div className="mx-2 mb-2 flex items-center justify-between rounded-lg bg-[var(--color-surface)] p-2 text-sm border-l-4 border-[var(--color-accent)] shadow-sm">
                    <div className="flex flex-col">
                        <span className="font-semibold text-[var(--color-accent)] text-xs leading-none mb-1">{replyTo.senderName}</span>
                        <span className="truncate text-[var(--color-text-secondary)] max-w-[400px]">{replyTo.content}</span>
                    </div>
                    <button onClick={onCancelReply} className="rounded-full p-1 hover:bg-black/5">
                        <X size={16} className="text-[var(--color-text-secondary)]" />
                    </button>
                </div>
            )}

            <div className="flex items-center gap-1.5 px-1.5">
                {isVoiceActive ? (
                    /* Voice recorder takes over the entire bar */
                    <VoiceRecorderBar
                        state={voice.state}
                        durationMs={voice.durationMs}
                        onStart={voice.startRecording}
                        onStop={voice.stopRecording}
                        onSend={handleSendVoice}
                        onCancel={voice.cancelRecording}
                        isSending={isSendingAudio}
                    />
                ) : (
                    <>
                        <div className="flex items-center gap-1 text-[var(--color-text-secondary)]">
                            <EmojiPickerButton onEmojiSelect={(emoji) => setText(prev => prev + emoji)} />
                            <button
                                className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
                                title="Attach"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Plus size={22} />
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                        </div>

                        <div className="flex-1 px-1">
                            <input
                                value={text}
                                onChange={handleTextChange}
                                onKeyDown={handleKeyDown}
                                placeholder="Type a message"
                                className="w-full rounded-lg bg-[var(--color-surface)] px-3 py-1.5 text-[14.2px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none shadow-sm"
                                disabled={disabled}
                            />
                        </div>

                        <div className="flex items-center text-[var(--color-text-secondary)]">
                            {text.trim() || file ? (
                                <button onClick={handleSend} disabled={isUploading} className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-full text-[var(--color-accent)]">
                                    {isUploading ? <Loader2 className="animate-spin" size={22} /> : <Send size={22} />}
                                </button>
                            ) : (
                                <VoiceRecorderBar
                                    state={voice.state}
                                    durationMs={voice.durationMs}
                                    onStart={voice.startRecording}
                                    onStop={voice.stopRecording}
                                    onSend={handleSendVoice}
                                    onCancel={voice.cancelRecording}
                                    isSending={isSendingAudio}
                                />
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
