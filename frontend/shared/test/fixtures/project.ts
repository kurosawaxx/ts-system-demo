import type { Project } from '@/shared/types';

export function buildProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    project_name: 'テストプロジェクト',
    currency: 'JPY',
    work_status: 'in_progress',
    ...overrides,
  };
}
