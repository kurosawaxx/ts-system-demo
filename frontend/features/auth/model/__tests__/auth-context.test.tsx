import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { AuthProvider, useAuth } from '@/features/auth/model/auth-context';
import { makeTestQueryClient } from '@/shared/test/renderWithProviders';
import { server } from '@/shared/test/msw/server';
import { buildUser } from '@/shared/test/fixtures/user';

vi.mock('@/shared/lib/cookies', () => ({
  getToken: vi.fn(),
  setToken: vi.fn(),
  removeToken: vi.fn(),
}));

import { getToken, setToken, removeToken } from '@/shared/lib/cookies';

function TestConsumer() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div>Loading</div>;
  return <div>{user ? `ログイン中: ${user.name}` : 'ゲスト'}</div>;
}

function renderAuth(queryClient?: QueryClient) {
  const qc = queryClient ?? makeTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('AuthProvider', () => {
  beforeEach(() => vi.clearAllMocks());

  it('トークンがない場合はゲストとして表示される', async () => {
    vi.mocked(getToken).mockReturnValue(undefined);
    renderAuth();
    await waitFor(() => expect(screen.getByText('ゲスト')).toBeInTheDocument());
  });

  it('トークンがある場合はユーザー名が表示される', async () => {
    vi.mocked(getToken).mockReturnValue('test-token');
    server.use(
      http.get('*/auth/me', () => HttpResponse.json(buildUser({ name: '田中一郎' }))),
    );
    renderAuth();
    await waitFor(() => expect(screen.getByText('ログイン中: 田中一郎')).toBeInTheDocument());
  });

  it('/auth/me が 401 を返すとトークンが削除されゲストになる', async () => {
    vi.mocked(getToken).mockReturnValue('expired-token');
    server.use(
      http.get('*/auth/me', () =>
        HttpResponse.json({ message: 'unauthorized' }, { status: 401 }),
      ),
    );
    renderAuth();
    await waitFor(() => expect(screen.getByText('ゲスト')).toBeInTheDocument());
    expect(removeToken).toHaveBeenCalled();
  });
});

describe('useAuth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('login 後にユーザーがセットされる', async () => {
    vi.mocked(getToken).mockReturnValue(undefined);
    server.use(
      http.post('*/auth/login', () =>
        HttpResponse.json({ token: 'new-token', user: buildUser({ name: 'ログインユーザー' }) }),
      ),
    );

    function LoginTest() {
      const { user, login, isLoading } = useAuth();
      if (isLoading) return <div>Loading</div>;
      return (
        <>
          <div>{user ? `ログイン中: ${user.name}` : 'ゲスト'}</div>
          <button onClick={() => login('test@example.com', 'password')}>ログイン</button>
        </>
      );
    }

    const qc = makeTestQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <LoginTest />
        </AuthProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByText('ゲスト')).toBeInTheDocument());

    await act(async () => {
      screen.getByRole('button', { name: 'ログイン' }).click();
    });

    await waitFor(() =>
      expect(screen.getByText('ログイン中: ログインユーザー')).toBeInTheDocument(),
    );
    expect(setToken).toHaveBeenCalledWith('new-token');
  });
});
