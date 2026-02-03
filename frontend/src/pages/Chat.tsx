import React, { useCallback, useEffect, useState, useRef, type ChangeEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useCall } from '../context/CallContext';
import { useThemeStore } from '../store/themeStore';
import { useUiStore } from '../store/ui.store';
import { chatApi } from '../services/api';
import { LogOut, Users, MessageSquare, Plus, Paperclip, Send, X, Edit2, Trash2, Search, Moon, Sun, Video, Reply, ChevronDown, Menu } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import type { User, ChatRoom, Message, UnreadCounts } from '../types';
import { Skeleton } from '../components/ui';
import { EmojiPickerButton } from '../components/EmojiPicker';
import { MessageReactions } from '../components/MessageReactions';
import { CallOverlay } from '../components/CallOverlay';
import { formatMessage } from '../utils/messageFormatter';
import { Button, Input, Modal, Tabs, TabsList, TabsTrigger, Avatar, ScrollArea, Tooltip, ContextMenuRoot, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, Checkbox } from '../components/ui';
import toast from 'react-hot-toast';
import { cn } from '../utils/cn';

interface ChatInfo {
  type: 'user' | 'room';
  id: number;
  name: string;
}

interface ReplyToMessage {
  id: number;
  content: string;
  sender_name: string;
}

