export interface User {
  id: number;
  email: string;
  full_name?: string;
  is_active?: boolean;
}

export interface Message {
  id: number;
  content: string;
  sender_id: number;
  receiver_id?: number;
  room_id?: number;
  timestamp: string;
  is_read: boolean;
  message_type: 'text' | 'image' | 'file';
  status?: 'sent' | 'delivered' | 'read';
  reactions?: Record<string, string[]>; // emoji -> userIds
  reply_to?: number; // message id this is replying to
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
