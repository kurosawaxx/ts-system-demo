'use client';

import { useAuth } from '@/features/auth/model/auth-context';
import { useMyProjects, useAdminProjects } from '@/features/project/model/useProjects';
import { useProjectListFilters } from '@/features/project/model/useProjectListFilters';
import { useProjectSort } from '@/features/project/model/useProjectSort';
import { useAccountDirectors } from '@/features/user/model/useUsers';
import { MY_PROJECT_COL_KEYS, MY_PROJECT_SORT_STORAGE_KEY } from '@/features/project/config/sort';
import { sortProjects } from '@/features/project/lib/projectSort';
import { ProjectsTable } from '@/features/project/ui/ProjectsTable';
import { MyProjectsTable } from '@/features/project/ui/MyProjectsTable';
import { ProjectFilterModal } from '@/features/project/ui/ProjectFilterModal';
import { MyWorkHourCalendar } from '@/features/work-hour/ui/MyWorkHourCalendar';
import { Button } from '@/shared/ui/Button';
import { FilterIcon } from '@/shared/ui/Icon';
import { TableSkeleton } from '@/shared/ui/Skeleton';
import type { Project } from '@/shared/types';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const normalize = (s: string) =>
  s.toLowerCase().replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));

export default function DashboardPage() {
  const { user } = useAuth();
  return user?.role === 'director' ? <DirectorDashboard /> : <GeneralDashboard />;
}

function DirectorDashboard() {
  const router = useRouter();
  const [showFilterModal, setShowFilterModal] = useState(false);
  const {
    workStatus, directorIds, billingFrom, billingTo,
    codeFilter, clientFilter, projectNameFilter, hasActiveFilter,
    setWorkStatus, setDirectorIds, setBillingRange,
    setCodeFilter, setClientFilter, setProjectNameFilter, resetAdvancedFilters,
  } = useProjectListFilters();

  // ディレクターも管理者と同じく全案件が対象で、アカウントディレクターでの絞り込みも使える。
  const { data: directorOptions } = useAccountDirectors();

  const { data: projects, isLoading } = useAdminProjects({
    work_status: workStatus || undefined,
    account_director_ids: directorIds.length > 0 ? directorIds : undefined,
    billing_month_from: billingFrom || undefined,
    billing_month_to: billingTo || undefined,
  });

  const handleRowClick = (project: Project) => router.push(`/projects/${project.id}`);

  return (
    <div className="h-full flex flex-col relative">
      <div className="mb-4 flex items-center justify-between py-1">
        <h2 className="text-xl font-semibold text-gray-900">案件一覧</h2>
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
          directors={directorOptions ?? []}
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

function GeneralDashboard() {
  const [showFilterModal, setShowFilterModal] = useState(false);
  const {
    billingFrom, billingTo, codeFilter, clientFilter, projectNameFilter, hasActiveFilter,
    setBillingRange, setCodeFilter, setClientFilter, setProjectNameFilter, resetAdvancedFilters,
  } = useProjectListFilters();

  // メンバー画面には表示設定が無いため、ソートは絞り込みのリセット(ツールバーの「✕ リセット」と
  // モーダルの「絞り込みをリセット」)で解除する。ディレクター・管理者は表示設定のリセットで解除する。
  const { sort, toggle: toggleSort, reset: resetSort } = useProjectSort(MY_PROJECT_SORT_STORAGE_KEY, MY_PROJECT_COL_KEYS);
  const resetFiltersAndSort = () => { resetAdvancedFilters(); resetSort(); };

  const { data: projects, isLoading } = useMyProjects({
    billing_month_from: billingFrom || undefined,
    billing_month_to: billingTo || undefined,
  });

  const codeQ = normalize(codeFilter);
  const clientQ = normalize(clientFilter);
  const projectNameQ = normalize(projectNameFilter);
  const filtered = (projects ?? []).filter(p => {
    if (codeQ && !normalize(p.ts_project_code ?? '').includes(codeQ)) return false;
    if (clientQ && !normalize(p.client_name ?? '').includes(clientQ)) return false;
    if (projectNameQ && !normalize(p.project_name).includes(projectNameQ)) return false;
    return true;
  });

  return (
    <div className="flex flex-col relative">
      <div className="mb-4 flex items-center justify-between py-1">
        <h2 className="text-xl font-semibold text-gray-900">担当案件一覧</h2>
      </div>

      <div className="mb-6">
        <MyWorkHourCalendar />
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Button variant={hasActiveFilter ? 'primary' : 'secondary'} size="sm" onClick={() => setShowFilterModal(true)}>
          <span className="flex items-center gap-1.5">
            <FilterIcon size={14} />
            {hasActiveFilter ? '絞り込み中' : '絞り込み'}
          </span>
        </Button>
        {(hasActiveFilter || sort !== null) && (
          <button
            onClick={resetFiltersAndSort}
            className="text-xs text-gray-400 hover:text-gray-600 px-1.5 py-1 cursor-pointer"
          >
            ✕ リセット
          </button>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : !projects?.length ? (
        <div className="rounded-lg border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400">
          担当案件がまだありません。
        </div>
      ) : (
        <MyProjectsTable projects={sortProjects(filtered, sort)} sort={sort} onSortToggle={toggleSort} />
      )}

      {showFilterModal && (
        <ProjectFilterModal
          showDirectorFilter={false}
          directors={[]}
          directorIds={[]}
          billingFrom={billingFrom}
          billingTo={billingTo}
          codeFilter={codeFilter}
          clientFilter={clientFilter}
          projectNameFilter={projectNameFilter}
          onDirectorIdsChange={() => {}}
          onBillingRangeChange={setBillingRange}
          onCodeChange={setCodeFilter}
          onClientChange={setClientFilter}
          onProjectNameChange={setProjectNameFilter}
          onReset={resetFiltersAndSort}
          onClose={() => setShowFilterModal(false)}
        />
      )}
    </div>
  );
}
