'use client';

import { useAdminProjects } from '@/features/project/model/useProjects';
import { useProjectListFilters } from '@/features/project/model/useProjectListFilters';
import { useAccountDirectors } from '@/features/user/model/useUsers';
import { COL_LABELS } from '@/features/project/config/columns';
import { ProjectsTable, getCellText } from '@/features/project/ui/ProjectsTable';
import { ProjectFilterModal } from '@/features/project/ui/ProjectFilterModal';
import { ExcelImportButton } from '@/features/csv-import/ui/ExcelImportButton';
import { ExcelExportButton } from '@/features/csv-export/ui/ExcelExportButton';
import { Button } from '@/shared/ui/Button';
import { formatUserName } from '@/shared/lib/userLabel';
import { FilterIcon } from '@/shared/ui/Icon';
import type { Project } from '@/shared/types';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AdminProjectsPage() {
  const router = useRouter();
  const [showFilterModal, setShowFilterModal] = useState(false);

  const {
    workStatus, directorIds, billingFrom, billingTo,
    codeFilter, clientFilter, projectNameFilter, hasActiveFilter,
    setWorkStatus, setDirectorIds, setBillingRange,
    setCodeFilter, setClientFilter, setProjectNameFilter, resetAdvancedFilters,
  } = useProjectListFilters();

  // 絞り込みの選択肢はディレクターと管理者(アカウントディレクターに管理者アカウントを使っている
  // 場合がある)、および実際に案件のアカウントディレクターになっているユーザー。
  // バックエンドは選択された ID を name に解決して projects.account_director と突き合わせる。
  const { data: directorOptions } = useAccountDirectors();
  const directors = directorOptions ?? [];

  const { data: projects, isLoading } = useAdminProjects({
    work_status: workStatus || undefined,
    account_director_ids: directorIds.length > 0 ? directorIds : undefined,
    billing_month_from: billingFrom || undefined,
    billing_month_to: billingTo || undefined,
  });

  const handleRowClick = (project: Project) => router.push(`/admin/projects/${project.id}`);

  const normalize = (s: string) =>
    s.toLowerCase().replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const codeQ = normalize(codeFilter);
  const clientQ = normalize(clientFilter);
  const projectNameQ = normalize(projectNameFilter);
  const filtered = (projects ?? []).filter(p => {
    if (codeQ && !normalize(p.ts_project_code ?? '').includes(codeQ)) return false;
    if (clientQ && !normalize(p.client_name ?? '').includes(clientQ)) return false;
    if (projectNameQ && !normalize(p.project_name).includes(projectNameQ)) return false;
    return true;
  });

  // エクスポートは「案件×担当者×明細月」単位で1行にする(取込元のエクスポートファイルと同じ明細の形)。
  // 作業者はメンバー(role=user)のみを対象とし、ディレクター/管理者は除外する
  // (案件の実働工数を確認する目的のため。既存の実働工数画面 usersHours もディレクターを除外)。
  // 明細月が1つも無いメンバーは月欄を空にした1行(実働工数は全期間の合計)、
  // 対象メンバーが1人もいない案件は担当者欄・月欄・実働工数欄を空にした1行として出力する。
  type ExportRow = {
    project: Project;
    member?: NonNullable<Project['users']>[number];
    month?: string;
    actualHours?: number;
  };
  const exportRows: ExportRow[] = filtered.flatMap(p => {
    const members = (p.users ?? []).filter(m => m.role === 'user');
    if (members.length === 0) return [{ project: p }];
    return members.flatMap(member => {
      const monthly = member.monthly ?? [];
      return monthly.length > 0
        ? monthly.map(m => ({ project: p, member, month: m.month, actualHours: m.actual_hours }))
        : [{ project: p, member, actualHours: member.actual_hours }];
    });
  });

  // 「明細月」は取込元ファイルと同じく確度の左に置く(COL_LABELS の末尾が確度)。
  const probabilityColIndex = COL_LABELS.length - 1;
  const exportColumns = [
    ...COL_LABELS.slice(0, probabilityColIndex).map((label, i) => ({
      label,
      getValue: (r: ExportRow) => getCellText(r.project, i),
    })),
    {
      label: '明細月',
      getValue: (r: ExportRow) => r.month ?? '',
    },
    {
      label: COL_LABELS[probabilityColIndex],
      getValue: (r: ExportRow) => getCellText(r.project, probabilityColIndex),
    },
    {
      label: '作業者名',
      getValue: (r: ExportRow) => formatUserName(r.member),
    },
    {
      // 実働工数は work_hours の合計「時間」を小数第二位まで出力する
      // (バックの actual_hours は SUM(hours) を round(2) 済み。端数もそのまま保持される)。
      label: '実働工数(h)',
      getValue: (r: ExportRow) => r.actualHours != null ? Number(r.actualHours).toFixed(2) : '',
    },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">案件管理</h2>
        <div className="flex gap-2">
          <ExcelImportButton />
          <ExcelExportButton
            rows={exportRows}
            columns={exportColumns}
            fileName="案件一覧"
            storageKey="projects:exportCols:v4"
          />
        </div>
      </div>

      <ProjectsTable
        projects={projects}
        isLoading={isLoading}
        codeFilter={codeFilter}
        clientFilter={clientFilter}
        projectNameFilter={projectNameFilter}
        onRowClick={handleRowClick}
        toolbarExtra={
          <>
            <select
              value={workStatus}
              onChange={e => setWorkStatus(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#0090B9]"
            >
              <option value="">稼働: すべて</option>
              <option value="in_progress">進行中</option>
              <option value="completed">完了</option>
            </select>
            <Button variant={hasActiveFilter ? 'primary' : 'secondary'} size="sm" onClick={() => setShowFilterModal(true)}>
              <span className="flex items-center gap-1.5">
                <FilterIcon size={14} />
                {hasActiveFilter ? '絞り込み中' : '絞り込み'}
              </span>
            </Button>
            {(workStatus || hasActiveFilter) && (
              <button
                onClick={() => { setWorkStatus(''); resetAdvancedFilters(); }}
                className="text-xs text-gray-400 hover:text-gray-600 px-1.5 py-1 cursor-pointer"
              >
                ✕ リセット
              </button>
            )}
          </>
        }
      />

      {showFilterModal && (
        <ProjectFilterModal
          showDirectorFilter
          directors={directors}
          directorIds={directorIds}
          billingFrom={billingFrom}
          billingTo={billingTo}
          codeFilter={codeFilter}
          clientFilter={clientFilter}
          projectNameFilter={projectNameFilter}
          onDirectorIdsChange={setDirectorIds}
          onBillingRangeChange={setBillingRange}
          onCodeChange={setCodeFilter}
          onClientChange={setClientFilter}
          onProjectNameChange={setProjectNameFilter}
          onReset={resetAdvancedFilters}
          onClose={() => setShowFilterModal(false)}
        />
      )}
    </div>
  );
}
