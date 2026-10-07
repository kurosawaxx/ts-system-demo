'use client';

import { useProjectUsersHours } from '@/features/project/model/useProjects';
import { hoursToDays, roundDays, formatDaysAndYen, formatDayCostRange } from '@/features/project/lib/formatPersonDays';
import { formatUserName } from '@/shared/lib/userLabel';
import { TableSkeleton } from '@/shared/ui/Skeleton';

interface ProjectMonthlyBreakdownProps {
  projectId: number;
  showSummary?: boolean;
}

export function ProjectMonthlyBreakdown({ projectId, showSummary = true }: ProjectMonthlyBreakdownProps) {
  const { data, isLoading } = useProjectUsersHours(projectId);

  const months = data?.months ?? [];
  const users = data?.users ?? [];

  const totalPlannedDays = roundDays(users.reduce((sum, u) => sum + u.total_planned_days, 0));
  const totalActualDays = roundDays(users.reduce((sum, u) => sum + hoursToDays(u.total_actual_hours), 0));

  const fmtYen = (n: number) => `¥${Math.round(n).toLocaleString()}`;

  return (
    <div>
      {showSummary && (
        <div className="mb-4 flex flex-wrap gap-x-8 gap-y-1">
          <div>
            <p className="text-xs text-gray-500">直接外注費(計画)</p>
            <p className="font-medium text-gray-900">{isLoading ? '—' : fmtYen(data?.total_planned_cost ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">直接外注費(実績)</p>
            <p className="font-medium text-gray-900">{isLoading ? '—' : fmtYen(data?.total_actual_cost ?? 0)}</p>
          </div>
        </div>
      )}

      <h3 className="mb-4 font-medium text-gray-700">担当者別・月次稼働（予定/実績）</h3>

      {isLoading ? (
        <TableSkeleton rows={3} cols={4} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 px-4 py-3 whitespace-nowrap">担当者</th>
                {months.map(m => (
                  <th key={m} className="px-4 py-3 text-right whitespace-nowrap">{m}</th>
                ))}
                <th className="sticky right-0 z-10 border-l border-gray-200 bg-gray-50 px-4 py-3 text-right whitespace-nowrap">合計</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.length === 0 && (
                <tr>
                  <td colSpan={months.length + 2} className="px-4 py-6 text-center text-gray-400">
                    担当者がいません
                  </td>
                </tr>
              )}
              {users.map(u => (
                <tr key={u.id}>
                  <td className="sticky left-0 z-10 border-r border-gray-200 bg-white px-4 py-3 font-medium text-gray-900 whitespace-nowrap align-top">
                    <div>{formatUserName(u)}</div>
                    {/* 金額の根拠が辿れるよう、原価計算に使われた当時の単価を氏名の下に出す。 */}
                    {formatDayCostRange(u.day_cost_min, u.day_cost_max) && (
                      <div className="text-xs font-normal text-gray-500">{formatDayCostRange(u.day_cost_min, u.day_cost_max)}</div>
                    )}
                  </td>
                  {months.map(m => {
                    const cell = u.monthly[m];
                    return (
                      <td key={m} className="px-4 py-3 text-right whitespace-nowrap text-gray-900">
                        <div className="text-gray-500 text-xs">予定 {formatDaysAndYen(cell?.planned_days ?? 0, cell?.planned_cost ?? 0)}</div>
                        <div>実績 {formatDaysAndYen(hoursToDays(cell?.actual_hours ?? 0), cell?.actual_cost ?? 0)}</div>
                      </td>
                    );
                  })}
                  <td className="sticky right-0 z-10 border-l border-gray-200 bg-white px-4 py-3 text-right whitespace-nowrap font-medium text-gray-900">
                    <div className="text-gray-500 text-xs font-normal">予定 {formatDaysAndYen(u.total_planned_days, u.total_planned_cost)}</div>
                    <div>実績 {formatDaysAndYen(hoursToDays(u.total_actual_hours), u.total_actual_cost)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
            {users.length > 0 && (
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600">合計</td>
                  {months.map(m => {
                    const plannedCost = users.reduce((sum, u) => sum + (u.monthly[m]?.planned_cost ?? 0), 0);
                    const plannedDays = roundDays(users.reduce((sum, u) => sum + (u.monthly[m]?.planned_days ?? 0), 0));
                    const actualCost = users.reduce((sum, u) => sum + (u.monthly[m]?.actual_cost ?? 0), 0);
                    const actualDays = roundDays(users.reduce((sum, u) => sum + hoursToDays(u.monthly[m]?.actual_hours ?? 0), 0));
                    return (
                      <td key={m} className="px-4 py-2 text-right text-sm text-gray-600 whitespace-nowrap">
                        <div className="text-xs text-gray-400">予定 {formatDaysAndYen(plannedDays, plannedCost)}</div>
                        <div className="font-medium text-gray-900">実績 {formatDaysAndYen(actualDays, actualCost)}</div>
                      </td>
                    );
                  })}
                  <td className="sticky right-0 z-10 border-l border-gray-200 bg-gray-50 px-4 py-2 text-right text-sm whitespace-nowrap">
                    <div className="text-xs text-gray-400">予定 {formatDaysAndYen(totalPlannedDays, data?.total_planned_cost ?? 0)}</div>
                    <div className="font-medium text-gray-900">実績 {formatDaysAndYen(totalActualDays, data?.total_actual_cost ?? 0)}</div>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
