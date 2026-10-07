import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { useUsers, useSetUserActive, useAccountDirectors } from '@/features/user/model/useUsers';
import { makeTestQueryClient } from '@/shared/test/renderWithProviders';
import { server } from '@/shared/test/msw/server';
import { buildUser } from '@/shared/test/fixtures/user';
import type { ReactNode } from 'react';

function makeWrapper(queryClient?: QueryClient) {
  const qc = queryClient ?? makeTestQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('useUsers', () => {
  it('ユーザー一覧を取得できる', async () => {
    const { result } = renderHook(() => useUsers(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });

  it('API エラー時は isError が true になる', async () => {
    server.use(
      http.get('*/admin/users', () =>
        HttpResponse.json({ message: 'error' }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useUsers(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useAccountDirectors', () => {
  it('絞り込み用のアカウントディレクター一覧を取得できる', async () => {
    server.use(
      http.get('*/admin/account-directors', () =>
        HttpResponse.json([
          { id: 1, name: 'ディレクターA' },
          { id: 2, name: 'ディレクターB' },
        ]),
      ),
    );

    const { result } = renderHook(() => useAccountDirectors(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map(d => d.name)).toEqual(['ディレクターA', 'ディレクターB']);
  });
});

describe('useSetUserActive', () => {
  it('無効化すると is_active: false を PUT する', async () => {
    let body: unknown;
    server.use(
      http.put('*/admin/users/:id', async ({ request, params }) => {
        body = await request.json();
        return HttpResponse.json(buildUser({ id: Number(params.id), is_active: false }));
      }),
    );

    const { result } = renderHook(() => useSetUserActive(), { wrapper: makeWrapper() });
    await result.current.mutateAsync({ id: 7, isActive: false });

    expect(body).toEqual({ is_active: false });
  });

  it('有効化すると is_active: true を PUT する', async () => {
    let body: unknown;
    server.use(
      http.put('*/admin/users/:id', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(buildUser());
      }),
    );

    const { result } = renderHook(() => useSetUserActive(), { wrapper: makeWrapper() });
    await result.current.mutateAsync({ id: 7, isActive: true });

    expect(body).toEqual({ is_active: true });
  });

  it('自分自身を無効化しようとしたときのエラーを呼び出し側へ伝える', async () => {
    server.use(
      http.put('*/admin/users/:id', () =>
        HttpResponse.json({ message: '自分自身を無効にはできません。' }, { status: 422 }),
      ),
    );

    const { result } = renderHook(() => useSetUserActive(), { wrapper: makeWrapper() });

    await expect(result.current.mutateAsync({ id: 1, isActive: false })).rejects.toThrow();
  });
});
