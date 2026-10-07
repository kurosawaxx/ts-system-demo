import apiClient from '@/shared/api/client';
import type { User } from '@/shared/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const USERS_KEY = ['admin', 'users'] as const;

export function useUsers() {
  return useQuery<User[]>({
    queryKey: USERS_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<User[]>('/admin/users');
      return data;
    },
  });
}

export interface AccountDirector {
  id: number;
  name: string;
}

// 案件一覧の「アカウントディレクター」絞り込みの選択肢。
// 管理者・ディレクターのどちらからも同じ選択肢を得るための専用エンドポイント
// (/admin/users はディレクターに対して role=user しか返さないため代用できない)。
export function useAccountDirectors() {
  return useQuery<AccountDirector[]>({
    queryKey: ['admin', 'account-directors'],
    queryFn: async () => {
      const { data } = await apiClient.get<AccountDirector[]>('/admin/account-directors');
      return data;
    },
  });
}

export function useUser(id: number) {
  return useQuery<User>({
    queryKey: [...USERS_KEY, id],
    queryFn: async () => {
      const { data } = await apiClient.get<User>(`/admin/users/${id}`);
      return data;
    },
  });
}

type UserPayload = {
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'user' | 'director';
  day_cost: number;
  employee_code?: string;
  is_active?: boolean;
};

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UserPayload) => apiClient.post<User>('/admin/users', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

export function useUpdateUser(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<UserPayload>) => apiClient.put<User>(`/admin/users/${id}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

/**
 * 退職者を「削除」ではなく「無効化」で扱えるよう、一覧の行から直接切り替えるためのフック。
 * useUpdateUser は id を引数に取るので users.map() の中では呼べない。
 */
export function useSetUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiClient.put<User>(`/admin/users/${id}`, { is_active: isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  });
}
