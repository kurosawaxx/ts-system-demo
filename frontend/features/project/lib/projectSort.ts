import type { ProjectSort, SortKey } from '@/features/project/config/sort';
import type { Project } from '@/shared/types';

// 文字列は ja ロケールの照合順(記号 → 数字 → 英字 → かな → 漢字)で並べる。
// 漢字は読みではなく先頭の字の代表音読み順になり、法人格の表記ゆれも吸収しない(2026-09-30 決定)。
const collator = new Intl.Collator('ja', { numeric: true });

const PROBABILITY_ORDER: Record<string, number> = { won: 0, pending: 1, lost: 2 };
const WORK_STATUS_ORDER: Record<string, number> = { in_progress: 0, completed: 1 };

type SortValue = string | number | null;

const toNumber = (v: number | string | null | undefined): number | null =>
  v == null || v === '' ? null : Number(v);

const toText = (v: string | null | undefined): string | null => (v == null || v === '' ? null : v);

const rank = (order: Record<string, number>, v: string | null | undefined): number | null =>
  v != null && v in order ? order[v] : null;

function valueOf(p: Project, key: SortKey): SortValue {
  switch (key) {
    case 'code':               return toText(p.ts_project_code);
    case 'client':             return toText(p.client_name);
    case 'project':            return toText(p.project_name);
    case 'director':           return toText(p.account_director);
    // 日付・月は ISO 形式の文字列なので、そのまま文字列比較で時系列順になる
    case 'created':            return toText(p.ts_created_date);
    case 'start':              return toText(p.start_month);
    case 'end':                return toText(p.end_month);
    case 'billing':            return toText(p.billing_month);
    case 'amount':             return toNumber(p.amount);
    case 'outsourcing_plan':   return toNumber(p.direct_outsourcing_cost_plan);
    case 'outsourcing_actual': return toNumber(p.total_cost);
    case 'planned_hours':      return toNumber(p.total_planned_hours);
    case 'actual_hours':       return toNumber(p.total_actual_hours);
    case 'probability':        return rank(PROBABILITY_ORDER, p.probability);
    case 'work_status':        return rank(WORK_STATUS_ORDER, p.work_status);
  }
}

function compareValues(a: Exclude<SortValue, null>, b: Exclude<SortValue, null>): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

/**
 * 案件一覧をクライアント側でソートする。sort が null のときは入力順(サーバー順)のまま返す。
 * 空値は昇順・降順のどちらでも末尾に置き、同値の行は入力順を保つ。入力配列は破壊しない。
 */
export function sortProjects(projects: Project[], sort: ProjectSort): Project[] {
  if (!sort) return projects;
  const sign = sort.dir === 'asc' ? 1 : -1;
  return projects
    .map(p => ({ p, v: valueOf(p, sort.key) }))
    .sort((x, y) => {
      if (x.v === null || y.v === null) {
        if (x.v === y.v) return 0;
        return x.v === null ? 1 : -1;
      }
      return sign * compareValues(x.v, y.v);
    })
    .map(({ p }) => p);
}

/** ヘッダークリック時の次のソート状態。Backlog と同じく 昇順 ⇔ 降順 を切り替え、解除はしない。 */
export function nextSort(current: ProjectSort, key: SortKey): ProjectSort {
  if (current?.key !== key) return { key, dir: 'asc' };
  return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
}
