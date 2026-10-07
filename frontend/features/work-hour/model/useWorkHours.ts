import apiClient from '@/shared/api/client';
import type { WorkHour } from '@/shared/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useWorkHours(projectId: number, month: string) {
  return useQuery<WorkHour[]>({
    queryKey: ['work-hours', projectId, month],
    queryFn: async () => {
      const { data } = await apiClient.get<WorkHour[]>(`/projects/${projectId}/work-hours`, {
        params: { month },
      });
      return data;
    },
  });
}

type WorkHourPayload = { work_date: string; hours: number; memo?: string };

export function useCreateWorkHour(projectId: number, month: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: WorkHourPayload) =>
      apiClient.post<WorkHour>(`/projects/${projectId}/work-hours`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work-hours', projectId, month] }),
  });
}

export function useUpdateWorkHour(projectId: number, month: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number } & Partial<WorkHourPayload>) =>
      apiClient.put<WorkHour>(`/projects/${projectId}/work-hours/${id}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work-hours', projectId, month] }),
  });
}

export function useDeleteWorkHour(projectId: number, month: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/projects/${projectId}/work-hours/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work-hours', projectId, month] }),
  });
}
