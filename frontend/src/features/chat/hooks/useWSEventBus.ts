/**
 * WSEventBus — single hook that routes all incoming WebSocket events
 * to their respective Zustand stores and TanStack Query cache.
 *
 * Mount this once at the app root (inside ChatContext provider).
 * useChatManager no longer needs its own subscription.
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useChat } from '../../../context/ChatContext';
import { useMessageStore } from '../stores/messageStore';
import { usePresenceStore } from '../stores/presenceStore';
import type { Message } from '../../../types';

export function useWSEventBus() {
  const { subscribe } = useChat();
  const queryClient = useQueryClient();
  const addMessage = useMessageStore((s) => s.addMessage);
  const updateMessage = useMessageStore((s) => s.updateMessage);
  const removeMessage = useMessageStore((s) => s.removeMessage);
  const updateReactions = useMessageStore((s) => s.updateReactions);
  const setOnline = usePresenceStore((s) => s.setOnline);
  const setTyping = usePresenceStore((s) => s.setTyping);

  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      switch (event.event) {
        case 'message.receive': {
          addMessage(event.data as Message);
          break;
        }
        case 'message.update': {
          const d = event.data as Partial<Message> & { id: number };
          updateMessage(d);
          break;
        }
        case 'message.delete': {
          const d = event.data as { id: number };
          removeMessage(d.id);
          break;
        }
        case 'message.ack': {
          const d = event.data as { message_id: number };
          updateMessage({ id: d.message_id, status: 'sent' });
          break;
        }
        case 'message.delivery_receipt': {
          const d = event.data as { message_id: number };
          updateMessage({ id: d.message_id, status: 'delivered' });
          break;
        }
        case 'message.read_receipt': {
          const d = event.data as { message_id: number };
          updateMessage({ id: d.message_id, status: 'read', is_read: true });
          break;
        }
        case 'message.reaction': {
          const d = event.data as { message_id: number; reactions: Record<string, string[]> };
          updateReactions(d.message_id, d.reactions || {});
          break;
        }
        case 'presence.update': {
          const d = event.data as { user_id: number; status: 'online' | 'offline' };
          setOnline(d.user_id, d.status);
          // Invalidate user cache so sidebar re-renders with new status
          queryClient.invalidateQueries({ queryKey: ['users'] });
          break;
        }
        case 'typing.start': {
          const d = event.data as { sender_id: number };
          setTyping(d.sender_id, true);
          break;
        }
        case 'typing.stop': {
          const d = event.data as { sender_id: number };
          setTyping(d.sender_id, false);
          break;
        }
        case 'room.created': {
          // Invalidate rooms list so sidebar refreshes
          queryClient.invalidateQueries({ queryKey: ['rooms'] });
          break;
        }
        case 'user.created': {
          queryClient.invalidateQueries({ queryKey: ['users'] });
          break;
        }
        case 'room.updated': {
          queryClient.invalidateQueries({ queryKey: ['rooms'] });
          break;
        }
        case 'notification.new': {
          queryClient.invalidateQueries({ queryKey: ['notif-count'] });
          break;
        }
        case 'message.link_preview': {
          // Attach preview data to the cached message
          const d = event.data as {
            message_id: number; url: string; title?: string;
            description?: string; image_url?: string; site_name?: string;
          };
          updateMessage({ id: d.message_id, link_preview: d });
          break;
        }
      }
    });
    return unsubscribe;
  }, [subscribe, addMessage, updateMessage, removeMessage, updateReactions, setOnline, setTyping, queryClient]);
}
