import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';
import { useChat } from '../../../context/ChatContext';
import { chatApi } from '../../../services/api';
import type { ChatRoom, Message, UnreadCounts, User, ChatTarget } from '../../../types';
import { extractMentions } from '../../../utils/messageFormatter';

export function useChatManager() {
    const { user } = useAuth();
    const { isConnected, send, subscribe, onlineUsers, typingUsers } = useChat();

    const currentUserId = user?.id ?? null;

    const [users, setUsers] = useState<User[]>([]);
    const [rooms, setRooms] = useState<ChatRoom[]>([]);
    const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({ users: {}, rooms: {} });
    const [active, setActive] = useState<ChatTarget | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [lastPreviews, setLastPreviews] = useState<Record<string, { text: string; timestamp: string }>>({});

    const [isUsersLoading, setIsUsersLoading] = useState(true);
    const [isRoomsLoading, setIsRoomsLoading] = useState(true);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    // Helper references
    const lastRoomReadPingRef = useRef<number>(0);

    const loadUsers = useCallback(async () => {
        setIsUsersLoading(true);
        try {
            const { data } = await chatApi.getUsers();
            if (currentUserId == null) return;
            setUsers(data.filter((u) => u.id !== currentUserId));
        } finally {
            setIsUsersLoading(false);
        }
    }, [currentUserId]);

    const loadRooms = useCallback(async () => {
        setIsRoomsLoading(true);
        try {
            const { data } = await chatApi.getRooms();
            setRooms(data);
        } finally {
            setIsRoomsLoading(false);
        }
    }, []);

    const loadUnread = useCallback(async () => {
        try {
            const { data } = await chatApi.getUnreadCounts();
            setUnreadCounts(data);
        } catch { return; }
    }, []);

    useEffect(() => {
        if (!user) return;
        loadUsers();
        loadRooms();
        loadUnread();
    }, [loadRooms, loadUnread, loadUsers, user]);

    const markRoomRead = useCallback(async (roomId: number, force = false) => {
        const now = Date.now();
        if (!force && now - lastRoomReadPingRef.current < 3000) return;
        lastRoomReadPingRef.current = now;
        try {
            await chatApi.markRoomRead(roomId);
        } catch { return; }
    }, []);

    const activeKey = active?.type === 'dm' ? `dm:${active.user.id}` : active?.type === 'room' ? `room:${active.room.id}` : null;

    useEffect(() => {
        const unsubscribe = subscribe((event) => {
            // 1. Message Received
            if (event.event === 'message.receive') {
                const msg = event.data as Message;
                const previewText =
                    msg.message_type === 'image'
                        ? 'Image'
                        : msg.message_type === 'file'
                            ? 'File'
                            : msg.content.startsWith('/static/')
                                ? 'Attachment'
                                : msg.content;

                const previewKey = msg.room_id
                    ? `room:${msg.room_id}`
                    : `dm:${msg.sender_id === currentUserId ? msg.receiver_id ?? msg.sender_id : msg.sender_id}`;

                setLastPreviews((prev) => ({
                    ...prev,
                    [previewKey]: { text: previewText, timestamp: msg.timestamp },
                }));

                const belongsToActive =
                    active?.type === 'dm'
                        ? !msg.room_id && (msg.sender_id === active.user.id || msg.sender_id === currentUserId)
                        : active?.type === 'room'
                            ? msg.room_id === active.room.id
                            : false;

                if (belongsToActive) {
                    setMessages((prev) => [...prev, msg]);
                    if (currentUserId != null && msg.sender_id !== currentUserId && document.visibilityState === 'visible') {
                        if (msg.room_id) {
                            markRoomRead(msg.room_id);
                        } else {
                            send('message.read', { message_id: msg.id, sender_id: msg.sender_id, room_id: msg.room_id });
                        }
                    }
                    return;
                }

                if (currentUserId != null && msg.sender_id === currentUserId) return;

                if (msg.room_id) {
                    setUnreadCounts((prev) => ({
                        ...prev,
                        rooms: { ...prev.rooms, [msg.room_id!]: (prev.rooms[msg.room_id!] || 0) + 1 },
                    }));
                } else {
                    setUnreadCounts((prev) => ({
                        ...prev,
                        users: { ...prev.users, [msg.sender_id]: (prev.users[msg.sender_id] || 0) + 1 },
                    }));
                }

                if (
                    'Notification' in window &&
                    Notification.permission === 'granted' &&
                    currentUserId != null &&
                    msg.sender_id !== currentUserId
                ) {
                    new Notification('New message', {
                        body: msg.content.startsWith('/static/') ? 'Sent an attachment' : msg.content,
                        icon: '/favicon.svg',
                    });
                }
            }

            // 2. Room Created
            if (event.event === 'room.created') {
                const newRoom = event.data as ChatRoom;
                setRooms((prev) => [newRoom, ...prev]);
                return;
            }

            // 3. User Created
            if (event.event === 'user.created') {
                const newUser = event.data as User;
                if (currentUserId != null && newUser.id !== currentUserId) setUsers((prev) => [...prev, newUser]);
                return;
            }

            // 4. Message Updates (Edit)
            if (event.event === 'message.update') {
                const updatedMsg = event.data as Message;
                setMessages((prev) => prev.map((m) => (m.id === updatedMsg.id ? { ...m, content: updatedMsg.content } : m)));
                return;
            }

            // 5. Message Delete
            if (event.event === 'message.delete') {
                const data = event.data as { id: number };
                setMessages((prev) => prev.filter((m) => m.id !== data.id));
                return;
            }

            // 6. Message Ack, Delivery, Read
            if (event.event === 'message.ack') {
                const data = event.data as { message_id: number };
                setMessages((prev) => prev.map((m) => (m.id === data.message_id ? { ...m, status: 'sent' } : m)));
                return;
            }
            if (event.event === 'message.delivery_receipt') {
                const data = event.data as { message_id: number };
                setMessages((prev) => prev.map((m) => (m.id === data.message_id ? { ...m, status: 'delivered' } : m)));
                return;
            }
            if (event.event === 'message.read_receipt') {
                const data = event.data as { message_id: number };
                setMessages((prev) =>
                    prev.map((m) => (m.id === data.message_id ? { ...m, status: 'read', is_read: true } : m)),
                );
                return;
            }

            // 7. Reactions
            if (event.event === 'message.reaction') {
                const data = event.data as { message_id: number; reactions?: Record<string, string[]> };
                setMessages((prev) => prev.map((m) => (m.id === data.message_id ? { ...m, reactions: data.reactions || {} } : m)));
            }
        });

        return () => unsubscribe();
    }, [activeKey, active, currentUserId, send, subscribe, markRoomRead]);

    const selectTarget = async (target: ChatTarget) => {
        setActive(target);
        setMessages([]);
        setHasMore(true);
        setIsLoadingMore(false);
        setIsHistoryLoading(true);

        if (target.type === 'dm') {
            setUnreadCounts((prev) => {
                const next = { ...prev, users: { ...prev.users } };
                delete next.users[target.user.id];
                return next;
            });
        } else {
            setUnreadCounts((prev) => {
                const next = { ...prev, rooms: { ...prev.rooms } };
                delete next.rooms[target.room.id];
                return next;
            });
            markRoomRead(target.room.id, true);
        }

        try {
            const type = target.type === 'dm' ? 'user' : 'room';
            const id = target.type === 'dm' ? target.user.id : target.room.id;
            const { data } = await chatApi.getHistory(type, id);
            setMessages(data);
            if (data.length < 50) setHasMore(false);
        } finally {
            setIsHistoryLoading(false);
        }
    };

    const loadMoreMessages = async () => {
        if (!active || isLoadingMore || !hasMore) return;
        setIsLoadingMore(true);
        try {
            const type = active.type === 'dm' ? 'user' : 'room';
            const id = active.type === 'dm' ? active.user.id : active.room.id;
            const { data } = await chatApi.getHistory(type, id, messages.length, 50);
            if (data.length === 0) {
                setHasMore(false);
                return;
            }
            setMessages((prev) => [...data, ...prev]);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const sendMessage = async (
        content: string,
        file: File | null,
        replyToId: number | null,
        editingMessageId: number | null,
        overrideMessageType?: Message['message_type']
    ) => {
        if (!active) return;
        if (!content.trim() && !file) return;
        if (!isConnected) return;

        if (editingMessageId != null) {
            await chatApi.updateMessage(editingMessageId, content);
            return;
        }

        let finalContent = content;
        let messageType: Message['message_type'] = overrideMessageType ?? 'text';

        if (file) {
            try {
                const { data } = await chatApi.uploadFile(file);
                finalContent = data.url;
                messageType = data.content_type.startsWith('image/') ? 'image' : 'file';
            } catch {
                toast.error('Upload failed');
                return;
            }
        }

        const mentions = extractMentions(finalContent);

        send('message.send', {
            content: finalContent,
            receiver_id: active.type === 'dm' ? active.user.id : null,
            room_id: active.type === 'room' ? active.room.id : null,
            message_type: messageType,
            reply_to: replyToId,
            mentions: mentions.length > 0 ? mentions : undefined,
        });

        if (active.type === 'dm') send('typing.stop', { receiver_id: active.user.id });
    };

    return {
        users,
        rooms,
        messages,
        active,
        unreadCounts,
        lastPreviews,
        isConnected,
        onlineUsers,
        typingUsers,
        isUsersLoading,
        isRoomsLoading,
        isHistoryLoading,
        isLoadingMore,
        hasMore,
        selectTarget,
        loadMoreMessages,
        sendMessage,
        setMessages,
        markRoomRead,
        currentUserId,
        loadRooms, // exposed for creating rooms
        send // exposed for typing indicators
    };
}
