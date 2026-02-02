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

export const authApi = {
  login: (username: string, password: string) => 
    api.post<{ access_token: string, token_type: string }>('/auth/login/access-token', new URLSearchParams({ username, password }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }),
  signup: (email: string, password: string, fullName: string) => 
    api.post<User>('/auth/signup', { email, password, full_name: fullName }),
  getMe: () => api.get<User>('/users/me'),
};

export const chatApi = {
  getUsers: () => api.get<User[]>('/users/'),
  getRooms: () => api.get<ChatRoom[]>('/chat/rooms'),
  createRoom: (name: string, memberIds: number[]) => api.post<ChatRoom>('/chat/rooms', { name, member_ids: memberIds }),
  getUnreadCounts: () => api.get<UnreadCounts>('/chat/unread'),
  getHistory: (type: 'user' | 'room', id: number, skip=0, limit=50) => 
    api.get<Message[]>(`/chat/history/${type}/${id}?skip=${skip}&limit=${limit}`),
  getIceServers: () => api.get<{ ice_servers: RTCIceServer[] }>('/webrtc/ice-servers'),
  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<{ url: string, filename: string, content_type: string }>('/utils/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  updateMessage: (id: number, content: string) => api.put<Message>(`/chat/messages/${id}`, { content }),
  deleteMessage: (id: number) => api.delete<{ ok: boolean }>(`/chat/messages/${id}`)
};

export default api;
