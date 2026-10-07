import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { useAdminProjects, useDeleteProject } from '@/features/project/model/useProjects';
import { makeTestQueryClient } from '@/shared/test/renderWithProviders';
import { server } from '@/shared/test/msw/server';
import { buildProject } from '@/shared/test/fixtures/project';
import type { ReactNode } from 'react';

function makeWrapper(queryClient?: QueryClient) {
  const qc = queryClient ?? makeTestQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('useAdminProjects', () => {
  it('プロジェクト一覧を取得できる', async () => {
    const { result } = renderHook(() => useAdminProjects(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });

  it('フィルターパラメータが API に渡される', async () => {
    let capturedParams: URLSearchParams | undefined;
    server.use(
      http.get('*/admin/projects', ({ request }) => {
        capturedParams = new URL(request.url).searchParams;
        return HttpResponse.json([buildProject()]);
      }),
    );
    const { result } = renderHook(
      () => useAdminProjects({ work_status: 'in_progress' }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedParams?.get('work_status')).toBe('in_progress');
  });

  it('API エラー時は isError が true になる', async () => {
    server.use(
      http.get('*/admin/projects', () =>
        HttpResponse.json({ message: 'error' }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useAdminProjects(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteProject', () => {
  it('指定した ID のプロジェクトを削除する API が呼ばれる', async () => {
    let deletedId: string | undefined;
    server.use(
      http.delete('*/admin/projects/:id', ({ params }) => {
        deletedId = params.id as string;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(() => useDeleteProject(), {
      wrapper: makeWrapper(),
    });

    result.current.mutate(42);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deletedId).toBe('42');
  });
});
