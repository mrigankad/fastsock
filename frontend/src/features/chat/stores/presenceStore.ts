/**
 * Zustand store for real-time presence and typing state.
 */
import { create } from 'zustand';

interface PresenceStore {
  onlineUsers: Set<number>;
  typingUsers: Record<number, ReturnType<typeof setTimeout>>;  // userId → clearTimeout handle

  setOnline: (userId: number, status: 'online' | 'offline') => void;
  setTyping: (senderId: number, active: boolean) => void;
  isOnline: (userId: number) => boolean;
  isTyping: (userId: number) => boolean;
}

export const usePresenceStore = create<PresenceStore>((set, get) => ({
  onlineUsers: new Set(),
  typingUsers: {},

  setOnline: (userId, status) =>
    set((s) => {
      const next = new Set(s.onlineUsers);
      status === 'online' ? next.add(userId) : next.delete(userId);
      return { onlineUsers: next };
    }),

  setTyping: (senderId, active) =>
    set((s) => {
      const timers = { ...s.typingUsers };
      if (timers[senderId]) clearTimeout(timers[senderId]);
      if (!active) {
        delete timers[senderId];
        return { typingUsers: timers };
      }
      // Auto-clear after 3 seconds if no stop event
      timers[senderId] = setTimeout(
        () => get().setTyping(senderId, false),
        3000
      );
      return { typingUsers: timers };
    }),

  isOnline: (userId) => get().onlineUsers.has(userId),
  isTyping: (userId) => userId in get().typingUsers,
}));
