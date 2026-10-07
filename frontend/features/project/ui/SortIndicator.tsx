import type { ProjectSort, SortKey } from '@/features/project/config/sort';

export const ariaSort = (sort: ProjectSort, key: SortKey) =>
  sort?.key !== key ? 'none' : sort.dir === 'asc' ? 'ascending' : 'descending';

/** ソート中の列にだけ ▲(昇順) / ▼(降順) を表示する。 */
export function SortIndicator({ sort, sortKey }: { sort: ProjectSort; sortKey: SortKey }) {
  if (sort?.key !== sortKey) return null;
  return (
    <span aria-hidden="true" className="ml-1 text-[10px] text-[#0090B9]">
      {sort.dir === 'asc' ? '▲' : '▼'}
    </span>
  );
}
