import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/shared/test/renderWithProviders';
import { buildProject } from '@/shared/test/fixtures/project';
import { ProjectsTable } from '@/features/project/ui/ProjectsTable';

// サーバー順(請求月の降順)を想定した並び。売上予定額はあえてバラバラにしておく。
const projects = [
  buildProject({ id: 1, project_name: '案件B', amount: 200 }),
  buildProject({ id: 2, project_name: '案件C', amount: 300 }),
  buildProject({ id: 3, project_name: '案件A', amount: 100 }),
];

function renderTable() {
  return renderWithProviders(
    <ProjectsTable projects={projects} isLoading={false} onRowClick={vi.fn()} />,
  );
}

// 既定の列順では td[0] が担当者ボタン、td[3] がプロジェクト名。
const rowNames = () =>
  Array.from(document.querySelectorAll('tbody tr')).map(tr => tr.querySelectorAll('td')[3]?.textContent);

const header = (label: string) => screen.getByRole('columnheader', { name: new RegExp(`^${label}`) });

describe('ProjectsTable のソート', () => {
  it('未ソートのときはサーバー順で表示し、どの列も aria-sort="none"', () => {
    renderTable();
    expect(rowNames()).toEqual(['案件B', '案件C', '案件A']);
    expect(header('売上予定額')).toHaveAttribute('aria-sort', 'none');
  });

  it('ヘッダーをクリックするたびに 昇順 → 降順 → 昇順 と切り替わる', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(header('売上予定額'));
    expect(rowNames()).toEqual(['案件A', '案件B', '案件C']);
    expect(header('売上予定額')).toHaveAttribute('aria-sort', 'ascending');

    await user.click(header('売上予定額'));
    expect(rowNames()).toEqual(['案件C', '案件B', '案件A']);
    expect(header('売上予定額')).toHaveAttribute('aria-sort', 'descending');

    await user.click(header('売上予定額'));
    expect(rowNames()).toEqual(['案件A', '案件B', '案件C']);
    expect(header('売上予定額')).toHaveAttribute('aria-sort', 'ascending');
  });

  it('別の列をクリックすると、その列の昇順になり元の列は未ソート表示に戻る', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(header('売上予定額'));
    await user.click(header('売上予定額'));
    await user.click(header('プロジェクト名'));

    expect(rowNames()).toEqual(['案件A', '案件B', '案件C']);
    expect(header('プロジェクト名')).toHaveAttribute('aria-sort', 'ascending');
    expect(header('売上予定額')).toHaveAttribute('aria-sort', 'none');
  });

  it('列幅変更ハンドルのクリック・ダブルクリックではソートしない', async () => {
    const user = userEvent.setup();
    renderTable();

    const handle = screen.getByRole('separator', { name: '売上予定額の列幅を変更' });
    await user.click(handle);
    await user.dblClick(handle);

    expect(rowNames()).toEqual(['案件B', '案件C', '案件A']);
    expect(header('売上予定額')).toHaveAttribute('aria-sort', 'none');
  });

  // 列を縮めると同じ列の見出し上でマウスを離すことになり、ブラウザは mousedown(ハンドル)と
  // mouseup(見出し)の共通祖先である th に click を送る。これをソートとして扱わないこと。
  it('列幅変更の直後に th へ届く click ではソートしない', () => {
    renderTable();

    const handle = screen.getByRole('separator', { name: '売上予定額の列幅を変更' });
    fireEvent.mouseDown(handle, { clientX: 500 });
    fireEvent.mouseMove(window, { clientX: 450 });
    fireEvent.mouseUp(window, { clientX: 450 });
    fireEvent.click(header('売上予定額'));

    expect(rowNames()).toEqual(['案件B', '案件C', '案件A']);
    expect(header('売上予定額')).toHaveAttribute('aria-sort', 'none');
  });

  it('列幅変更の後でも、改めてクリックすればソートする', async () => {
    renderTable();

    // 列を広げた場合は click が th に届かない。その後の通常のクリックまで無視しないこと。
    const handle = screen.getByRole('separator', { name: '売上予定額の列幅を変更' });
    fireEvent.mouseDown(handle, { clientX: 500 });
    fireEvent.mouseUp(window, { clientX: 600 });
    await new Promise(resolve => setTimeout(resolve, 0));
    fireEvent.click(header('売上予定額'));

    expect(header('売上予定額')).toHaveAttribute('aria-sort', 'ascending');
  });

  it('表示設定の「設定をリセット」でソートが解除され、サーバー順に戻る', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(header('売上予定額'));
    await user.click(screen.getByRole('button', { name: /表示設定/ }));
    await user.click(screen.getByText('設定をリセット'));

    expect(rowNames()).toEqual(['案件B', '案件C', '案件A']);
    expect(header('売上予定額')).toHaveAttribute('aria-sort', 'none');
  });

  it('再マウントしてもソートが保持される', async () => {
    const user = userEvent.setup();
    const { unmount } = renderTable();

    await user.click(header('売上予定額'));
    await user.click(header('売上予定額'));
    unmount();

    renderTable();
    expect(rowNames()).toEqual(['案件C', '案件B', '案件A']);
    expect(header('売上予定額')).toHaveAttribute('aria-sort', 'descending');
  });
});
