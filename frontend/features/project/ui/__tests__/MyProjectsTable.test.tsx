import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildProject } from '@/shared/test/fixtures/project';
import { MyProjectsTable } from '@/features/project/ui/MyProjectsTable';

const LABELS = ['コード', 'プロジェクト名', '発注元', '開始日', '終了予定日', '請求月', '予定工数', '実働工数', '稼働状況', '確度'];

const header = (label: string) => screen.getByRole('columnheader', { name: new RegExp(`^${label}`) });

describe('MyProjectsTable', () => {
  it('10列のヘッダーを既存と同じ順で表示する', () => {
    render(<MyProjectsTable projects={[]} sort={null} onSortToggle={vi.fn()} />);
    const names = screen.getAllByRole('columnheader').map(th => th.textContent);
    expect(names).toEqual(LABELS);
  });

  it('案件が無いときは「該当する案件がありません」を表示する', () => {
    render(<MyProjectsTable projects={[]} sort={null} onSortToggle={vi.fn()} />);
    expect(screen.getByText('該当する案件がありません')).toBeInTheDocument();
  });

  it('工数を小数第二位までの時間で表示し、予定超過の実働工数を赤字にする', () => {
    const project = buildProject({
      id: 7,
      project_name: '超過案件',
      total_planned_hours: 10,
      total_actual_hours: 12.5,
      probability: 'won',
      work_status: 'completed',
    });
    render(<MyProjectsTable projects={[project]} sort={null} onSortToggle={vi.fn()} />);

    expect(screen.getByText('10.00 h')).toBeInTheDocument();
    expect(screen.getByText('12.50 h')).toHaveClass('text-red-600');
    expect(screen.getByText('完了')).toBeInTheDocument();
    expect(screen.getByText('受注')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '超過案件' })).toHaveAttribute('href', '/projects/7');
  });

  it('渡された projects の順に行を表示する(ソートは呼び出し側で行う)', () => {
    const projects = [
      buildProject({ id: 1, project_name: '案件B' }),
      buildProject({ id: 2, project_name: '案件A' }),
    ];
    render(<MyProjectsTable projects={projects} sort={null} onSortToggle={vi.fn()} />);
    expect(screen.getAllByRole('link').map(a => a.textContent)).toEqual(['案件B', '案件A']);
  });

  it.each([
    ['コード', 'code'],
    ['プロジェクト名', 'project'],
    ['発注元', 'client'],
    ['開始日', 'start'],
    ['終了予定日', 'end'],
    ['請求月', 'billing'],
    ['予定工数', 'planned_hours'],
    ['実働工数', 'actual_hours'],
    ['稼働状況', 'work_status'],
    ['確度', 'probability'],
  ])('「%s」ヘッダーのクリックで onSortToggle("%s") が呼ばれる', async (label, key) => {
    const user = userEvent.setup();
    const onSortToggle = vi.fn();
    render(<MyProjectsTable projects={[]} sort={null} onSortToggle={onSortToggle} />);

    await user.click(header(label));
    expect(onSortToggle).toHaveBeenCalledWith(key);
  });

  it('sort に応じて aria-sort と ▲▼ を表示する', () => {
    const { rerender } = render(
      <MyProjectsTable projects={[]} sort={{ key: 'billing', dir: 'asc' }} onSortToggle={vi.fn()} />,
    );
    expect(header('請求月')).toHaveAttribute('aria-sort', 'ascending');
    expect(header('請求月')).toHaveTextContent('▲');
    expect(header('発注元')).toHaveAttribute('aria-sort', 'none');

    rerender(<MyProjectsTable projects={[]} sort={{ key: 'billing', dir: 'desc' }} onSortToggle={vi.fn()} />);
    expect(header('請求月')).toHaveAttribute('aria-sort', 'descending');
    expect(header('請求月')).toHaveTextContent('▼');
  });
});
