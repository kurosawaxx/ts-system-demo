'use client';

import { useAdminProjects } from '@/features/project/model/useProjects';
import { useAuth } from '@/features/auth/model/auth-context';
import Link from 'next/link';
import { useState, useMemo } from 'react';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12'];

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { data: projects = [], isLoading } = useAdminProjects();

  const currentYear = new Date().getFullYear();
  const [filterYear, setFilterYear]   = useState<string>(String(currentYear));
  const [filterMonth, setFilterMonth] = useState<string>(String(new Date().getMonth() + 1).padStart(2, '0'));

  const years = useMemo(() => {
    const ys = new Set(
      projects
        .map(p => p.billing_month?.slice(0, 4))
        .filter((y): y is string => !!y)
    );
    [currentYear - 1, currentYear, currentYear + 1].forEach(y => ys.add(String(y)));
    return [...ys].sort();
  }, [projects, currentYear]);

  const filtered = useMemo(() => {
    return projects.filter(p => {
      if (!p.billing_month) return false;
      const ym = p.billing_month.slice(0, 7); // "YYYY-MM"
      if (filterYear  && !ym.startsWith(filterYear))  return false;
      if (filterMonth && !ym.endsWith(`-${filterMonth}`)) return false;
      return true;
    });
  }, [projects, filterYear, filterMonth]);

  const won     = filtered.filter(p => p.probability === 'won');
  const pending = filtered.filter(p => p.probability === 'pending');
  const lost    = filtered.filter(p => p.probability === 'lost');
  const active  = filtered.filter(p => p.work_status === 'in_progress');

  const totalAmount = won.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const totalProfit = won.reduce((s, p) => s + Number(p.gross_profit ?? 0), 0);
  const avgMargin   = won.length > 0
    ? won.reduce((s, p) => s + Number(p.margin ?? 0), 0) / won.length
    : 0;

  const isFiltered = !!(filterYear || filterMonth);
  const periodLabel = filterYear
    ? filterMonth ? `${filterYear}年${Number(filterMonth)}月` : `${filterYear}年`
    : 'すべての期間';

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-gray-900">
          ようこそ、{user?.name} さん
        </h2>

        <div className="flex items-center gap-2">
          <select
            value={filterYear}
            onChange={e => setFilterYear(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0090B9]"
          >
            <option value="">すべての年</option>
            {years.map(y => <option key={y} value={y}>{y}年</option>)}
          </select>
          <select
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0090B9]"
          >
            <option value="">すべての月</option>
            {MONTHS.map(m => <option key={m} value={m}>{Number(m)}月</option>)}
          </select>
          {isFiltered && (
            <button
              onClick={() => { setFilterYear(String(currentYear)); setFilterMonth(String(new Date().getMonth() + 1).padStart(2, '0')); }}
              className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer px-1.5 py-1"
            >
              ✕ リセット
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-gray-200" />
          ))}
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-gray-400">集計期間：{periodLabel}の請求月ベース</p>

          <h3 className="mb-3 text-sm font-medium text-gray-500 uppercase tracking-wide">案件サマリー</h3>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="総案件数" value={filtered.length} />
            <StatCard label="受注" value={won.length} sub={`進行中 ${active.filter(p => p.probability === 'won').length} 件`} />
            <StatCard label="検討中" value={pending.length} />
            <StatCard label="失注" value={lost.length} />
          </div>

          <h3 className="mb-3 text-sm font-medium text-gray-500 uppercase tracking-wide">受注案件の収益</h3>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="受注総額" value={`¥${totalAmount.toLocaleString()}`} />
            <StatCard label="粗利合計" value={`¥${totalProfit.toLocaleString()}`} />
            <StatCard
              label="平均粗利率"
              value={`${avgMargin.toFixed(1)}%`}
              sub={`受注 ${won.length} 件の平均`}
            />
          </div>

          <h3 className="mb-3 text-sm font-medium text-gray-500 uppercase tracking-wide">クイックリンク</h3>
          <div className="flex gap-3 flex-wrap">
            <Link href="/admin/projects" className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              案件管理 →
            </Link>
            <Link href="/admin/users" className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              ユーザー管理 →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
