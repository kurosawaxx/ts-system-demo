'use client';

import { useAdminProject } from '@/features/project/model/useProjects';
import { probabilityLabel, probabilityColor } from '@/features/project/config/probability';
import { ProjectMonthlyBreakdown } from '@/features/project/ui/ProjectMonthlyBreakdown';
import { Button } from '@/shared/ui/Button';
import Link from 'next/link';
import { use } from 'react';

export default function AdminProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const projectId = Number(id);

  const { data: project, isLoading: projectLoading } = useAdminProject(projectId);

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin/projects">
          <Button variant="secondary" size="sm">← 案件一覧</Button>
        </Link>
        <h2 className="text-xl font-semibold text-gray-900">
          {projectLoading ? '読み込み中...' : project?.project_name}
        </h2>
      </div>

      {!projectLoading && project && (
        <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-white p-5 sm:grid-cols-4">
          <div>
            <p className="text-xs text-gray-500">クライアント</p>
            <p className="mt-0.5 font-medium text-gray-900">{project.client_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">確度</p>
            <p className="mt-0.5">
              {project.probability ? (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${probabilityColor[project.probability]}`}>
                  {probabilityLabel[project.probability]}
                </span>
              ) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">請求月</p>
            <p className="mt-0.5 font-medium text-gray-900">{project.billing_month?.slice(0, 7) ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">金額</p>
            <p className="mt-0.5 font-medium text-gray-900">¥{Number(project.amount ?? 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">直接外注費(計画)</p>
            <p className="mt-0.5 font-medium text-gray-900">¥{Number(project.direct_outsourcing_cost_plan ?? 0).toLocaleString()}</p>
          </div>
          {project.total_cost !== undefined && (
            <div>
              <p className="text-xs text-gray-500">直接外注費(実績)</p>
              <p className="mt-0.5 font-medium text-gray-900">¥{Number(project.total_cost).toLocaleString()}</p>
            </div>
          )}
          {project.gross_profit !== undefined && (
            <>
              <div>
                <p className="text-xs text-gray-500">粗利</p>
                <p className="mt-0.5 font-medium text-gray-900">¥{Number(project.gross_profit).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">粗利率</p>
                <p className={`mt-0.5 font-medium ${Number(project.margin) >= 50 ? 'text-green-600' : Number(project.margin) >= 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {Number(project.margin).toFixed(1)}%
                </p>
              </div>
            </>
          )}
        </div>
      )}

      <ProjectMonthlyBreakdown projectId={projectId} showSummary={false} />
    </div>
  );
}
