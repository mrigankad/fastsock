export type PresenceStatus = 'available' | 'busy' | 'dnd' | 'away';

export interface User {
  id: number;
  email: string;
  full_name?: string;
  username?: string;      // unique @handle e.g. "john_doe"
  bio?: string;           // short about-me text
  display_name?: string;
  avatar_url?: string;
  status_message?: string;
  presence_status?: PresenceStatus;
  is_active?: boolean;
}

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image_url?: string;
  site_name?: string;
}

export interface Message {
  id: number;
  content: string;
  sender_id: number;
  receiver_id?: number;
  room_id?: number;
  timestamp: string;
  is_read: boolean;
  message_type: 'text' | 'image' | 'audio' | 'file';
  status?: 'sent' | 'delivered' | 'read';
  reactions?: Record<string, string[]>; // emoji -> userIds
  reply_to?: number; // message id this is replying to
  link_preview?: LinkPreview;
}

export interface ChatRoom {
  id: number;
  name: string;
  is_group: boolean;
  members?: User[];
}

export interface WSEvent {
  event: string;
  data: unknown;
}

export interface UnreadCounts {
  users: Record<number, number>;
  rooms: Record<number, number>;
}

export type ChatTarget =
  | { type: 'dm'; user: User }
  | { type: 'room'; room: ChatRoom };

export type ReplyTo = { id: number; content: string; senderName: string };
