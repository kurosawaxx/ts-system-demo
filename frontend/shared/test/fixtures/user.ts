import type { User } from '@/shared/types';

export function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    name: 'テスト太郎',
    email: 'test@example.com',
    role: 'user',
    day_cost: 40000,
    employee_code: 'EMP001',
    is_active: true,
    deactivated_at: null,
    ...overrides,
  };
}

export function buildAdminUser(overrides: Partial<User> = {}): User {
  return buildUser({ role: 'admin', name: '管理者', ...overrides });
}