const Chat: React.FC = () => {
  const { user, logout } = useAuth();
  const { isConnected, send, subscribe, onlineUsers, typingUsers } = useChat();
  const { startCall, status: callStatus } = useCall();
  const { isDarkMode, toggleDarkMode } = useThemeStore();
  const { isCreateRoomModalOpen, setCreateRoomModalOpen } = useUiStore();
  const currentUserId = user?.id;
  
  const [userSearch, setUserSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'rooms'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [currentChat, setCurrentChat] = useState<ChatInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({ users: {}, rooms: {} });
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: number, content: string } | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  const [isUsersLoading, setIsUsersLoading] = useState(true);
  const [isRoomsLoading, setIsRoomsLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [messageSearch, setMessageSearch] = useState('');
  const [replyToMessage, setReplyToMessage] = useState<ReplyToMessage | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [localTypingUsers, setLocalTypingUsers] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typingTimeoutRef = useRef<any>(null);

  const loadUsers = useCallback(async () => {
    setIsUsersLoading(true);
    try {
        const { data } = await chatApi.getUsers();
        if (currentUserId != null) {
            setUsers(data.filter(u => u.id !== currentUserId));
        }
    } finally {
        setIsUsersLoading(false);
    }
  }, [currentUserId]);

  const loadRooms = useCallback(async () => {
    setIsRoomsLoading(true);
    try {
        const { data } = await chatApi.getRooms();
        setRooms(data);
    } catch (e) { console.error(e); }
    finally { setIsRoomsLoading(false); }
  }, []);

  const loadUnread = useCallback(async () => {
    try {
        const { data } = await chatApi.getUnreadCounts();
        setUnreadCounts(data);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (user) {
        loadUsers();
        loadRooms();
        loadUnread();
    }
  }, [user, loadRooms, loadUnread, loadUsers]);

  // Subscribe to WS events
  useEffect(() => {
    const unsubscribe = subscribe((event) => {
        if (event.event === 'message.receive') {
            const msg = event.data as Message;
            // If message belongs to current chat
            if (
                (currentChat?.type === 'user' && !msg.room_id && (msg.sender_id === currentChat.id || msg.sender_id === currentUserId)) ||
                (currentChat?.type === 'room' && msg.room_id === currentChat.id)
            ) {
                setMessages(prev => [...prev, msg]);
                
                // If we are looking at this chat and message is from others, mark as read
                if (currentChat && currentUserId != null && msg.sender_id !== currentUserId) {
                    if (document.visibilityState === 'visible') {
                        send('message.read', { message_id: msg.id, sender_id: msg.sender_id, room_id: msg.room_id });
                    }
                }
            } else {
                // Update unread counts
                if (msg.room_id) {
                    // Room unread
                    setUnreadCounts(prev => ({
                        ...prev,
                        rooms: {
                            ...prev.rooms,
                            [msg.room_id!]: (prev.rooms[msg.room_id!] || 0) + 1
                        }
                    }));
                } else {
                    setUnreadCounts(prev => ({
                        ...prev,
                        users: {
                            ...prev.users,
                            [msg.sender_id]: (prev.users[msg.sender_id] || 0) + 1
                        }
                    }));
                }
                
                // Notification
                if (Notification.permission === 'granted' && currentUserId != null && msg.sender_id !== currentUserId) {
                    new Notification('New Message', {
                        body: msg.content.startsWith('/static/') ? 'Sent a file' : msg.content,
                        icon: '/favicon.svg' // Placeholder
                    });
                }
            }
        } else if (event.event === 'typing.start') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = event.data as any;
            if (currentChat) {
                const isForCurrentRoom = currentChat.type === 'room' && data.room_id === currentChat.id;
                const isForCurrentUser = currentChat.type === 'user' && !data.room_id && data.sender_id === currentChat.id;
                
                if (isForCurrentRoom || isForCurrentUser) {
                     setLocalTypingUsers(prev => {
                         const next = new Set(prev);
                         next.add(data.sender_id.toString());
                         return next;
                     });
                }
            }
        } else if (event.event === 'typing.stop') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = event.data as any;
            if (currentChat) {
                const isForCurrentRoom = currentChat.type === 'room' && data.room_id === currentChat.id;
                const isForCurrentUser = currentChat.type === 'user' && !data.room_id && data.sender_id === currentChat.id;

                if (isForCurrentRoom || isForCurrentUser) {
                     setLocalTypingUsers(prev => {
                         const next = new Set(prev);
                         next.delete(data.sender_id.toString());
                         return next;
                     });
                }
            }
        } else if (event.event === 'room.created') {
            const newRoom = event.data as ChatRoom;
            setRooms(prev => [newRoom, ...prev]);
        } else if (event.event === 'user.created') {
            const newUser = event.data as User;
            if (currentUserId != null && newUser.id !== currentUserId) {
                setUsers(prev => [...prev, newUser]);
            }
        } else if (event.event === 'message.update') {
            const updatedMsg = event.data as Message;
            setMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, content: updatedMsg.content } : m));
        } else if (event.event === 'message.delete') {
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = event.data as any;
            setMessages(prev => prev.filter(m => m.id !== data.id));
        } else if (event.event === 'message.ack') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = event.data as any;
            setMessages(prev => prev.map(m => m.id === data.message_id ? { ...m, status: 'sent' } : m));
        } else if (event.event === 'message.delivery_receipt') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = event.data as any;
            setMessages(prev => prev.map(m => m.id === data.message_id ? { ...m, status: 'delivered' } : m));
        } else if (event.event === 'message.read_receipt') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = event.data as any;
            setMessages(prev => prev.map(m => m.id === data.message_id ? { ...m, status: 'read', is_read: true } : m));
        } else if (event.event === 'message.reaction') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = event.data as any;
            setMessages(prev => prev.map(m => {
                if (m.id === data.message_id) {
                    return {
                        ...m,
                        reactions: data.reactions || {}
                    };
                }
                return m;
            }));
        }
    });

    return () => unsubscribe();
  }, [currentChat, currentUserId, subscribe, send, user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!isLoadingMore) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoadingMore]);

  const selectChat = async (type: 'user' | 'room', item: User | ChatRoom) => {
    let name = '';
    if (type === 'user') {
        const u = item as User;
        name = u.full_name || u.email;
    } else {
        const r = item as ChatRoom;
        name = r.name;
    }
    const chatInfo: ChatInfo = { type, id: item.id, name: name || 'Unknown' };
    setCurrentChat(chatInfo);
    if (window.matchMedia('(max-width: 767px)').matches) {
      setIsSidebarOpen(false);
    }
    setMessages([]);
    setHasMore(true);
    setIsLoadingMore(false);
    setIsHistoryLoading(true);
    setLocalTypingUsers(new Set());
    
    // Clear unread
    if (type === 'user') {
        setUnreadCounts(prev => {
            const newCounts = { ...prev };
            delete newCounts.users[item.id];
            return newCounts;
        });
        // Notify backend that we read the user messages
        send('message.read', { sender_id: item.id });
    } else {
        setUnreadCounts(prev => {
            const newCounts = { ...prev };
            delete newCounts.rooms[item.id];
            return newCounts;
        });
        // Notify backend that we read the room
        send('message.read', { room_id: item.id });
    }

    // Load History
    try {
        const { data } = await chatApi.getHistory(type, item.id);
        setMessages(data);
        if (data.length < 50) setHasMore(false);
    } catch (e) { console.error(e); }
    finally { setIsHistoryLoading(false); }
  };

  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
    
    if (scrollTop === 0 && hasMore && !isLoadingMore && currentChat) {
      const oldHeight = scrollHeight;
      setIsLoadingMore(true);
      
      try {
        const { data } = await chatApi.getHistory(currentChat.type, currentChat.id, messages.length, 50);
        
        if (data.length > 0) {
            setMessages(prev => [...data, ...prev]);
            
            // Adjust scroll position to maintain view
            setTimeout(() => {
                if (scrollContainerRef.current) {
                    const newHeight = scrollContainerRef.current.scrollHeight;
                    scrollContainerRef.current.scrollTop = newHeight - oldHeight;
                }
            }, 0);
        } else {
            setHasMore(false);
        }
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoadingMore(false);
      }
    }
  };

  const handleSendMessage = async () => {
    if ((!inputText.trim() && !previewFile) || !currentChat) return;

    if (editingMessage) {
        // Handle Edit
        await chatApi.updateMessage(editingMessage.id, inputText);
        setEditingMessage(null);
        setInputText('');
        return;
    }

    let content = inputText;
    let type: 'text' | 'image' = 'text';

    if (previewFile) {
        try {
            const { data } = await chatApi.uploadFile(previewFile);
            content = data.url;
            type = 'image';
            setPreviewFile(null);
        } catch {
            toast.error('Upload failed');
            return;
        }
    }

    const payload = {
        content,
        receiver_id: currentChat.type === 'user' ? currentChat.id : null,
        room_id: currentChat.type === 'room' ? currentChat.id : null,
        message_type: type,
        reply_to: replyToMessage?.id || null
    };

    send('message.send', payload);
    setInputText('');
    setReplyToMessage(null);
    
    // Stop typing
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    send('typing.stop', { receiver_id: currentChat.type === 'user' ? currentChat.id : null });
  };

  const handleTyping = (e: ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    
    if (currentChat?.type === 'user' && !editingMessage) {
        if (!typingTimeoutRef.current) {
            send('typing.start', { receiver_id: currentChat.id });
        }
        
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        
        typingTimeoutRef.current = setTimeout(() => {
            if (currentChat) {
                send('typing.stop', { receiver_id: currentChat.id });
            }
            typingTimeoutRef.current = null;
        }, 2000);
    }
  };

  const handleEditMessage = (msg: Message) => {
    if (msg.message_type === 'text') {
      setEditingMessage({ id: msg.id, content: msg.content });
      setInputText(msg.content);
      document.getElementById('message-input')?.focus();
    }
  };

  const handleDeleteMessage = async (id: number) => {
    if (confirm('Delete this message?')) {
      await chatApi.deleteMessage(id);
    }
  };

  const cancelEdit = () => {
      setEditingMessage(null);
      setInputText('');
  };

  const handleCreateRoom = async () => {
    if (!newRoomName || selectedMembers.length === 0) return;
    await chatApi.createRoom(newRoomName, selectedMembers);
    setNewRoomName('');
    setSelectedMembers([]);
    setCreateRoomModalOpen(false);
    loadRooms();
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
        setPreviewFile(e.target.files[0]);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setInputText(prev => prev + emoji);
  };

  const handleReaction = (messageId: number, emoji: string) => {
    send('message.reaction', { message_id: messageId, emoji });

    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const reactions = msg.reactions || {};
        const userReactions = reactions[emoji] || [];
        const userIdStr = currentUserId?.toString() || '';

        const hasReacted = userReactions.some(id => id.toString() === userIdStr);

        if (hasReacted) {
          return {
            ...msg,
            reactions: {
              ...reactions,
              [emoji]: userReactions.filter(id => id.toString() !== userIdStr)
            }
          };
        }

        return {
          ...msg,
          reactions: {
            ...reactions,
            [emoji]: [...userReactions, userIdStr]
          }
        };
      }
      return msg;
    }));
  };

  const handleReply = (message: Message) => {
    const senderName = users.find(u => u.id === message.sender_id)?.full_name ||
      users.find(u => u.id === message.sender_id)?.email ||
      `User ${message.sender_id}`;

    setReplyToMessage({
      id: message.id,
      content: message.content,
      sender_name: senderName
    });
  };

  const cancelReply = () => {
    setReplyToMessage(null);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();

    if (isToday(date)) return format(date, 'h:mm a');
    if (isYesterday(date)) return `Yesterday ${format(date, 'h:mm a')}`;
    if (date.getFullYear() === now.getFullYear()) return format(date, 'MMM d, h:mm a');
    return format(date, 'MMM d, yyyy, h:mm a');
  };

  const getUserLabel = (userId: number) => {
    const u = users.find((x) => x.id === userId);
    return u?.full_name || u?.email || `User ${userId}`;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (!user) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className={cn("flex h-screen overflow-hidden", isDarkMode ? 'bg-neutral-950' : 'bg-neutral-100')}>
      <CallOverlay />
      
      {/* Sidebar */}
      <div className={cn(
        "md:flex w-full md:w-80 border-r flex-col transition-all duration-300",
        isSidebarOpen ? 'flex' : 'hidden',
        isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200'
      )}>
        {/* Header */}
        <div className={cn("p-4 border-b flex justify-between items-center h-16 shrink-0", 
            isDarkMode ? 'border-neutral-800' : 'border-neutral-200'
        )}>
          <div className="flex items-center space-x-3 overflow-hidden">
            <Avatar
              fallback={user.full_name?.[0] || user.email[0].toUpperCase()}
              className="bg-brand-primary text-white"
            />
            <div className="min-w-0">
                <p className={cn("font-semibold truncate", isDarkMode ? 'text-white' : 'text-neutral-900')}>
                    {user.full_name || user.email}
                </p>
                <div className={cn("flex items-center text-xs", isConnected ? 'text-green-500' : 'text-red-500')}>
                    <div className={cn("w-2 h-2 rounded-full mr-1", isConnected ? 'bg-green-500' : 'bg-red-500')}></div>
                    {isConnected ? 'Online' : 'Offline'}
                </div>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <Tooltip content={isDarkMode ? 'Light Mode' : 'Dark Mode'}>
                <Button 
                  variant="icon" 
                  size="sm"
                  onClick={toggleDarkMode} 
                  className={isDarkMode ? 'text-yellow-400' : 'text-neutral-500'}
                >
                  {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </Button>
            </Tooltip>
            <Tooltip content="Logout">
                <Button variant="icon" size="sm" onClick={logout} className="text-neutral-500 hover:text-red-500">
                  <LogOut size={18} />
                </Button>
            </Tooltip>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'users' | 'rooms')} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="users">Direct Messages</TabsTrigger>
            <TabsTrigger value="rooms">Rooms</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="px-4 py-2">
            <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"/>
                <input
                    type="text"
                    placeholder={activeTab === 'users' ? "Search users..." : "Search rooms..."}
                    className={cn(
                        "w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all",
                        isDarkMode 
                            ? 'bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500' 
                            : 'bg-neutral-100 border-transparent text-neutral-900'
                    )}
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                />
            </div>
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          {activeTab === 'users' ? (
            <div className="p-2 space-y-1">
              {isUsersLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="p-3 flex items-center">
                          <Skeleton className="w-10 h-10 rounded-full" />
                          <div className="ml-3 flex-1 space-y-2">
                              <Skeleton className="h-4 w-3/4" />
                              <Skeleton className="h-3 w-1/2" />
                          </div>
                      </div>
                  ))
              ) : (
                  users
                    .filter(u => {
                        if (!userSearch) return true;
                        const term = userSearch.toLowerCase();
                        return (u.full_name || '').toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
                    })
                    .map(u => (
                <div 
                    key={u.id} 
                    onClick={() => selectChat('user', u)}
                    className={cn(
                        "p-3 flex items-center cursor-pointer rounded-lg transition-all",
                        currentChat?.id === u.id && currentChat?.type === 'user' 
                        ? (isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100')
                        : (isDarkMode ? 'hover:bg-neutral-800/50' : 'hover:bg-neutral-50')
                    )}
                >
                  <div className="relative">
                    <Avatar
                      fallback={u.full_name?.[0] || u.email[0].toUpperCase()}
                      className={cn(isDarkMode ? 'bg-neutral-700 text-neutral-200' : 'bg-neutral-200 text-neutral-600')}
                    />
                    {onlineUsers[u.id] && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-neutral-900 rounded-full"></div>
                    )}
                  </div>
                  <div className="ml-3 flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                        <p className={cn("text-sm font-medium truncate", isDarkMode ? 'text-neutral-200' : 'text-neutral-900')}>
                          {u.full_name || u.email}
                        </p>
                        {unreadCounts.users[u.id] > 0 && (
                            <span className="bg-brand-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                {unreadCounts.users[u.id]}
                            </span>
                        )}
                    </div>
                    {typingUsers[u.id] && (
                        <p className="text-xs text-brand-primary animate-pulse">typing...</p>
                    )}
                  </div>
                </div>
              )))}
            </div>
          ) : (
            <div className="p-2 space-y-2">
                <Button 
                    onClick={() => setCreateRoomModalOpen(true)}
                    className="w-full"
                    variant="secondary"
                >
                    <Plus size={16} /> <span>Create Room</span>
                </Button>
                <div className="space-y-1">
                    {isRoomsLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="p-3 flex items-center">
                                <Skeleton className="w-10 h-10 rounded-full" />
                                <div className="ml-3 flex-1">
                                    <Skeleton className="h-4 w-1/2" />
                                </div>
                            </div>
                        ))
                    ) : (
                        rooms
                        .filter(r => {
                            if (!userSearch) return true;
                            return r.name.toLowerCase().includes(userSearch.toLowerCase());
                        })
                        .map(r => (
                        <div 
                            key={r.id}
                            onClick={() => selectChat('room', r)}
                            className={cn(
                                "p-3 flex items-center cursor-pointer rounded-lg transition-all",
                                currentChat?.id === r.id && currentChat?.type === 'room' 
                                ? (isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100')
                                : (isDarkMode ? 'hover:bg-neutral-800/50' : 'hover:bg-neutral-50')
                            )}
                        >
                            <div className="relative">
                                <Avatar
                                    fallback={<Users size={18} />}
                                    className={cn(isDarkMode ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-100 text-indigo-600')}
                                />
                                {unreadCounts.rooms[r.id] > 0 && (
                                    <div className="absolute -top-1 -right-1 bg-brand-primary text-white text-xs font-bold px-1.5 py-0.5 rounded-full border-2 border-white dark:border-neutral-900 z-10">
                                        {unreadCounts.rooms[r.id]}
                                    </div>
                                )}
                            </div>
                            <p className={cn("ml-3 text-sm font-medium truncate", isDarkMode ? 'text-neutral-200' : 'text-neutral-900')}>
                                {r.name}
                            </p>
                        </div>
                    )))}
                </div>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className={cn(
          "flex-1 flex-col relative transition-all duration-300",
          isSidebarOpen ? 'hidden md:flex' : 'flex',
          isDarkMode ? 'bg-neutral-950' : 'bg-neutral-50/50'
      )}>
        {currentChat ? (
            <>
                {/* Header */}
                <div className={cn(
                    "px-4 h-16 border-b flex justify-between items-center shadow-sm z-10 shrink-0",
                    isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200'
                )}>
                    <div className="flex items-center">
                        <Button
                          variant="icon"
                          className="mr-2 md:hidden"
                          onClick={() => setIsSidebarOpen(true)}
                          aria-label="Open chats"
                        >
                          <Menu size={20} />
                        </Button>
                        <Avatar
                          fallback={currentChat.name[0].toUpperCase()}
                          className={cn(
                            "mr-3",
                            currentChat.type === 'room' 
                              ? 'bg-indigo-500 text-white' 
                              : 'bg-brand-primary text-white'
                          )}
                        />
                        <div>
                            <h3 className={cn("font-bold text-sm", isDarkMode ? 'text-white' : 'text-neutral-900')}>
                                {currentChat.name}
                            </h3>
                            {localTypingUsers.size > 0 ? (
                                <p className="text-xs text-brand-primary font-medium animate-pulse">
                                    {(() => {
                                        const ids = Array.from(localTypingUsers);
                                        const names = ids.map(id => {
                                            const u = users.find(user => user.id.toString() === id);
                                            return u?.full_name?.split(' ')[0] || u?.email?.split('@')[0] || 'User';
                                        });
                                        if (names.length === 1) return `${names[0]} is typing...`;
                                        if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
                                        return `${names.length} people are typing...`;
                                    })()}
                                </p>
                            ) : (
                                <p className={cn("text-xs", isDarkMode ? 'text-neutral-400' : 'text-neutral-500')}>
                                    {currentChat.type === 'room' ? 'Room' : 'Direct Message'}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="relative hidden sm:block">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"/>
                            <input
                                type="text"
                                placeholder="Search messages..."
                                className={cn(
                                    "pl-9 pr-4 py-1.5 border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary w-48 transition-all",
                                    isDarkMode 
                                        ? 'bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500' 
                                        : 'bg-neutral-100 border-transparent text-neutral-900'
                                )}
                                value={messageSearch}
                                onChange={(e) => setMessageSearch(e.target.value)}
                            />
                        </div>
                        {currentChat.type === 'user' && (
                          <Tooltip content="Start Video Call">
                              <Button
                                variant="icon"
                                onClick={() => startCall(currentChat.id)}
                                disabled={callStatus !== 'idle'}
                              >
                                <Video size={20} />
                              </Button>
                          </Tooltip>
                        )}
                        {!isConnected && (
                            <span className={cn(
                                "px-3 py-1 rounded-full text-xs font-bold",
                                isDarkMode ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-600'
                            )}>
                                Disconnected
                            </span>
                        )}
                    </div>
                </div>

                {/* Messages */}
                <ScrollArea 
                    className={cn("flex-1", isDarkMode ? 'bg-neutral-950' : 'bg-[#e5ddd5]')}
                    viewportClassName="p-4 space-y-6"
                    onScroll={handleScroll}
                    viewportRef={scrollContainerRef}
                >
                    {isLoadingMore && (
                        <div className="flex justify-center py-4">
                            <div className={cn("text-xs px-3 py-1 rounded-full", isDarkMode ? 'bg-neutral-800 text-neutral-400' : 'bg-white/80 text-neutral-500 shadow-sm')}>
                                Loading history...
                            </div>
                        </div>
                    )}
                    
                    {isHistoryLoading ? (
                        <div className="space-y-6 p-4">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                                    <Skeleton className="h-16 w-64 rounded-2xl" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        messages
                        .filter(msg => {
                            if (!messageSearch) return true;
                            const content = msg.content.includes('|') ? msg.content.split('|')[1] : msg.content;
                            return content.toLowerCase().includes(messageSearch.toLowerCase());
                        })
                        .map((msg, idx) => {
                        const isMe = currentUserId != null && msg.sender_id === currentUserId;
                        const showAvatar = !isMe && (idx === 0 || messages[idx - 1].sender_id !== msg.sender_id);
                        
                        return (
                            <React.Fragment key={idx}>
                                {(idx === 0 || !isToday(new Date(msg.timestamp)) && isToday(new Date(messages[idx-1].timestamp)) === false && new Date(msg.timestamp).toDateString() !== new Date(messages[idx-1].timestamp).toDateString()) && (
                                    <div className="flex justify-center my-4">
                                        <span className={cn(
                                            "text-[10px] font-medium px-2 py-1 rounded-full border opacity-70",
                                            isDarkMode ? "bg-neutral-900 border-neutral-800 text-neutral-400" : "bg-neutral-100 border-neutral-200 text-neutral-500"
                                        )}>
                                            {format(new Date(msg.timestamp), isToday(new Date(msg.timestamp)) ? "'Today'" : isYesterday(new Date(msg.timestamp)) ? "'Yesterday'" : 'MMMM d, yyyy')}
                                        </span>
                                    </div>
                                )}
                                <div 
                                    className={cn(
                                        "flex group mb-1", 
                                        isMe ? 'justify-end' : 'justify-start'
                                    )}
                                >
                                {!isMe && (
                                    <div className="w-8 mr-2 flex-shrink-0 flex items-end">
                                        {showAvatar && (
                                            <Avatar 
                                                className="w-8 h-8"
                                                fallback={getUserLabel(msg.sender_id)[0].toUpperCase()} 
                                            />
                                        )}
                                    </div>
                                )}
                                
                                {isMe ? (
                                  <ContextMenuRoot>
                                    <ContextMenuTrigger asChild>
                                      <div className={cn(
                                        "max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-md relative text-sm",
                                        isDarkMode 
                                          ? 'bg-gradient-to-br from-brand-primary to-blue-600 text-white border border-brand-primary/20'
                                          : 'bg-gradient-to-br from-brand-primary to-blue-500 text-white shadow-brand-primary/20'
                                      )}>
                                    
                                    {/* Reply to message */}
                                    {msg.reply_to && (
                                      <div className={cn(
                                        "mb-2 p-2 rounded-lg border-l-4 bg-black/10 border-white/40"
                                      )}>
                                        <p className="text-xs font-bold opacity-90 mb-0.5">
                                          Replying to message
                                        </p>
                                        <p className="text-xs line-clamp-1 opacity-80">
                                          {messages.find(m => m.id === msg.reply_to)?.content || 'Original message'}
                                        </p>
                                      </div>
                                    )}
                                    
                                    {/* Content */}
                                    {msg.message_type === 'image' || (typeof msg.content === 'string' && msg.content.startsWith('/static/')) ? (
                                        <img 
                                            src={msg.content.startsWith('http') ? msg.content : `http://localhost:8000${msg.content}`} 
                                            alt="attachment" 
                                            className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                            onClick={() => window.open(`http://localhost:8000${msg.content}`, '_blank')}
                                        />
                                    ) : (
                                        <div 
                                          className="break-words leading-relaxed"
                                          dangerouslySetInnerHTML={{ 
                                            __html: formatMessage(msg.content) 
                                          }}
                                        />
                                    )}

                                    <div className="mt-1.5 -mr-1">
                                      <MessageReactions
                                        messageId={msg.id}
                                        reactions={msg.reactions || {}}
                                        currentUserId={currentUserId || 0}
                                        onReaction={handleReaction}
                                      />
                                    </div>

                                        {/* Meta */}
                                    <div className="flex items-center justify-end space-x-1.5 mt-1 select-none">
                                        <Tooltip content={format(new Date(msg.timestamp), 'PPpp')}>
                                            <span className="text-[10px] opacity-80 font-medium">
                                                {formatTimestamp(msg.timestamp)}
                                            </span>
                                        </Tooltip>
                                        {isMe && (
                                            <span className={cn("text-[10px]", (msg.status === 'read' || msg.is_read) ? 'text-sky-200 font-bold' : 'text-white/70')}>
                                                {(msg.status === 'read' || msg.is_read || msg.status === 'delivered') ? '✓✓' : '✓'}
                                            </span>
                                        )}
                                    </div>
                                    
                                        {/* Reply button */}
                                    <Tooltip content="Reply">
                                    <button
                                      onClick={() => handleReply(msg)}
                                      className={cn(
                                          "absolute -top-2 -right-2 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-md",
                                          isDarkMode ? 'bg-neutral-700 text-white' : 'bg-white text-neutral-600'
                                      )}
                                    >
                                      <Reply size={12} />
                                    </button>
                                    </Tooltip>
                                      </div>
                                    </ContextMenuTrigger>
                                    <ContextMenuContent className="w-40">
                                      <ContextMenuItem
                                        disabled={msg.message_type !== 'text'}
                                        onSelect={() => handleEditMessage(msg)}
                                      >
                                        <Edit2 size={14} className="mr-2" /> Edit Message
                                      </ContextMenuItem>
                                      <ContextMenuItem
                                        onSelect={() => handleDeleteMessage(msg.id)}
                                        className="text-red-500 focus:text-red-500"
                                      >
                                        <Trash2 size={14} className="mr-2" /> Delete Message
                                      </ContextMenuItem>
                                    </ContextMenuContent>
                                  </ContextMenuRoot>
                                ) : (
                                  <div className={cn(
                                    "max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm relative text-sm group border",
                                    isDarkMode 
                                        ? 'bg-neutral-800 text-neutral-100 border-neutral-700' 
                                        : 'bg-white text-neutral-900 border-neutral-100'
                                  )}>
                                    {/* Sender Name in Group */}
                                    {!isMe && currentChat.type === 'room' && (
                                        <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">{getUserLabel(msg.sender_id)}</p>
                                    )}
                                    
                                    {/* Reply to message */}
                                    {msg.reply_to && (
                                      <div className={cn(
                                        "mb-2 p-2 rounded-lg border-l-4 bg-neutral-100 dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700"
                                      )}>
                                        <p className="text-xs font-bold opacity-75 mb-0.5">
                                          Replying to message
                                        </p>
                                        <p className="text-xs line-clamp-1 opacity-70">
                                          {messages.find(m => m.id === msg.reply_to)?.content || 'Original message'}
                                        </p>
                                      </div>
                                    )}
                                    
                                    {/* Content */}
                                    {msg.message_type === 'image' || (typeof msg.content === 'string' && msg.content.startsWith('/static/')) ? (
                                        <img 
                                            src={msg.content.startsWith('http') ? msg.content : `http://localhost:8000${msg.content}`} 
                                            alt="attachment" 
                                            className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                            onClick={() => window.open(`http://localhost:8000${msg.content}`, '_blank')}
                                        />
                                    ) : (
                                        <div 
                                          className="break-words leading-relaxed"
                                          dangerouslySetInnerHTML={{ 
                                            __html: formatMessage(msg.content) 
                                          }}
                                        />
                                    )}

                                    <div className="mt-1.5 -mr-1">
                                      <MessageReactions
                                        messageId={msg.id}
                                        reactions={msg.reactions || {}}
                                        currentUserId={currentUserId || 0}
                                        onReaction={handleReaction}
                                      />
                                    </div>

                                    {/* Meta */}
                                    <div className="flex items-center justify-end space-x-1 mt-1 select-none">
                                        <Tooltip content={format(new Date(msg.timestamp), 'PPpp')}>
                                            <span className="text-[10px] opacity-60 font-medium">
                                                {formatTimestamp(msg.timestamp)}
                                            </span>
                                        </Tooltip>
                                    </div>
                                    
                                    {/* Reply button */}
                                    <Tooltip content="Reply">
                                    <button
                                      onClick={() => handleReply(msg)}
                                      className={cn(
                                          "absolute -top-2 -right-2 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-md",
                                          isDarkMode ? 'bg-neutral-700 text-white' : 'bg-white text-neutral-600'
                                      )}
                                    >
                                      <Reply size={12} />
                                    </button>
                                    </Tooltip>
                                  </div>
                                )}
                                </div>
                            </React.Fragment>
                        );
                    }))}
                    <div ref={messagesEndRef} />
                </ScrollArea>
                
                {/* Scroll to bottom button */}
                {showScrollButton && (
                  <button
                    onClick={scrollToBottom}
                    className={cn(
                        "absolute bottom-24 right-6 p-2 rounded-full shadow-lg transition-all z-20",
                        isDarkMode ? 'bg-neutral-700 text-white hover:bg-neutral-600' : 'bg-white text-neutral-600 hover:bg-neutral-50'
                    )}
                  >
                    <ChevronDown size={20} />
                  </button>
                )}

                {/* Input Area */}
                <div className={cn(
                    "p-4 shrink-0",
                    isDarkMode ? 'bg-neutral-900' : 'bg-[#f0f2f5]'
                )}>
                    {previewFile && (
                        <div className={cn(
                            "mb-2 p-2 rounded-lg border inline-flex items-center shadow-sm animate-in slide-in-from-bottom-2",
                            isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'
                        )}>
                            <span className={cn("text-xs truncate max-w-xs mr-2 font-medium", isDarkMode ? 'text-neutral-300' : 'text-neutral-700')}>{previewFile.name}</span>
                            <button onClick={() => setPreviewFile(null)} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"><X size={14}/></button>
                        </div>
                    )}
                    
                    {editingMessage && (
                        <div className={cn(
                            "mb-2 p-3 rounded-lg border flex justify-between items-center shadow-sm animate-in slide-in-from-bottom-2",
                            isDarkMode ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-100'
                        )}>
                            <div className="flex items-center">
                                <Edit2 size={14} className="text-brand-primary mr-2"/>
                                <div>
                                    <span className={cn("text-xs font-bold block", isDarkMode ? 'text-brand-primary' : 'text-brand-primary')}>Editing Message</span>
                                </div>
                            </div>
                            <button onClick={cancelEdit} className="text-neutral-500 hover:text-neutral-700 p-1"><X size={14}/></button>
                        </div>
                    )}
                    
                    {replyToMessage && (
                        <div className={cn(
                            "mb-2 p-3 rounded-lg border flex justify-between items-center shadow-sm animate-in slide-in-from-bottom-2 border-l-4 border-l-brand-primary",
                            isDarkMode ? 'bg-neutral-800 border-y-neutral-700 border-r-neutral-700' : 'bg-white border-y-neutral-200 border-r-neutral-200'
                        )}>
                            <div className="flex items-center max-w-[90%]">
                                <Reply size={14} className="text-brand-primary mr-3 shrink-0"/>
                                <div className="min-w-0">
                                  <span className={cn("text-xs font-bold block", isDarkMode ? 'text-brand-primary' : 'text-brand-primary')}>
                                    Replying to {replyToMessage.sender_name}
                                  </span>
                                  <p className={cn("text-xs line-clamp-1 opacity-70", isDarkMode ? 'text-neutral-400' : 'text-neutral-500')}>
                                    {replyToMessage.content}
                                  </p>
                                </div>
                            </div>
                            <button onClick={cancelReply} className="text-neutral-500 hover:text-neutral-700 p-1"><X size={14}/></button>
                        </div>
                    )}
                    
                    <div className="flex items-end gap-2">
                        <div className={cn(
                            "flex-1 flex items-end rounded-2xl border shadow-sm px-4 py-2 transition-all focus-within:ring-2 focus-within:ring-brand-primary/20 focus-within:border-brand-primary",
                            isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'
                        )}>
                            <div className="flex pb-2 gap-1">
                                <Tooltip content="Attach File">
                                    <button onClick={() => fileInputRef.current?.click()} className={cn("p-1 rounded-full transition-colors", isDarkMode ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700' : 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100')}>
                                        <Paperclip size={20} />
                                    </button>
                                </Tooltip>
                                <div className="relative">
                                    <EmojiPickerButton onEmojiSelect={handleEmojiSelect} className={cn("p-1 rounded-full transition-colors", isDarkMode ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700' : 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100')} />
                                </div>
                            </div>
                            
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*"
                                onChange={handleFileSelect}
                            />
                            
                            <input
                                id="message-input"
                                type="text"
                                placeholder="Type a message..."
                                className={cn(
                                    "flex-1 bg-transparent focus:outline-none py-3 px-2 max-h-32 overflow-y-auto text-sm",
                                    isDarkMode ? 'text-white placeholder:text-neutral-500' : 'text-neutral-900 placeholder:text-neutral-400'
                                )}
                                value={inputText}
                                onChange={handleTyping}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                autoComplete="off"
                            />
                        </div>
                        
                        <Button 
                            onClick={handleSendMessage} 
                            className={cn(
                                "rounded-full h-12 w-12 shrink-0 shadow-md transition-transform active:scale-95",
                                (!inputText.trim() && !previewFile) && "opacity-70"
                            )}
                            disabled={!inputText.trim() && !previewFile}
                        >
                            <Send size={20} className="ml-0.5" />
                        </Button>
                    </div>
                </div>
            </>
        ) : (
            <div className={cn(
                "flex-1 flex flex-col items-center justify-center p-8 text-center",
                isDarkMode ? 'bg-neutral-950 text-neutral-400' : 'bg-[#f0f2f5] text-neutral-500'
            )}>
                <div className={cn(
                    "w-32 h-32 rounded-full flex items-center justify-center mb-6 shadow-sm",
                    isDarkMode ? 'bg-neutral-900' : 'bg-white'
                )}>
                    <MessageSquare size={48} className="text-brand-primary/60" />
                </div>
                <h2 className={cn("text-2xl font-bold mb-2", isDarkMode ? 'text-neutral-200' : 'text-neutral-800')}>
                    Welcome to FastSock
                </h2>
                <p className="max-w-md text-sm leading-relaxed opacity-80">
                    Select a conversation from the sidebar to start chatting. You can create rooms or message users directly.
                </p>
            </div>
        )}
      </div>

      {/* Room Modal */}
      <Modal
        open={isCreateRoomModalOpen}
        onClose={() => setCreateRoomModalOpen(false)}
        title="Create New Room"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button type="button" variant="outline" onClick={() => setCreateRoomModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateRoom}>
              Create Room
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          <Input
            type="text"
            placeholder="Room Name"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
          />
          <div>
            <p className={cn("text-sm font-medium mb-3", isDarkMode ? 'text-neutral-300' : 'text-neutral-700')}>Select Members</p>
            <ScrollArea className={cn(
                "h-60 rounded-md border",
                isDarkMode ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-neutral-50'
            )}>
              <div className="p-2 space-y-1">
                {users.map((u) => (
                  <div key={u.id} className={cn(
                      "flex items-center space-x-3 p-2 rounded-md hover:bg-accent transition-colors",
                      isDarkMode ? 'hover:bg-neutral-800' : 'hover:bg-neutral-100'
                  )}>
                    <Checkbox 
                        id={`user-${u.id}`}
                        checked={selectedMembers.includes(u.id)}
                        onCheckedChange={(checked) => {
                            if (checked) setSelectedMembers((prev) => [...prev, u.id]);
                            else setSelectedMembers((prev) => prev.filter((id) => id !== u.id));
                        }}
                    />
                    <label 
                        htmlFor={`user-${u.id}`}
                        className="flex items-center space-x-3 cursor-pointer flex-1"
                    >
                        <Avatar className="w-8 h-8" fallback={u.full_name?.[0] || u.email[0]} />
                        <div className="flex flex-col">
                            <span className={cn("text-sm font-medium", isDarkMode ? 'text-neutral-200' : 'text-neutral-900')}>
                                {u.full_name || u.email}
                            </span>
                            <span className={cn("text-xs", isDarkMode ? 'text-neutral-500' : 'text-neutral-500')}>
                                {u.email}
                            </span>
                        </div>
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Chat;
