import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { chatApi } from '../../../services/api';
import type { User } from '../../../types';

export function useUsers() {
  const { user } = useAuth();
  return useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await chatApi.getUsers();
      return data.filter((u: User) => u.id !== user?.id);
    },
    enabled: !!user,
  });
}
