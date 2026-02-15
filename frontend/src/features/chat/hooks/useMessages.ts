/**
 * useMessages — cursor-based message history via TanStack Query.
 *
 * Returns the full message list for a conversation: server history
 * merged with real-time incoming messages from the Zustand messageStore.
 */
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { chatApi } from '../../../services/api';
import { useMessageStore } from '../stores/messageStore';
import type { ChatTarget, Message } from '../../../types';

function convKey(target: ChatTarget): string {
  if (target.type === 'room') return `room:${target.room.id}`;
  return `dm:${target.user.id}`;
}

function historyQueryKey(target: ChatTarget, beforeId?: number) {
  return ['messages', convKey(target), beforeId ?? 'latest'];
}

export function useMessages(target: ChatTarget | null) {
  const [beforeId, setBeforeId] = useState<number | undefined>(undefined);
  const [olderPages, setOlderPages] = useState<Message[][]>([]);
  const [hasMore, setHasMore] = useState(true);

  const storeKey = target ? convKey(target) : '';
  const incoming = useMessageStore((s) => (storeKey ? (s.incoming[storeKey] ?? []) : []));

  // Fetch current page
  const historyQuery = useQuery<Message[]>({
    queryKey: historyQueryKey(target!, beforeId),
    queryFn: async () => {
      if (!target) return [];
      const type = target.type === 'dm' ? 'user' : 'room';
      const id = target.type === 'dm' ? target.user.id : target.room.id;
      const { data } = await chatApi.getHistory(type, id, 0, 50);
      return data;
    },
    enabled: !!target,
    staleTime: 30_000,
  });

  const loadMore = useCallback(async () => {
    if (!target || !hasMore || historyQuery.isFetching) return;
    const allHistory = [...olderPages.flat(), ...(historyQuery.data ?? [])];
    if (allHistory.length === 0) return;

    const type = target.type === 'dm' ? 'user' : 'room';
    const id = target.type === 'dm' ? target.user.id : target.room.id;
    // Use offset until backend exposes cursor param
    const { data: older } = await chatApi.getHistory(type, id, allHistory.length, 50);
    if (older.length === 0) {
      setHasMore(false);
    } else {
      setOlderPages((prev) => [older, ...prev]);
    }
  }, [target, hasMore, historyQuery.isFetching, historyQuery.data, olderPages]);

  // Reset pagination when target changes
  const reset = useCallback(() => {
    setBeforeId(undefined);
    setOlderPages([]);
    setHasMore(true);
  }, []);

  // Merge: older pages + current page + live incoming (deduplicated)
  const history = [...olderPages.flat(), ...(historyQuery.data ?? [])];
  const incomingNew = incoming.filter((m) => !history.some((h) => h.id === m.id));
  const messages = [...history, ...incomingNew];

  return {
    messages,
    isLoading: historyQuery.isLoading,
    isLoadingMore: historyQuery.isFetching && olderPages.length > 0,
    hasMore,
    loadMore,
    reset,
  };
}
