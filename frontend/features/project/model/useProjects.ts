import apiClient from '@/shared/api/client';
import type { ImportResult, Project, User } from '@/shared/types';

export interface ProjectUsersHoursMonth {
  actual_hours: number;
  actual_cost: number;
  planned_days: number;
  planned_cost: number;
}

export interface ProjectUsersHours {
  months: string[];
  users: Array<{
    id: number;
    name: string;
    // 無効化されたメンバーも過去の実績として行が残るため、「（無効）」表示用のフラグを受け取る。
    is_active?: boolean;
    // 工数入力時/インポート時に固定された人日単価。案件途中の単価改定で min !== max になる。
    day_cost_min?: number | null;
    day_cost_max?: number | null;
    monthly: Record<string, ProjectUsersHoursMonth>;
    total_actual_hours: number;
    total_actual_cost: number;
    total_planned_days: number;
    total_planned_cost: number;
  }>;
  total_actual_cost: number;
  total_planned_cost: number;
}
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const ADMIN_PROJECTS_KEY = ['admin', 'projects'] as const;
const USER_PROJECTS_KEY = ['projects'] as const;

export interface AdminProjectListFilters {
  work_status?: string;
  probability?: string;
  account_director_ids?: number[];
  billing_month_from?: string;
  billing_month_to?: string;
}

export function useAdminProjects(filters?: AdminProjectListFilters) {
  return useQuery<Project[]>({
    queryKey: [...ADMIN_PROJECTS_KEY, filters],
    queryFn: async () => {
      const { data } = await apiClient.get<Project[]>('/admin/projects', { params: filters });
      return data;
    },
  });
}

export function useAdminProject(id: number) {
  return useQuery<Project>({
    queryKey: [...ADMIN_PROJECTS_KEY, id],
    queryFn: async () => {
      const { data } = await apiClient.get<Project>(`/admin/projects/${id}`);
      return data;
    },
  });
}

export interface MyProjectListFilters {
  billing_month_from?: string;
  billing_month_to?: string;
}

export function useMyProjects(filters?: MyProjectListFilters) {
  return useQuery<Project[]>({
    queryKey: [...USER_PROJECTS_KEY, filters],
    queryFn: async () => {
      const { data } = await apiClient.get<Project[]>('/projects', { params: filters });
      return data;
    },
  });
}

type ProjectPayload = {
  project_name: string;
  ts_project_code?: string;
  client_name?: string;
  account_director?: string;
  sales_rep?: string;
  ts_created_date?: string;
  billing_month?: string;
  amount?: number;
  gross_profit_plan?: number;
  gross_profit_actual?: number;
  direct_outsourcing_cost_plan?: number;
  internal_hours_plan?: number;
  internal_hours_input?: number;
  billing_confirmed?: boolean;
  billing_pd_confirmed?: boolean;
  probability?: string;
  start_month?: string;
  end_month?: string;
  // 既存フィールド（後方互換）
  currency?: string;
  acceptance_month?: string;
  work_status?: string;
  notes?: string;
};

export function useUpdateProject(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<ProjectPayload>) =>
      apiClient.put<Project>(`/admin/projects/${id}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_PROJECTS_KEY }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/admin/projects/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_PROJECTS_KEY }),
  });
}

export function useProjectUsersHours(projectId: number) {
  return useQuery<ProjectUsersHours>({
    queryKey: [...ADMIN_PROJECTS_KEY, projectId, 'users-hours'],
    queryFn: async () => {
      const { data } = await apiClient.get<ProjectUsersHours>(`/admin/projects/${projectId}/users-hours`);
      return data;
    },
  });
}

export function useSyncProjectUsers(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userIds: number[]) =>
      apiClient.put<User[]>(`/admin/projects/${projectId}/users`, { user_ids: userIds }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_PROJECTS_KEY }),
  });
}

export function useImportExcel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<ImportResult> => {
      const form = new FormData();
      form.append('file', file);
      const { data } = await apiClient.post<ImportResult>('/admin/projects/import-csv', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_PROJECTS_KEY }),
  });
}
