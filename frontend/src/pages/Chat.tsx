import React, { useCallback, useEffect, useState, useRef, type ChangeEvent, type MouseEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useCall } from '../context/CallContext';
import { useThemeStore } from '../store/themeStore';
import { chatApi } from '../services/api';
import { LogOut, Users, MessageSquare, Plus, Paperclip, Send, X, Edit2, Trash2, Search, Moon, Sun, Video, Reply, ChevronDown, Menu } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import type { User, ChatRoom, Message, UnreadCounts } from '../types';
import { Skeleton } from '../components/Skeleton';
import { EmojiPickerButton } from '../components/EmojiPicker';
import { MessageReactions } from '../components/MessageReactions';
import { CallOverlay } from '../components/CallOverlay';
import { formatMessage } from '../utils/messageFormatter';
import { Button, Input, Modal } from '../design-system';
import toast from 'react-hot-toast';

interface ChatInfo {
  type: 'user' | 'room';
  id: number;
  name: string;
}

interface ContextMenuState {
  id: number;
  x: number;
  y: number;
  isMe: boolean;
  content: string;
  type: 'text' | 'image' | 'file';
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
  const currentUserId = user?.id;
  
  const [activeTab, setActiveTab] = useState<'users' | 'rooms'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [currentChat, setCurrentChat] = useState<ChatInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({ users: {}, rooms: {} });
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
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

  // ... (handleIncomingMessage, updateMessageStatus) ...

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
                        icon: '/vite.svg' // Placeholder
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

  // Scroll to bottom on new messages (ONLY if we are near bottom or it's initial load)
  // For simplicity, let's auto-scroll only if we are not loading more history
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
    
