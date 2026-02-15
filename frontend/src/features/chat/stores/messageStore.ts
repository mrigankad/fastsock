/**
 * Zustand store for real-time WebSocket message state.
 * Server-fetched history lives in TanStack Query (useMessages hook).
 * This store holds incoming WS messages, reactions, and deletions.
 */
import { create } from 'zustand';
import type { Message } from '../../../types';

interface MessageStore {
  // Map: conversationKey → incoming messages from WS (appended to history)
  incoming: Record<string, Message[]>;

  addMessage: (msg: Message) => void;
  updateMessage: (updated: Partial<Message> & { id: number }) => void;
  removeMessage: (id: number) => void;
  updateReactions: (messageId: number, reactions: Record<string, string[]>) => void;
  clearConversation: (key: string) => void;
}

function convKey(msg: Message): string {
  if (msg.room_id) return `room:${msg.room_id}`;
  const ids = [msg.sender_id, msg.receiver_id].filter(Boolean).sort((a, b) => a! - b!);
  return `dm:${ids.join(':')}`;
}

export const useMessageStore = create<MessageStore>((set) => ({
  incoming: {},

  addMessage: (msg) =>
    set((s) => {
      const key = convKey(msg);
      const existing = s.incoming[key] ?? [];
      // Deduplicate by id
      if (existing.some((m) => m.id === msg.id)) return s;
      return { incoming: { ...s.incoming, [key]: [...existing, msg] } };
    }),

  updateMessage: (updated) =>
    set((s) => {
      const next: Record<string, Message[]> = {};
      for (const [key, msgs] of Object.entries(s.incoming)) {
        next[key] = msgs.map((m) => (m.id === updated.id ? { ...m, ...updated } : m));
      }
      return { incoming: next };
    }),

  removeMessage: (id) =>
    set((s) => {
      const next: Record<string, Message[]> = {};
      for (const [key, msgs] of Object.entries(s.incoming)) {
        next[key] = msgs.filter((m) => m.id !== id);
      }
      return { incoming: next };
    }),

  updateReactions: (messageId, reactions) =>
    set((s) => {
      const next: Record<string, Message[]> = {};
      for (const [key, msgs] of Object.entries(s.incoming)) {
        next[key] = msgs.map((m) => (m.id === messageId ? { ...m, reactions } : m));
      }
      return { incoming: next };
    }),

  clearConversation: (key) =>
    set((s) => {
      const next = { ...s.incoming };
      delete next[key];
      return { incoming: next };
    }),
}));
