import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/shared/test/msw/server';
import { renderWithProviders } from '@/shared/test/renderWithProviders';
import { UserAssignPanel } from '@/features/project/ui/UserAssignPanel';
import type { Project } from '@/shared/types';

const BASE = process.env.NEXT_PUBLIC_API_URL + '/api';

// MSW の /admin/users は id:1「テスト太郎」と id:2「テスト花子」を現役として返す。
// 無効メンバー(id:9)は候補リストには出ないが案件にはアサイン済み、という状況を作る。
function buildProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 100,
    project_name: '無効メンバーが担当した案件',
    currency: 'JPY',
    work_status: 'in_progress',
    users: [
      { id: 1, name: 'テスト太郎', role: 'user', is_active: true },
      { id: 9, name: '退職太郎', role: 'user', is_active: false },
    ],
    ...overrides,
  };
}

/** 保存時に送られる user_ids を捕まえる。 */
function captureSyncedIds() {
  const captured: { userIds?: number[] } = {};
  server.use(
    http.put(`${BASE}/admin/projects/:id/users`, async ({ request }) => {
      const body = (await request.json()) as { user_ids: number[] };
      captured.userIds = body.user_ids;
      return HttpResponse.json([]);
    }),
  );
  return captured;
}

const checkboxes = () => screen.getAllByRole('checkbox') as HTMLInputElement[];

describe('UserAssignPanel', () => {
  it('アサイン済みの無効メンバーを「（無効）」付きで、解除できない状態で表示する', async () => {
    renderWithProviders(<UserAssignPanel project={buildProject()} onClose={vi.fn()} />);

    const inactive = await screen.findByLabelText('退職太郎（無効）');
    expect(inactive).toBeChecked();
    expect(inactive).toBeDisabled();
    expect(screen.getByText('退職太郎（無効）')).toBeInTheDocument();
    expect(screen.getByText(/アサイン済み（無効）/)).toBeInTheDocument();
  });

  it('無効メンバーは新規アサインの候補(操作可能なチェックボックス)には出さない', async () => {
    renderWithProviders(<UserAssignPanel project={buildProject()} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByLabelText(/テスト太郎/)).toBeInTheDocument());

    // 操作できるのは MSW が返す現役2名だけ。無効メンバーは disabled な1つだけ。
    expect(checkboxes().filter(cb => !cb.disabled)).toHaveLength(2);
    expect(checkboxes().filter(cb => cb.disabled)).toHaveLength(1);
    // 「（無効）」を付けない素の氏名では表示されない
    expect(screen.queryByText('退職太郎')).not.toBeInTheDocument();
  });

  it('保存時の user_ids に無効メンバーを含めたまま送る', async () => {
    const captured = captureSyncedIds();
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderWithProviders(<UserAssignPanel project={buildProject()} onClose={onClose} />);

    // 現役メンバーを1人追加してから保存する
    await user.click(await screen.findByLabelText(/テスト花子/));
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(captured.userIds?.slice().sort((a, b) => a - b)).toEqual([1, 2, 9]);
  });

  it('無効メンバーがいない案件では「（無効）」セクションを出さない', async () => {
    const project = buildProject({
      users: [{ id: 1, name: 'テスト太郎', role: 'user', is_active: true }],
    });
    renderWithProviders(<UserAssignPanel project={project} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByLabelText(/テスト太郎/)).toBeInTheDocument());
    expect(screen.queryByText(/アサイン済み（無効）/)).not.toBeInTheDocument();
    expect(checkboxes().filter(cb => cb.disabled)).toHaveLength(0);
  });
});