    // Clear unread
    if (type === 'user') {
        setUnreadCounts(prev => {
            const newCounts = { ...prev };
            delete newCounts.users[item.id];
            return newCounts;
        });
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
            // We use setTimeout to allow render to happen
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

  // ... (handleSendMessage, handleTyping, handleContextMenu, handleEdit, handleDelete, cancelEdit, handleCreateRoom, handleFileSelect) ...

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

  const handleContextMenu = (e: MouseEvent, msg: Message) => {
    if (currentUserId != null && msg.sender_id === currentUserId) {
        e.preventDefault();
        setContextMenu({ id: msg.id, x: e.clientX, y: e.clientY, isMe: true, content: msg.content, type: msg.message_type });
    }
  };

  const handleEdit = () => {
    if (contextMenu && contextMenu.type === 'text') {
        setEditingMessage({ id: contextMenu.id, content: contextMenu.content });
        setInputText(contextMenu.content);
        setContextMenu(null);
        document.getElementById('message-input')?.focus();
    }
  };

  const handleDelete = async () => {
    if (contextMenu) {
        if (confirm("Delete this message?")) {
            await chatApi.deleteMessage(contextMenu.id);
        }
        setContextMenu(null);
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
    setIsRoomModalOpen(false);
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

        if (userReactions.includes(userIdStr)) {
          return {
            ...msg,
            reactions: {
              ...reactions,
              [emoji]: userReactions.filter(id => id !== userIdStr)
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

  if (!user) return <div>Loading...</div>;

  return (
    <div className={`flex h-screen overflow-hidden ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'}`} onClick={() => setContextMenu(null)}>
      <CallOverlay />
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'flex' : 'hidden'} md:flex w-80 border-r flex-col ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        {/* Header */}
        <div className={`p-4 border-b flex justify-between items-center ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${isDarkMode ? 'bg-blue-600' : 'bg-blue-500'}`}>
              {user.full_name?.[0] || user.email[0].toUpperCase()}
            </div>
            <div>
                <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{user.full_name || user.email}</p>
                <div className={`flex items-center text-xs ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
                    <div className={`w-2 h-2 rounded-full mr-1 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    {isConnected ? 'Online' : 'Offline'}
                </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={toggleDarkMode} 
              className={`p-2 rounded-full transition-colors ${
                isDarkMode ? 'text-yellow-400 hover:bg-gray-700' : 'text-gray-400 hover:bg-gray-100'
              }`}
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={logout} className="text-gray-400 hover:text-red-500">
              <LogOut size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className={`flex border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <button 
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'users' 
                ? `${isDarkMode ? 'text-blue-400 border-blue-400' : 'text-blue-600 border-blue-600'} border-b-2` 
                : `${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
            }`}
          >
            Direct Messages
          </button>
          <button 
            onClick={() => setActiveTab('rooms')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'rooms' 
                ? `${isDarkMode ? 'text-blue-400 border-blue-400' : 'text-blue-600 border-blue-600'} border-b-2` 
                : `${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
            }`}
          >
            Rooms
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'users' ? (
            <div className="divide-y divide-gray-100">
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
                  users.map(u => (
                <div 
                    key={u.id} 
                    onClick={() => selectChat('user', u)}
                    className={`p-3 flex items-center cursor-pointer transition-colors ${
                      currentChat?.id === u.id && currentChat?.type === 'user' 
                        ? (isDarkMode ? 'bg-blue-900' : 'bg-blue-50')
                        : (isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50')
                    }`}
                >
                  <div className="relative">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
                      isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
                    }`}>
                      {u.full_name?.[0] || u.email[0].toUpperCase()}
                    </div>
                    {onlineUsers[u.id] && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="flex justify-between items-center">
                        <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {u.full_name || u.email}
                        </p>
                        {unreadCounts.users[u.id] > 0 && (
                            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                {unreadCounts.users[u.id]}
                            </span>
                        )}
                    </div>
                  </div>
                </div>
              )))}
            </div>
          ) : (
            <div className="p-2">
                <button 
                    onClick={() => setIsRoomModalOpen(true)}
                    className={`w-full flex items-center justify-center space-x-2 py-2 rounded-md transition ${
                      isDarkMode 
                        ? 'bg-blue-900 text-blue-300 hover:bg-blue-800' 
                        : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                    } mb-2`}
                >
                    <Plus size={16} /> <span>Create Room</span>
                </button>
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
                        rooms.map(r => (
                        <div 
                            key={r.id}
                            onClick={() => selectChat('room', r)}
                            className={`p-3 flex items-center cursor-pointer rounded-md transition-colors ${
                              currentChat?.id === r.id && currentChat?.type === 'room' 
                                ? (isDarkMode ? 'bg-blue-900' : 'bg-blue-50')
                                : (isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100')
                            }`}
                        >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center relative ${
                              isDarkMode ? 'bg-indigo-900 text-indigo-300' : 'bg-indigo-100 text-indigo-600'
                            }`}>
                                <Users size={20} />
                                {unreadCounts.rooms[r.id] > 0 && (
                                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full border-2 border-white">
                                        {unreadCounts.rooms[r.id]}
                                    </div>
                                )}
                            </div>
                            <p className={`ml-3 text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{r.name}</p>
                        </div>
                    )))}
                </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`${isSidebarOpen ? 'hidden' : 'flex'} md:flex flex-1 flex-col relative ${isDarkMode ? 'bg-gray-800' : 'bg-[#e5ddd5]'}`}>
        {currentChat ? (
            <>
                {/* Header */}
                <div className={`p-4 border-b flex justify-between items-center shadow-sm z-10 ${
                  isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
                }`}>
                    <div className="flex items-center">
                        <button
                          type="button"
                          className={`mr-2 p-2 rounded-full md:hidden ${isDarkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}
                          onClick={() => setIsSidebarOpen(true)}
                          aria-label="Open chats"
                        >
                          <Menu size={18} />
                        </button>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mr-3 ${
                          currentChat.type === 'room' 
                            ? (isDarkMode ? 'bg-indigo-600' : 'bg-indigo-500')
                            : (isDarkMode ? 'bg-blue-600' : 'bg-blue-500')
                        }`}>
                            {currentChat.name[0].toUpperCase()}
                        </div>
                        <div>
                            <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{currentChat.name}</h3>
                            {currentChat.type === 'user' && typingUsers[currentChat.id] && (
                                <p className="text-xs text-blue-600 font-medium animate-pulse">typing...</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="relative">
                            <Search size={16} className={`absolute left-2 top-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`}/>
                            <input
                                type="text"
                                placeholder="Search messages..."
                                className={`pl-8 pr-2 py-1.5 border rounded-full text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-48 ${
                                  isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                                }`}
                                value={messageSearch}
                                onChange={(e) => setMessageSearch(e.target.value)}
                            />
                        </div>
                        {currentChat.type === 'user' && (
                          <Button
                            variant="icon"
                            size="sm"
                            onClick={() => startCall(currentChat.id)}
                            disabled={callStatus !== 'idle'}
                            aria-label="Start video call"
                          >
                            <Video size={18} />
                          </Button>
                        )}
                        {!isConnected && (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              isDarkMode ? 'bg-red-900 text-red-300' : 'bg-red-100 text-red-600'
                            }`}>
                                Disconnected
                            </span>
                        )}
                    </div>
                </div>

                {/* Messages */}
                <div 
                    className={`flex-1 overflow-y-auto p-4 space-y-4 ${isDarkMode ? 'bg-gray-800' : 'bg-[#e5ddd5]'}`}
                    onScroll={handleScroll}
                    ref={scrollContainerRef}
                >
                    {isLoadingMore && <div className={`text-center text-xs py-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading more...</div>}
                    
                    {isHistoryLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                                <Skeleton className="h-12 w-1/3" />
                            </div>
                        ))
                    ) : (
                        messages
                        .filter(msg => {
                            if (!messageSearch) return true;
                            const content = msg.content.includes('|') ? msg.content.split('|')[1] : msg.content;
                            return content.toLowerCase().includes(messageSearch.toLowerCase());
                        })
                        .map((msg, idx) => {
                        const isMe = currentUserId != null && msg.sender_id === currentUserId;
                        return (
                            <div 
                                key={idx} 
                                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                                onContextMenu={(e) => handleContextMenu(e, msg)}
                            >
                                <div className={`max-w-[70%] rounded-lg px-4 py-2 shadow-sm relative group ${
                                  isMe 
                                    ? (isDarkMode ? 'bg-blue-600' : 'bg-[#dcf8c6]')
                                    : (isDarkMode ? 'bg-gray-700' : 'bg-white')
                                }`}>
                                    {/* Sender Name in Group */}
                                    {!isMe && currentChat.type === 'room' && (
                                        <p className="text-xs font-bold text-orange-600 mb-1">{getUserLabel(msg.sender_id)}</p>
                                    )}
                                    
                                    {/* Reply to message */}
                                    {msg.reply_to && (
                                      <div className={`mb-2 p-2 rounded border-l-4 ${
                                        isMe 
                                          ? (isDarkMode ? 'bg-blue-700 border-blue-400' : 'bg-green-50 border-green-400')
                                          : (isDarkMode ? 'bg-gray-600 border-gray-500' : 'bg-gray-50 border-gray-400')
                                      }`}>
                                        <p className="text-xs font-medium text-gray-600 mb-1">
                                          Replying to message
                                        </p>
                                        <p className="text-xs line-clamp-2">
                                          {messages.find(m => m.id === msg.reply_to)?.content || 'Original message'}
                                        </p>
                                      </div>
                                    )}
                                    
                                    {/* Content */}
                                    {msg.message_type === 'image' || (typeof msg.content === 'string' && msg.content.startsWith('/static/')) ? (
                                        <img 
                                            src={msg.content.startsWith('http') ? msg.content : `http://localhost:8000${msg.content}`} 
                                            alt="attachment" 
                                            className="max-w-xs rounded cursor-pointer"
                                            onClick={() => window.open(`http://localhost:8000${msg.content}`, '_blank')}
                                        />
                                    ) : (
                                        <div 
                                          className={`text-sm ${
                                            isDarkMode ? 'text-white' : 'text-gray-800'
                                          }`}
                                          dangerouslySetInnerHTML={{ 
                                            __html: formatMessage(msg.content) 
                                          }}
                                        />
                                    )}

                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                      <MessageReactions
                                        messageId={msg.id}
                                        reactions={msg.reactions || {}}
                                        currentUserId={currentUserId || 0}
                                        onReaction={handleReaction}
                                      />
                                    </div>

                                    {/* Meta */}
                                    <div className="flex items-center justify-end space-x-1 mt-1">
                                        <span className={`text-[10px] ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`} title={format(new Date(msg.timestamp), 'PPpp')}>
                                            {formatTimestamp(msg.timestamp)}
                                        </span>
                                        {isMe && (
                                            <span className={`text-[10px] ${msg.is_read ? 'text-blue-500' : 'text-gray-500'}`}>
                                                {msg.is_read ? '✓✓' : '✓'}
                                            </span>
                                        )}
                                    </div>
                                    
                                    {/* Reply button */}
                                    <button
                                      onClick={() => handleReply(msg)}
                                      className={`absolute -top-2 -right-2 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${
                                        isDarkMode ? 'bg-gray-600 text-white' : 'bg-white text-gray-600'
                                      } shadow-md`}
                                      title="Reply to message"
                                    >
                                      <Reply size={12} />
                                    </button>
                                </div>
                            </div>
                        );
                    }))}
                    <div ref={messagesEndRef} />
                </div>
                
                {/* Scroll to bottom button */}
                {showScrollButton && (
                  <button
                    onClick={scrollToBottom}
                    className={`absolute bottom-20 right-4 p-2 rounded-full shadow-lg transition-all ${
                      isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <ChevronDown size={20} />
                  </button>
                )}

                {/* Input */}
                <div className={`p-3 border-t ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                    {previewFile && (
                        <div className={`mb-2 p-2 rounded-md border inline-flex items-center ${
                          isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'
                        }`}>
                            <span className={`text-xs truncate max-w-xs mr-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{previewFile.name}</span>
                            <button onClick={() => setPreviewFile(null)} className="text-red-500 hover:text-red-700"><X size={14}/></button>
                        </div>
                    )}
                    {editingMessage && (
                        <div className={`mb-2 p-2 rounded-md border flex justify-between items-center ${
                          isDarkMode ? 'bg-blue-900 border-blue-700' : 'bg-blue-50 border-blue-200'
                        }`}>
                            <div className="flex items-center">
                                <Edit2 size={14} className="text-blue-600 mr-2"/>
                                <span className={`text-sm ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>Editing message...</span>
                            </div>
                            <button onClick={cancelEdit} className="text-gray-500 hover:text-gray-700"><X size={14}/></button>
                        </div>
                    )}
                    {replyToMessage && (
                        <div className={`mb-2 p-2 rounded-md border flex justify-between items-center ${
                          isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-gray-100 border-gray-300'
                        }`}>
                            <div className="flex items-center">
                                <Reply size={14} className="text-gray-600 mr-2"/>
                                <div>
                                  <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                    Replying to {replyToMessage.sender_name}
                                  </span>
                                  <p className={`text-xs line-clamp-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {replyToMessage.content}
                                  </p>
                                </div>
                            </div>
                            <button onClick={cancelReply} className="text-gray-500 hover:text-gray-700"><X size={14}/></button>
                        </div>
                    )}
                    <div className={`flex items-center rounded-full border px-4 py-2 shadow-sm ${
                      isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'
                    }`}>
                        <button onClick={() => fileInputRef.current?.click()} className={`mr-2 ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
                            <Paperclip size={20} />
                        </button>
                        <EmojiPickerButton onEmojiSelect={handleEmojiSelect} className="mr-2" />
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
                            className={`flex-1 bg-transparent focus:outline-none ${
                              isDarkMode ? 'text-white placeholder-gray-400' : 'text-gray-700'
                            }`}
                            value={inputText}
                            onChange={handleTyping}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        />
                        <button onClick={handleSendMessage} className={`ml-2 ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-500 hover:text-blue-600'}`}>
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            </>
        ) : (
            <div className={`flex-1 flex flex-col items-center justify-center ${
              isDarkMode ? 'bg-gray-900 text-gray-400' : 'bg-[#f0f2f5] text-gray-500'
            }`}>
                <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-4 ${
                  isDarkMode ? 'bg-gray-800' : 'bg-gray-200'
                }`}>
                    <MessageSquare size={48} className={isDarkMode ? 'text-gray-600' : 'text-gray-400'} />
                </div>
                <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>FastSock Web</h2>
                <p className="text-sm mt-2">Select a chat to start messaging</p>
            </div>
        )}

        {/* Context Menu */}
        {contextMenu && (
            <div 
                className={`absolute shadow-lg rounded-md border py-1 z-50 w-32 ${
                  isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
                }`}
                style={{ top: contextMenu.y, left: contextMenu.x }}
            >
                <button 
                    onClick={handleEdit}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center ${
                      contextMenu.type !== 'text' 
                        ? 'text-gray-400 cursor-not-allowed' 
                        : (isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100')
                    }`}
                    disabled={contextMenu.type !== 'text'}
                >
                    <Edit2 size={14} className="mr-2"/> Edit
                </button>
                <button 
                    onClick={handleDelete}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center ${
                      isDarkMode ? 'text-red-400 hover:bg-gray-700' : 'text-red-600 hover:bg-gray-100'
                    }`}
                >
                    <Trash2 size={14} className="mr-2"/> Delete
                </button>
            </div>
        )}
      </div>

      {/* Room Modal */}
      <Modal
        open={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        title="Create New Room"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setIsRoomModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateRoom}>
              Create
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            type="text"
            placeholder="Room Name"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            className={isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}
          />
          <div>
            <p className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>Select Members:</p>
            <div className={`max-h-48 overflow-y-auto border rounded-md p-2 space-y-2 ${
              isDarkMode ? 'border-gray-600 bg-gray-800' : 'border-neutral-200'
            }`}>
              {users.map((u) => (
                <label key={u.id} className={`flex items-center gap-2 cursor-pointer ${
                  isDarkMode ? 'text-white' : 'text-neutral-700'
                }`}>
                  <input
                    type="checkbox"
                    className="rounded text-brand-primary focus:ring-brand-primary"
                    checked={selectedMembers.includes(u.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedMembers((prev) => [...prev, u.id]);
                      else setSelectedMembers((prev) => prev.filter((id) => id !== u.id));
                    }}
                  />
                  <span className="text-sm">{u.full_name || u.email}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Chat;
