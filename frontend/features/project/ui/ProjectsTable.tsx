'use client';

import { COL_LABELS, DEFAULT_COL_WIDTHS } from '@/features/project/config/columns';
import { probabilityLabel, probabilityColor } from '@/features/project/config/probability';
import { PROJECT_COL_KEYS, PROJECT_SORT_STORAGE_KEY } from '@/features/project/config/sort';
import { sortProjects } from '@/features/project/lib/projectSort';
import { useColumnVisibility } from '@/features/project/model/useColumnVisibility';
import { useColumnOrder } from '@/features/project/model/useColumnOrder';
import { useProjectSort } from '@/features/project/model/useProjectSort';
import { ColumnSettingsModal } from '@/features/project/ui/ColumnSettingsModal';
import { SortIndicator, ariaSort } from '@/features/project/ui/SortIndicator';
import { UserAssignPanel } from '@/features/project/ui/UserAssignPanel';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { Spinner } from '@/shared/ui/Spinner';
import type { Project } from '@/shared/types';
import { ColumnSettingsIcon } from '@/shared/ui/Icon';
import { useEffect, useRef, useState, type ReactNode } from 'react';

const fmt = (n: number | null | undefined) =>
  n != null ? `¥${Number(n).toLocaleString()}` : '—';

const ACTION_COL_W = 96;
const ROW_H = 41;
const OVERSCAN = 8;

export function getCellText(p: Project, i: number): string {
  switch (i) {
    case 0:  return p.ts_project_code ?? '—';
    case 1:  return p.client_name ?? '—';
    case 2:  return p.project_name;
    case 3:  return p.account_director ?? '—';
    case 4:  return p.ts_created_date?.slice(0, 10) ?? '—';
    case 5:  return p.start_month?.slice(0, 10) ?? '—';
    case 6:  return p.end_month?.slice(0, 10) ?? '—';
    case 7:  return p.billing_month?.slice(0, 7) ?? '—';
    case 8:  return fmt(p.amount);
    case 9:  return fmt(p.direct_outsourcing_cost_plan);
    case 10: return fmt(p.total_cost);
    case 11: return p.probability ? probabilityLabel[p.probability] : '—';
    default: return '';
  }
}

