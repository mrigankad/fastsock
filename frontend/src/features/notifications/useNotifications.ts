import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

export interface AppNotification {
  id: number;
  type: string;
  message_id?: number;
  from_user_id?: number;
  is_read: boolean;
  created_at?: string;
}

async function fetchNotifications(): Promise<AppNotification[]> {
  const r = await api.get<AppNotification[]>('/chat/notifications?limit=50');
  return r.data;
}

async function fetchUnreadCount(): Promise<number> {
  const r = await api.get<{ count: number }>('/chat/notifications/unread-count');
  return r.data.count;
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['notif-count'],
    queryFn: fetchUnreadCount,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    staleTime: 30_000,
  });
}

/** Call this from useWSEventBus to increment badge on WS event */
export function useNotificationInvalidator() {
  const qc = useQueryClient();
  return useCallback(() => {
    qc.invalidateQueries({ queryKey: ['notif-count'] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
  }, [qc]);
}

export async function markAllRead() {
  await api.post('/chat/notifications/read-all');
}
