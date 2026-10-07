'use client';

import { probabilityLabel, probabilityColor } from '@/features/project/config/probability';
import { MY_PROJECT_COL_KEYS, type ProjectSort, type SortKey } from '@/features/project/config/sort';
import { SortIndicator, ariaSort } from '@/features/project/ui/SortIndicator';
import type { Project } from '@/shared/types';
import Link from 'next/link';

// 工数は小数第二位まで表示する(実働工数は work_hours の実入力時間の合計なので丸めない)。
const fmtHours = (n: number | string | null | undefined) =>
  n != null ? `${Number(n).toFixed(2)} h` : '—';

// 実働工数が予定工数を超えた案件は超過として色を変える(予定工数が無い案件は判定しない)。
const isOverPlan = (p: Project) =>
  (p.total_planned_hours ?? 0) > 0 && (p.total_actual_hours ?? 0) > (p.total_planned_hours ?? 0);

// 担当案件一覧の列幅(px)。table-fixed と組み合わせ、合計幅を最小幅にすることで
// 画面が狭いときはテーブル内を横スクロールさせ、セル内の折り返しを防ぐ。
// 幅に収まらないプロジェクト名・発注元は truncate し、全文は title 属性で見せる。
// コード, プロジェクト名, 発注元, 開始日, 終了予定日, 請求月, 予定工数, 実働工数, 稼働状況, 確度
const COL_WIDTHS = [140, 320, 180, 116, 116, 96, 120, 120, 96, 88];
const MIN_TABLE_W = COL_WIDTHS.reduce((a, b) => a + b, 0);

// MY_PROJECT_COL_KEYS と同じ並び
const HEADERS: { label: string; align?: string }[] = [
  { label: 'コード' },
  { label: 'プロジェクト名' },
  { label: '発注元' },
  { label: '開始日' },
  { label: '終了予定日' },
  { label: '請求月' },
  { label: '予定工数', align: 'text-right' },
  { label: '実働工数', align: 'text-right' },
  { label: '稼働状況' },
  { label: '確度', align: 'text-center' },
];

interface MyProjectsTableProps {
  // 絞り込み・ソート済みの案件。並び替えは呼び出し側で行う(リセットボタンとソート状態を共有するため)。
  projects: Project[];
  sort: ProjectSort;
  onSortToggle: (key: SortKey) => void;
}

export function MyProjectsTable({ projects, sort, onSortToggle }: MyProjectsTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full table-fixed text-sm" style={{ minWidth: MIN_TABLE_W }}>
        <colgroup>
          {COL_WIDTHS.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <thead className="bg-gray-50 text-left text-gray-500">
          <tr>
            {HEADERS.map(({ label, align }, i) => {
              const key = MY_PROJECT_COL_KEYS[i];
              return (
                <th
                  key={key}
                  aria-sort={ariaSort(sort, key)}
                  onClick={() => onSortToggle(key)}
                  className={`px-4 py-3 font-medium whitespace-nowrap cursor-pointer select-none hover:bg-gray-100 ${align ?? ''}`}
                >
                  {label}
                  <SortIndicator sort={sort} sortKey={key} />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {projects.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-400">該当する案件がありません</td>
            </tr>
          ) : projects.map(p => (
            <tr key={p.id} className="hover:bg-gray-50">
              <td className="px-4 py-2.5 truncate text-xs text-gray-500" title={p.ts_project_code ?? undefined}>{p.ts_project_code ?? '—'}</td>
              <td className="px-4 py-2.5 truncate font-medium text-gray-900" title={p.project_name}>
                <Link href={`/projects/${p.id}`} className="hover:underline hover:text-[#0090B9]">
                  {p.project_name}
                </Link>
              </td>
              <td className="px-4 py-2.5 truncate text-gray-600" title={p.client_name ?? undefined}>{p.client_name ?? '—'}</td>
              <td className="px-4 py-2.5 truncate text-gray-600">{p.start_month?.slice(0, 10) ?? '—'}</td>
              <td className="px-4 py-2.5 truncate text-gray-600">{p.end_month?.slice(0, 10) ?? '—'}</td>
              <td className="px-4 py-2.5 truncate text-gray-600">{p.billing_month?.slice(0, 7) ?? '—'}</td>
              <td className="px-4 py-2.5 text-right whitespace-nowrap text-gray-600">{fmtHours(p.total_planned_hours)}</td>
              <td className={`px-4 py-2.5 text-right whitespace-nowrap ${isOverPlan(p) ? 'font-medium text-red-600' : 'text-gray-900'}`}>
                {fmtHours(p.total_actual_hours)}
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">{p.work_status === 'in_progress' ? '進行中' : '完了'}</td>
              <td className="px-4 py-2.5 whitespace-nowrap text-center">
                {p.probability ? (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${probabilityColor[p.probability]}`}>
                    {probabilityLabel[p.probability]}
                  </span>
                ) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
