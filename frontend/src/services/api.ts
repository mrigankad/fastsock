import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import type { User, ChatRoom, Message, UnreadCounts } from '../types';

const api: AxiosInstance = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('fastsock_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export interface PrivacySettings {
  show_last_seen: 'everyone' | 'contacts' | 'nobody';
  show_avatar: 'everyone' | 'contacts' | 'nobody';
  show_bio: 'everyone' | 'contacts' | 'nobody';
  allow_dms: 'everyone' | 'contacts' | 'nobody';
  show_read_receipts: boolean;
}

export interface UserSession {
  id: string;
  user_agent?: string;
  ip_address?: string;
  created_at?: string;
  last_active_at?: string;
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ access_token: string, token_type: string }>('/auth/login/access-token', new URLSearchParams({ username, password }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }),
  signup: (email: string, password: string, fullName: string, username?: string) =>
    api.post<User>('/auth/signup', { email, password, full_name: fullName, username }),
  getMe: () => api.get<User>('/users/me'),
  updateProfile: (data: { username?: string; bio?: string; display_name?: string; avatar_url?: string; status_message?: string; presence_status?: string }) =>
    api.put<User>('/users/me', data),
  changePassword: (current_password: string, new_password: string) =>
    api.post('/users/me/change-password', { current_password, new_password }),
  getPrivacy: () => api.get<PrivacySettings>('/users/me/privacy'),
  updatePrivacy: (data: Partial<PrivacySettings>) => api.patch<PrivacySettings>('/users/me/privacy', data),
  getSessions: () => api.get<UserSession[]>('/auth/sessions'),
  revokeSession: (id: string) => api.delete(`/auth/sessions/${id}`),
  revokeAllSessions: () => api.delete('/auth/sessions'),
  getBlockedUsers: () => api.get<User[]>('/users/blocked'),
  blockUser: (userId: number) => api.post(`/users/${userId}/block`),
  unblockUser: (userId: number) => api.delete(`/users/${userId}/block`),
  deleteAccount: () => api.delete('/users/me'),
};

export const chatApi = {
  getUsers: () => api.get<User[]>('/users/'),
  searchUsers: (q: string) => api.get<User[]>(`/users/search?q=${encodeURIComponent(q)}`),
  getUser: (id: number) => api.get<User>(`/users/${id}`),
  getRooms: () => api.get<ChatRoom[]>('/chat/rooms'),
  createRoom: (name: string, memberIds: number[]) => api.post<ChatRoom>('/chat/rooms', { name, member_ids: memberIds }),
  getUnreadCounts: () => api.get<UnreadCounts>('/chat/unread'),
  markRoomRead: (roomId: number) => api.post<{ ok: boolean }>(`/chat/rooms/${roomId}/read`),
  getHistory: (type: 'user' | 'room', id: number, skip = 0, limit = 50) =>
    api.get<Message[]>(`/chat/history/${type}/${id}?skip=${skip}&limit=${limit}`),
  getIceServers: () => api.get<{ ice_servers: RTCIceServer[] }>('/webrtc/ice-servers'),
  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<{ url: string, filename: string, content_type: string }>('/utils/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  uploadAudio: (blob: Blob, filename = 'voice.webm') => {
    const formData = new FormData();
    formData.append('file', blob, filename);
    return api.post<{ url: string; content_type: string; size: number }>('/utils/upload/audio', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getDisappearingTimer: (target_type: string, target_id: number) =>
    api.get<{ target_type: string; target_id: number; duration_seconds: number }>(
      `/chat/disappearing?target_type=${target_type}&target_id=${target_id}`
    ),
  setDisappearingTimer: (target_type: string, target_id: number, duration_seconds: number) =>
    api.post<{ target_type: string; target_id: number; duration_seconds: number }>(
      '/chat/disappearing',
      { target_type, target_id, duration_seconds }
    ),
  updateMessage: (id: number, content: string) => api.put<Message>(`/chat/messages/${id}`, { content }),
  deleteMessage: (id: number) => api.delete<{ ok: boolean }>(`/chat/messages/${id}`),
  searchMessages: (q: string, limit = 50) =>
    api.get<Message[]>(`/chat/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  // Pinning
  pinMessage: (messageId: number) => api.post(`/chat/messages/${messageId}/pin`),
  unpinMessage: (messageId: number) => api.delete(`/chat/messages/${messageId}/pin`),
  getPins: (scope: string) => api.get<{ id: number; message_id: number; pinned_by: number; scope: string }[]>(`/chat/pins/${encodeURIComponent(scope)}`),
  // Bookmarks
  toggleBookmark: (messageId: number, note?: string) => api.post(`/chat/messages/${messageId}/bookmark`, { note }),
  getBookmarks: (skip = 0, limit = 50) => api.get(`/chat/bookmarks?skip=${skip}&limit=${limit}`),
  // Group management
  updateRoom: (roomId: number, data: { name?: string; description?: string; avatar_url?: string; slow_mode_seconds?: number }) =>
    api.patch(`/chat/rooms/${roomId}`, data),
  kickMember: (roomId: number, userId: number) => api.delete(`/chat/rooms/${roomId}/members/${userId}`),
  createInviteLink: (roomId: number, maxUses?: number) =>
    api.post<{ token: string; room_id: number; use_count: number; max_uses?: number }>(`/chat/rooms/${roomId}/invite`, null, { params: maxUses ? { max_uses: maxUses } : undefined }),
  joinViaInvite: (token: string) => api.get(`/chat/join/${token}`),
};

export interface CallHistoryItem {
  call_id: string;
  caller_id: number;
  callee_id: number;
  room_id?: number;
  status: string;
  created_at: string;
  started_at?: string;
  ended_at?: string;
}

export const callsApi = {
  getHistory: (peerUserId?: number, skip = 0, limit = 50) => {
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (peerUserId != null) params.set('peer_user_id', String(peerUserId));
    return api.get<CallHistoryItem[]>(`/calls/history?${params.toString()}`);
  },
};

export default api;
