// ソート状態は列の index ではなくキー名で localStorage に保存する
// (列の追加・並び替えで index がずれても保存済みのソートが別の列を指さないようにするため)。

// ProjectsTable(管理者・ディレクター)の列。COL_LABELS と同じ並び。
export const PROJECT_COL_KEYS = [
  'code', 'client', 'project', 'director',
  'created', 'start', 'end', 'billing', 'amount', 'outsourcing_plan', 'outsourcing_actual', 'probability',
] as const;

// MyProjectsTable(メンバー)の列。
export const MY_PROJECT_COL_KEYS = [
  'code', 'project', 'client', 'start', 'end', 'billing', 'planned_hours', 'actual_hours', 'work_status', 'probability',
] as const;

export type SortKey = (typeof PROJECT_COL_KEYS)[number] | (typeof MY_PROJECT_COL_KEYS)[number];
export type SortDir = 'asc' | 'desc';
export type ProjectSort = { key: SortKey; dir: SortDir } | null;

export const PROJECT_SORT_STORAGE_KEY = 'projects:sort:v1';
export const MY_PROJECT_SORT_STORAGE_KEY = 'myProjects:sort:v1';