function renderCell(p: Project, i: number) {
  switch (i) {
    case 0:  return <td key={i} className="px-3 truncate text-gray-500 text-xs">{p.ts_project_code ?? '—'}</td>;
    case 1:  return <td key={i} className="px-3 truncate text-gray-600">{p.client_name ?? '—'}</td>;
    case 2:  return <td key={i} className="px-3 truncate font-medium text-gray-900">{p.project_name}</td>;
    case 3:  return <td key={i} className="px-3 truncate text-gray-600">{p.account_director ?? '—'}</td>;
    case 4:  return <td key={i} className="px-3 truncate text-gray-600">{p.ts_created_date?.slice(0, 10) ?? '—'}</td>;
    case 5:  return <td key={i} className="px-3 truncate text-gray-600">{p.start_month?.slice(0, 10) ?? '—'}</td>;
    case 6:  return <td key={i} className="px-3 truncate text-gray-600">{p.end_month?.slice(0, 10) ?? '—'}</td>;
    case 7:  return <td key={i} className="px-3 truncate text-gray-600">{p.billing_month?.slice(0, 7) ?? '—'}</td>;
    case 8:  return <td key={i} className="px-3 truncate text-right text-gray-900">{fmt(p.amount)}</td>;
    case 9:  return <td key={i} className="px-3 truncate text-right text-gray-900">{fmt(p.direct_outsourcing_cost_plan)}</td>;
    case 10: return <td key={i} className="px-3 truncate text-right text-gray-900">{fmt(p.total_cost)}</td>;
    case 11: return (
      <td key={i} className="px-3 truncate text-center">
        {p.probability ? (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${probabilityColor[p.probability]}`}>
            {probabilityLabel[p.probability]}
          </span>
        ) : '—'}
      </td>
    );
    default: return null;
  }
}

interface ProjectsTableProps {
  projects: Project[] | undefined;
  isLoading: boolean;
  codeFilter?: string;
  clientFilter?: string;
  projectNameFilter?: string;
  toolbarExtra?: ReactNode;
  onRowClick: (project: Project) => void;
}

export function ProjectsTable({ projects, isLoading, codeFilter, clientFilter, projectNameFilter, toolbarExtra, onRowClick }: ProjectsTableProps) {
  const [showColSettings, setShowColSettings] = useState(false);
  const [colWidths, setColWidths] = useState<number[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_COL_WIDTHS;
    try {
      const saved = localStorage.getItem('projects:colWidths');
      if (saved) {
        const parsed = JSON.parse(saved) as number[];
        if (Array.isArray(parsed) && parsed.length === DEFAULT_COL_WIDTHS.length) return parsed;
      }
    } catch {}
    return DEFAULT_COL_WIDTHS;
  });
  const [scrollTop, setScrollTop] = useState(0);

  const { visibleCols, toggle: toggleCol, reset: resetCols } = useColumnVisibility();
  const { colOrder, reorder, resetOrder } = useColumnOrder();
  const { sort, toggle: toggleSort, reset: resetSort } = useProjectSort(PROJECT_SORT_STORAGE_KEY, PROJECT_COL_KEYS);
  const visibleColIndices = colOrder.filter(i => visibleCols.has(i));
  const totalCols = visibleColIndices.length + 1;

  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const colWidthsRef = useRef<number[]>([...colWidths]);
  const colElRefs   = useRef<(HTMLTableColElement | null)[]>([]);
  const tableRef    = useRef<HTMLTableElement | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const scrollRef   = useRef<HTMLDivElement | null>(null);
  const resizing    = useRef<{ col: number; startX: number; startW: number } | null>(null);
  // 列を縮めると同じ列の見出し上でマウスを離すことになり、ブラウザは mousedown(ハンドル)と
  // mouseup(見出し)の共通祖先である th に click を送る。その click をソートとして扱わないための印。
  const justResized = useRef(false);
  const rafRef      = useRef<number | null>(null);

  const [assigning, setAssigning] = useState<Project | null>(null);

  const normalize = (s: string) =>
    s.toLowerCase().replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const codeQ = normalize(codeFilter ?? '');
  const clientQ = normalize(clientFilter ?? '');
  const projectNameQ = normalize(projectNameFilter ?? '');
  const filtered = (projects ?? []).filter(p => {
    if (codeQ && !normalize(p.ts_project_code ?? '').includes(codeQ)) return false;
    if (clientQ && !normalize(p.client_name ?? '').includes(clientQ)) return false;
    if (projectNameQ && !normalize(p.project_name).includes(projectNameQ)) return false;
    return true;
  });
  const sorted = sortProjects(filtered, sort);

  const containerH = typeof window !== 'undefined' ? window.innerHeight * 0.7 : 600;
  const visibleStart = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const visibleEnd   = Math.min(sorted.length - 1, Math.ceil((scrollTop + containerH) / ROW_H) + OVERSCAN);
  const topPad    = visibleStart * ROW_H;
  const bottomPad = Math.max(0, (sorted.length - 1 - visibleEnd) * ROW_H);

  // 並び順が変わると表示中の行の意味が変わるため、先頭までスクロールを戻す。
  const onHeaderClick = (col: number) => {
    if (justResized.current) {
      justResized.current = false;
      return;
    }
    toggleSort(PROJECT_COL_KEYS[col]);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setScrollTop(0);
  };

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const st = e.currentTarget.scrollTop;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setScrollTop(st);
    });
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizing.current) return;
      const { col, startX, startW } = resizing.current;
      colWidthsRef.current[col] = Math.max(48, startW + e.clientX - startX);
      if (indicatorRef.current) indicatorRef.current.style.left = `${e.clientX}px`;
    };
    const onUp = () => {
      if (resizing.current !== null) {
        const next = [...colWidthsRef.current];
        setColWidths(next);
        try { localStorage.setItem('projects:colWidths', JSON.stringify(next)); } catch {}
        // click は mouseup と同じ操作の中で続けて届く。列を広げた場合は th に click が来ないため、
        // 印が残って次の通常クリックを取りこぼさないよう次のタスクで必ず外す。
        justResized.current = true;
        setTimeout(() => { justResized.current = false; }, 0);
      }
      resizing.current = null;
      if (indicatorRef.current) indicatorRef.current.style.display = 'none';
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const startResize = (e: React.MouseEvent, col: number) => {
    e.preventDefault();
    resizing.current = { col, startX: e.clientX, startW: colWidthsRef.current[col] };
    if (indicatorRef.current) {
      indicatorRef.current.style.left = `${e.clientX}px`;
      indicatorRef.current.style.display = 'block';
    }
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const autoFitCol = (col: number) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const thEl = tableRef.current?.querySelector('th');
    ctx.font = thEl ? getComputedStyle(thEl).font : '14px sans-serif';
    const PAD = 24 + 8;
    // +6 はドラッグ用の余白、+14 はソート中に並ぶ ▲▼ の分
    let maxW = ctx.measureText(COL_LABELS[col]).width + PAD + 6 + 14;
    for (const p of filtered) {
      const w = ctx.measureText(getCellText(p, col)).width + PAD;
      if (w > maxW) maxW = w;
    }
    const newW = Math.ceil(maxW);
    colWidthsRef.current[col] = newW;
    const next = [...colWidthsRef.current];
    setColWidths(next);
    try { localStorage.setItem('projects:colWidths', JSON.stringify(next)); } catch {}
  };

  const tableW = visibleColIndices.reduce((a, i) => a + colWidths[i], 0) + ACTION_COL_W;

  return (
    <div className="h-full flex flex-col relative">
      <div
        ref={indicatorRef}
        className="fixed top-0 bottom-0 w-0.5 bg-[#0090B9] pointer-events-none z-50"
        style={{ display: 'none' }}
      />

      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">{toolbarExtra}</div>
        <button
          onClick={() => setShowColSettings(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-700 text-sm cursor-pointer"
        >
          <ColumnSettingsIcon size={14} />
          表示設定
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-auto rounded-lg border border-gray-200 bg-white relative"
        onScroll={onScroll}
      >
        <table
          ref={tableRef}
          className="text-sm table-fixed"
          style={{ width: tableW }}
        >
          <colgroup>
            <col style={{ width: ACTION_COL_W }} />
            {visibleColIndices.map(i => (
              <col
                key={i}
                ref={el => { colElRefs.current[i] = el; }}
                style={{ width: colWidths[i] }}
              />
            ))}
          </colgroup>

          <thead className="bg-gray-50 text-gray-500 sticky top-0 z-10 border-b-2 border-gray-200">
            <tr>
              <th className="px-3 py-3" />
              {visibleColIndices.map((i, displayIdx) => (
                <th
                  key={i}
                  draggable
                  onDragStart={() => setDragFrom(displayIdx)}
                  onDragOver={e => { e.preventDefault(); setDragOver(displayIdx); }}
                  onDrop={() => {
                    if (dragFrom !== null) reorder(dragFrom, displayIdx);
                    setDragFrom(null); setDragOver(null);
                  }}
                  onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
                  onClick={() => onHeaderClick(i)}
                  aria-sort={ariaSort(sort, PROJECT_COL_KEYS[i])}
                  className={`relative px-3 py-3 font-medium select-none overflow-visible cursor-grab active:cursor-grabbing hover:bg-gray-100 text-center ${dragOver === displayIdx && dragFrom !== displayIdx ? 'border-l-2 border-[#0090B9] bg-blue-50' : ''}`}
                >
                  <span className="flex items-center justify-center">
                    <span className="truncate">{COL_LABELS[i]}</span>
                    <SortIndicator sort={sort} sortKey={PROJECT_COL_KEYS[i]} />
                  </span>
                  {/* 幅変更・ダブルクリックでの自動調整がヘッダーのソートとして扱われないよう、クリックを th に伝えない */}
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`${COL_LABELS[i]}の列幅を変更`}
                    className="absolute -right-2 top-0 h-full w-4 cursor-col-resize flex items-center justify-center group z-10"
                    onMouseDown={e => startResize(e, i)}
                    onClick={e => e.stopPropagation()}
                    onDoubleClick={e => { e.preventDefault(); e.stopPropagation(); autoFitCol(i); }}
                  >
                    <div className="h-6 w-[11px] border-x-[3px] border-gray-800 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {!isLoading && (
              <>
                {topPad > 0 && (
                  <tr style={{ height: topPad }}>
                    <td colSpan={totalCols} />
                  </tr>
                )}

                {sorted.slice(visibleStart, visibleEnd + 1).map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" style={{ height: ROW_H }} onClick={() => onRowClick(p)}>
                    <td className="px-3 whitespace-nowrap">
                      <Button size="sm" variant="secondary" onClick={e => { e.stopPropagation(); setAssigning(p); }}>担当者</Button>
                    </td>
                    {visibleColIndices.map(i => renderCell(p, i))}
                  </tr>
                ))}

                {bottomPad > 0 && (
                  <tr style={{ height: bottomPad }}>
                    <td colSpan={totalCols} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ paddingTop: ROW_H }}>
            <Spinner inline />
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ paddingTop: ROW_H }}>
            <span className="text-gray-400 text-sm">該当する案件がありません</span>
          </div>
        )}
      </div>

      {showColSettings && (
        <ColumnSettingsModal
          visibleCols={visibleCols}
          onToggle={toggleCol}
          onReset={() => {
            resetCols();
            resetOrder();
            resetSort();
            colWidthsRef.current = [...DEFAULT_COL_WIDTHS];
            setColWidths([...DEFAULT_COL_WIDTHS]);
            try { localStorage.removeItem('projects:colWidths'); } catch {}
          }}
          onClose={() => setShowColSettings(false)}
        />
      )}

      {assigning && (
        <Modal title={`担当者アサイン — ${assigning.project_name}`} onClose={() => setAssigning(null)}>
          <UserAssignPanel project={assigning} onClose={() => setAssigning(null)} />
        </Modal>
      )}
    </div>
  );
}
