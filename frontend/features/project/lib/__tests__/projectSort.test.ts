import { describe, it, expect } from 'vitest';
import { sortProjects, nextSort } from '@/features/project/lib/projectSort';
import { buildProject } from '@/shared/test/fixtures/project';
import type { Project } from '@/shared/types';

const ids = (projects: Project[]) => projects.map(p => p.id);

describe('sortProjects', () => {
  it('sort が null のときは入力順(サーバー順)のまま返す', () => {
    const projects = [
      buildProject({ id: 3, project_name: 'C' }),
      buildProject({ id: 1, project_name: 'A' }),
      buildProject({ id: 2, project_name: 'B' }),
    ];
    expect(ids(sortProjects(projects, null))).toEqual([3, 1, 2]);
  });

  it('入力配列を破壊しない', () => {
    const projects = [
      buildProject({ id: 2, project_name: 'B' }),
      buildProject({ id: 1, project_name: 'A' }),
    ];
    const sorted = sortProjects(projects, { key: 'project', dir: 'asc' });
    expect(ids(sorted)).toEqual([1, 2]);
    expect(ids(projects)).toEqual([2, 1]);
  });

  it('値が同じ行は入力順を保つ(安定ソート)', () => {
    const projects = [
      buildProject({ id: 1, client_name: 'X社' }),
      buildProject({ id: 2, client_name: 'A社' }),
      buildProject({ id: 3, client_name: 'X社' }),
      buildProject({ id: 4, client_name: 'X社' }),
    ];
    expect(ids(sortProjects(projects, { key: 'client', dir: 'asc' }))).toEqual([2, 1, 3, 4]);
    expect(ids(sortProjects(projects, { key: 'client', dir: 'desc' }))).toEqual([1, 3, 4, 2]);
  });

  describe('文字列', () => {
    it('プロジェクトコードは数字部分を数値として比較する', () => {
      const projects = [
        buildProject({ id: 1, ts_project_code: 'P-10' }),
        buildProject({ id: 2, ts_project_code: 'P-2' }),
        buildProject({ id: 3, ts_project_code: 'P-1' }),
      ];
      expect(ids(sortProjects(projects, { key: 'code', dir: 'asc' }))).toEqual([3, 2, 1]);
      expect(ids(sortProjects(projects, { key: 'code', dir: 'desc' }))).toEqual([1, 2, 3]);
    });

    // 並び順は localeCompare('ja', { numeric: true }) の結果をそのまま採用する(2026-09-30 決定)。
    // 記号 → 数字 → 英字 → かな → 漢字 の順で、漢字は読みではなく先頭の字の代表音読み順になる
    // (渡辺(ト) が 東京(トウ) より前)。法人格の表記ゆれは吸収しない。
    it('日本語の発注元は ja ロケールの照合順で並ぶ', () => {
      const names = [
        '東京電機', '株式会社アルファ', 'アルファ株式会社', '渡辺建設',
        'ABC株式会社', '(株)ベータ', '安藤商店', '123システム',
      ];
      const projects = names.map((client_name, i) => buildProject({ id: i + 1, client_name }));
      const sorted = sortProjects(projects, { key: 'client', dir: 'asc' });
      expect(sorted.map(p => p.client_name)).toEqual([
        '(株)ベータ', '123システム', 'ABC株式会社', 'アルファ株式会社',
        '安藤商店', '株式会社アルファ', '渡辺建設', '東京電機',
      ]);
    });

    it('プロジェクト名・アカウントディレクターも文字列として並ぶ', () => {
      const projects = [
        buildProject({ id: 1, project_name: 'いろは', account_director: '佐藤' }),
        buildProject({ id: 2, project_name: 'あいう', account_director: '安藤' }),
      ];
      expect(ids(sortProjects(projects, { key: 'project', dir: 'asc' }))).toEqual([2, 1]);
      expect(ids(sortProjects(projects, { key: 'director', dir: 'asc' }))).toEqual([2, 1]);
    });
  });

  describe('日付・月', () => {
    it('作成日・開始日・終了予定日を日付順に並べる', () => {
      const projects = [
        buildProject({ id: 1, ts_created_date: '2026-03-01', start_month: '2026-01-15', end_month: '2026-12-31' }),
        buildProject({ id: 2, ts_created_date: '2025-12-01', start_month: '2026-02-01', end_month: '2026-06-30' }),
        buildProject({ id: 3, ts_created_date: '2026-01-10', start_month: '2025-11-01', end_month: '2027-03-31' }),
      ];
      expect(ids(sortProjects(projects, { key: 'created', dir: 'asc' }))).toEqual([2, 3, 1]);
      expect(ids(sortProjects(projects, { key: 'start', dir: 'asc' }))).toEqual([3, 1, 2]);
      expect(ids(sortProjects(projects, { key: 'end', dir: 'desc' }))).toEqual([3, 1, 2]);
    });

    it('請求月を月順に並べる', () => {
      const projects = [
        buildProject({ id: 1, billing_month: '2026-10-01' }),
        buildProject({ id: 2, billing_month: '2026-02-01' }),
        buildProject({ id: 3, billing_month: '2025-12-01' }),
      ];
      expect(ids(sortProjects(projects, { key: 'billing', dir: 'asc' }))).toEqual([3, 2, 1]);
      expect(ids(sortProjects(projects, { key: 'billing', dir: 'desc' }))).toEqual([1, 2, 3]);
    });
  });

  describe('数値', () => {
    it('売上予定額を文字列ではなく数値として比較する', () => {
      const projects = [
        buildProject({ id: 1, amount: 900000 }),
        buildProject({ id: 2, amount: 1200000 }),
        buildProject({ id: 3, amount: 50000 }),
      ];
      expect(ids(sortProjects(projects, { key: 'amount', dir: 'asc' }))).toEqual([3, 1, 2]);
      expect(ids(sortProjects(projects, { key: 'amount', dir: 'desc' }))).toEqual([2, 1, 3]);
    });

    it('直接外注費(計画)・直接外注費(実績)を数値として比較する', () => {
      const projects = [
        buildProject({ id: 1, direct_outsourcing_cost_plan: 300, total_cost: 20 }),
        buildProject({ id: 2, direct_outsourcing_cost_plan: 40, total_cost: 1000 }),
      ];
      expect(ids(sortProjects(projects, { key: 'outsourcing_plan', dir: 'asc' }))).toEqual([2, 1]);
      expect(ids(sortProjects(projects, { key: 'outsourcing_actual', dir: 'asc' }))).toEqual([1, 2]);
    });

    it('工数は API が文字列で返しても数値として比較する', () => {
      const projects = [
        buildProject({ id: 1, total_planned_hours: '9.5' as unknown as number, total_actual_hours: 12 }),
        buildProject({ id: 2, total_planned_hours: '10.25' as unknown as number, total_actual_hours: 3 }),
      ];
      expect(ids(sortProjects(projects, { key: 'planned_hours', dir: 'asc' }))).toEqual([1, 2]);
      expect(ids(sortProjects(projects, { key: 'actual_hours', dir: 'asc' }))).toEqual([2, 1]);
    });
  });

  describe('区分', () => {
    const projects = [
      buildProject({ id: 1, probability: 'lost', work_status: 'completed' }),
      buildProject({ id: 2, probability: 'won', work_status: 'in_progress' }),
      buildProject({ id: 3, probability: 'pending', work_status: 'completed' }),
    ];

    it('確度の昇順は 受注 → 検討中 → 失注、降順はその逆', () => {
      expect(ids(sortProjects(projects, { key: 'probability', dir: 'asc' }))).toEqual([2, 3, 1]);
      expect(ids(sortProjects(projects, { key: 'probability', dir: 'desc' }))).toEqual([1, 3, 2]);
    });

    it('稼働状況の昇順は 進行中 → 完了、降順はその逆', () => {
      expect(ids(sortProjects(projects, { key: 'work_status', dir: 'asc' }))).toEqual([2, 1, 3]);
      expect(ids(sortProjects(projects, { key: 'work_status', dir: 'desc' }))).toEqual([1, 3, 2]);
    });
  });

  describe('空値', () => {
    it('null・undefined・空文字は昇順でも降順でも末尾に置く', () => {
      const projects = [
        buildProject({ id: 1, client_name: null }),
        buildProject({ id: 2, client_name: 'B社' }),
        buildProject({ id: 3, client_name: '' }),
        buildProject({ id: 4, client_name: 'A社' }),
        buildProject({ id: 5 }),
      ];
      expect(ids(sortProjects(projects, { key: 'client', dir: 'asc' }))).toEqual([4, 2, 1, 3, 5]);
      expect(ids(sortProjects(projects, { key: 'client', dir: 'desc' }))).toEqual([2, 4, 1, 3, 5]);
    });

    it('数値・区分の空値も末尾に置く', () => {
      const projects = [
        buildProject({ id: 1 }),
        buildProject({ id: 2, amount: 100, probability: 'lost' }),
        buildProject({ id: 3, amount: 0, probability: 'won' }),
      ];
      expect(ids(sortProjects(projects, { key: 'amount', dir: 'asc' }))).toEqual([3, 2, 1]);
      expect(ids(sortProjects(projects, { key: 'amount', dir: 'desc' }))).toEqual([2, 3, 1]);
      expect(ids(sortProjects(projects, { key: 'probability', dir: 'desc' }))).toEqual([2, 3, 1]);
    });
  });
});

describe('nextSort', () => {
  it('未ソートの状態からクリックすると、その列の昇順になる', () => {
    expect(nextSort(null, 'client')).toEqual({ key: 'client', dir: 'asc' });
  });

  it('別の列をクリックすると、その列の昇順から始まる', () => {
    expect(nextSort({ key: 'client', dir: 'desc' }, 'amount')).toEqual({ key: 'amount', dir: 'asc' });
  });

  it('同じ列は 昇順 ⇔ 降順 を切り替え、未ソートには戻らない', () => {
    const first = nextSort(null, 'billing');
    const second = nextSort(first, 'billing');
    const third = nextSort(second, 'billing');
    expect(first).toEqual({ key: 'billing', dir: 'asc' });
    expect(second).toEqual({ key: 'billing', dir: 'desc' });
    expect(third).toEqual({ key: 'billing', dir: 'asc' });
  });
});
