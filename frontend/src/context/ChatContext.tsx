import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';
import type { WSEvent } from '../types';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const isWSEvent = (v: unknown): v is WSEvent => {
  if (!isRecord(v)) return false;
  return typeof v.event === 'string' && 'data' in v;
};

interface ChatContextType {
  ws: WebSocket | null;
  isConnected: boolean;
  send: (event: string, data: unknown) => void;
  subscribe: (callback: (msg: WSEvent) => void) => () => void;
  onlineUsers: Record<number, boolean>;
  typingUsers: Record<number, boolean>;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Record<number, boolean>>({});
  const [typingUsers, setTypingUsers] = useState<Record<number, boolean>>({}); // { userId: bool }
  
  // Subscribers for different events
  const listenersRef = useRef<((msg: WSEvent) => void)[]>([]);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const devFirstEffectRef = useRef(true);

  const connect = () => {
    // If already connected or connecting, skip
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

    const token = localStorage.getItem('fastsock_token');
    if (!token) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${wsProtocol}://${window.location.host}/api/v1/ws/chat?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('WS Connected');
      setIsConnected(true);
      if (retryCountRef.current > 0) {
        toast.success('Reconnected to Chat');
      } else {
        toast.success('Connected to Chat');
      }
      retryCountRef.current = 0;
    };

    socket.onerror = () => {};

    socket.onclose = (event) => {
      console.log('WS Disconnected', { code: event.code, reason: event.reason, wasClean: event.wasClean });
      setIsConnected(false);
      setWs(null);
      wsRef.current = null;

      // Exponential backoff
      const timeout = Math.min(1000 * (2 ** retryCountRef.current), 30000);
      if (retryCountRef.current === 0) toast.error('Disconnected. Reconnecting...');
      
      reconnectTimeoutRef.current = setTimeout(() => {
        retryCountRef.current++;
        connect();
      }, timeout);
    };

    socket.onmessage = (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }

      if (isRecord(parsed) && typeof parsed.error === 'string') {
        toast.error(parsed.error);
        return;
      }

      if (!isWSEvent(parsed)) return;

      const msg = parsed;
      // console.log("WS Event:", msg); // Comment out to reduce noise
      
      // Dispatch to listeners
      listenersRef.current.forEach(listener => listener(msg));
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = msg.data as any; 

      // Global handling
      switch (msg.event) {
        case 'presence.update':
          setOnlineUsers(prev => ({
            ...prev,
            [data.user_id]: data.status === 'online'
          }));
          break;
        case 'typing.start':
             setTypingUsers(prev => ({ ...prev, [data.sender_id]: true }));
             break;
        case 'typing.stop':
             setTypingUsers(prev => ({ ...prev, [data.sender_id]: false }));
             break;
        case 'message.receive':
             // If not current chat, update unread (logic needs currentChat state awareness)
             // For now we just acknowledge receipt if it's a DM
             if (data.sender_id && !data.room_id) {
                 // Send delivered receipt
                 if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                     wsRef.current.send(JSON.stringify({
                         event: 'message.delivered',
                         data: {
                             message_id: data.id,
                             sender_id: data.sender_id
                         }
                     }));
                 }
             }
             break;
        case 'message.ack':
        case 'message.delivery_receipt':
        case 'message.read_receipt':
             // These are handled in the Chat component via listeners
             break;
        case 'message.reaction':
             // This will be handled in the Chat component via listeners
             break;
        case 'call.error':
             toast.error(typeof data?.message === 'string' ? data.message : 'Call failed');
             break;
      }
    };

    setWs(socket);
    wsRef.current = socket;
  };

  useEffect(() => {
    if (!user) {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
            setWs(null);
            setIsConnected(false);
        }
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        return;
    }

    if (import.meta.env.DEV && devFirstEffectRef.current) {
        devFirstEffectRef.current = false;
        return;
    }

    connect();

    return () => {
      if (wsRef.current) {
        // Remove onclose listener to prevent reconnect loop during cleanup/unmount
        wsRef.current.onclose = null; 
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const send = (event: string, data: unknown) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event, data }));
    }
  };

  const subscribe = (callback: (msg: WSEvent) => void) => {
    listenersRef.current.push(callback);
    return () => {
      listenersRef.current = listenersRef.current.filter(l => l !== callback);
    };
  };

  return (
    <ChatContext.Provider value={{ ws, isConnected, send, subscribe, onlineUsers, typingUsers }}>
      {children}
    </ChatContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
