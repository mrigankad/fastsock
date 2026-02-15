import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { chatApi } from '../../../services/api';
import type { ChatRoom } from '../../../types';

export function useRooms() {
  const { user } = useAuth();
  return useQuery<ChatRoom[]>({
    queryKey: ['rooms'],
    queryFn: async () => {
      const { data } = await chatApi.getRooms();
      return data;
    },
    enabled: !!user,
  });
}
