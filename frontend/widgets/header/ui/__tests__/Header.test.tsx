import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Header } from '@/widgets/header/ui/Header';
import { buildUser, buildAdminUser } from '@/shared/test/fixtures/user';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn().mockReturnValue('/dashboard'),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

vi.mock('@/features/auth/model/auth-context', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '@/features/auth/model/auth-context';
import { usePathname } from 'next/navigation';

describe('Header', () => {
  beforeEach(() => vi.clearAllMocks());

  it('一般ユーザーには管理メニューが表示されない', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: buildUser(),
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    render(<Header />);
    expect(screen.queryByText('案件管理')).not.toBeInTheDocument();
    expect(screen.queryByText('ユーザー管理')).not.toBeInTheDocument();
    expect(screen.getByText('ダッシュボード')).toBeInTheDocument();
  });

  it('管理者には管理メニューが表示される', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: buildAdminUser(),
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    render(<Header />);
    expect(screen.getByText('案件管理')).toBeInTheDocument();
    expect(screen.getByText('ユーザー管理')).toBeInTheDocument();
  });

  it('現在パスが /dashboard のときダッシュボードリンクがアクティブスタイルになる', () => {
    vi.mocked(usePathname).mockReturnValue('/dashboard');
    vi.mocked(useAuth).mockReturnValue({
      user: buildUser(),
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    render(<Header />);
    const link = screen.getByText('ダッシュボード').closest('a');
    expect(link).toHaveClass('font-semibold');
  });

  it('ユーザー名が表示される', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: buildUser({ name: '山田太郎' }),
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    render(<Header />);
    expect(screen.getByText('山田太郎')).toBeInTheDocument();
  });

  it('ログアウトボタンが表示される', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: buildUser(),
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    render(<Header />);
    expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument();
  });
});
