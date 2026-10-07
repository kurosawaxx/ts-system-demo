import type { WorkHour } from '@/shared/types';

export function buildWorkHour(overrides: Partial<WorkHour> = {}): WorkHour {
  return {
    id: 1,
    project_id: 1,
    user_id: 1,
    work_date: '2026-05-01',
    hours: 8,
    memo: null,
    ...overrides,
  };
}
