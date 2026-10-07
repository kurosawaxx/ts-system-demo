'use client';

import { useCallback, useEffect, useState } from 'react';

export interface ProjectListFilters {
  workStatus: string;
  directorIds: number[];
  billingFrom: string;
  billingTo: string;
  codeFilter: string;
  clientFilter: string;
  projectNameFilter: string;
}

const EMPTY_FILTERS: ProjectListFilters = {
  workStatus: '',
  directorIds: [],
  billingFrom: '',
  billingTo: '',
  codeFilter: '',
  clientFilter: '',
  projectNameFilter: '',
};

const QUERY_KEYS = ['work_status', 'directors', 'billing_from', 'billing_to', 'f_code', 'f_client', 'f_project'] as const;

function storageKey(): string {
  return `projects:lastFilters:${window.location.pathname}`;
}

function hasAnyQueryParam(): boolean {
  const params = new URLSearchParams(window.location.search);
  return QUERY_KEYS.some(k => params.has(k));
}

function readFromLocation(): ProjectListFilters {
  const params = new URLSearchParams(window.location.search);
  return {
    workStatus: params.get('work_status') ?? '',
    directorIds: (params.get('directors') ?? '').split(',').filter(Boolean).map(Number),
    billingFrom: params.get('billing_from') ?? '',
    billingTo: params.get('billing_to') ?? '',
    codeFilter: params.get('f_code') ?? '',
    clientFilter: params.get('f_client') ?? '',
    projectNameFilter: params.get('f_project') ?? '',
  };
}

function readFromStorage(): ProjectListFilters {
  try {
    const saved = sessionStorage.getItem(storageKey());
    if (!saved) return EMPTY_FILTERS;
    return { ...EMPTY_FILTERS, ...JSON.parse(saved) };
  } catch {
    return EMPTY_FILTERS;
  }
}

// URLにクエリが無い場合(例: ナビゲーションリンクからのクエリ無し遷移)は、
// 同一ページで最後に使っていた絞り込み状態をsessionStorageから復元する。
// ブラウザバック/フォワードはURLに絞り込み状態が残っているため、そのままURLを優先する。
function readInitialFilters(): ProjectListFilters {
  if (typeof window === 'undefined') return EMPTY_FILTERS;
  return hasAnyQueryParam() ? readFromLocation() : readFromStorage();
}

function persist(filters: ProjectListFilters): void {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams();
  if (filters.workStatus) params.set('work_status', filters.workStatus);
  if (filters.directorIds.length > 0) params.set('directors', filters.directorIds.join(','));
  if (filters.billingFrom) params.set('billing_from', filters.billingFrom);
  if (filters.billingTo) params.set('billing_to', filters.billingTo);
  if (filters.codeFilter) params.set('f_code', filters.codeFilter);
  if (filters.clientFilter) params.set('f_client', filters.clientFilter);
  if (filters.projectNameFilter) params.set('f_project', filters.projectNameFilter);

  const qs = params.toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  // 検索/絞り込みの変更は履歴に積まず現在のURLを置き換える(ブラウザバックで一覧へ戻った際に
  // この状態がURLから復元されるようにするための同期であり、新たな履歴エントリは不要なため)。
  window.history.replaceState(null, '', url);

  try {
    sessionStorage.setItem(storageKey(), JSON.stringify(filters));
  } catch {}
}

export function useProjectListFilters() {
  const [filters, setFilters] = useState<ProjectListFilters>(EMPTY_FILTERS);
  const [hydrated, setHydrated] = useState(false);

  // Next.jsのクライアントサイド遷移では、マウント直後の時点でまだ
  // window.location が新しいパスに更新されていないことがあるため、
  // useStateの初期化子(初回レンダー同期)ではなくeffect(マウント後)で読み込む。
  // hydratedになるまでは下のpersist effectを止め、空の初期値で
  // URL/sessionStorageを誤って上書きしないようにする。
  useEffect(() => {
    setFilters(readInitialFilters());
    setHydrated(true);
  }, []);

  const update = useCallback((patch: Partial<ProjectListFilters>) => {
    setFilters(prev => ({ ...prev, ...patch }));
  }, []);

  // URLとsessionStorageへの反映はstateの更新関数(updater)の外、effectとして行う。
  // setState中に副作用(history.replaceStateとそれに伴うNext.js Routerの更新)を
  // 実行すると「render中に別コンポーネントを更新している」という警告になるため。
  useEffect(() => {
    if (!hydrated) return;
    persist(filters);
  }, [filters, hydrated]);

  useEffect(() => {
    const onPopState = () => setFilters(readFromLocation());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return {
    ...filters,
    setWorkStatus: (v: string) => update({ workStatus: v }),
    setDirectorIds: (ids: number[]) => update({ directorIds: ids }),
    setBillingRange: (from: string, to: string) => update({ billingFrom: from, billingTo: to }),
    setCodeFilter: (v: string) => update({ codeFilter: v }),
    setClientFilter: (v: string) => update({ clientFilter: v }),
    setProjectNameFilter: (v: string) => update({ projectNameFilter: v }),
    hasActiveFilter:
      filters.directorIds.length > 0 ||
      filters.billingFrom !== '' ||
      filters.billingTo !== '' ||
      filters.codeFilter !== '' ||
      filters.clientFilter !== '' ||
      filters.projectNameFilter !== '',
    resetAdvancedFilters: () => update({
      directorIds: [], billingFrom: '', billingTo: '',
      codeFilter: '', clientFilter: '', projectNameFilter: '',
    }),
  };
}
