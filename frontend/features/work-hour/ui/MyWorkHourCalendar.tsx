'use client';

import { useMyProjects } from '@/features/project/model/useProjects';
import apiClient from '@/shared/api/client';
import { isHoliday } from '@/shared/lib/holidays';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import type { Project, WorkHour } from '@/shared/types';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

interface DayEntry extends WorkHour {
  project_name: string;
}

interface FormState {
  date: string;
  projectId: number;
}

function formatYM(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonth(month: string): string {
  const [y, m] = month.split('-');
  return `${y}年${m}月`;
}

function formatHours(hours: number): string {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

//const MINUTE_OPTIONS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const MINUTE_OPTIONS = [0, 15, 30, 45]; // 編集時に15分刻みでないとエラーが出るため
const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

function getDaysInMonth(month: string): Date[] {
  const [year, mon] = month.split('-').map(Number);
  const days: Date[] = [];
  const last = new Date(year, mon, 0).getDate();
  for (let d = 1; d <= last; d++) {
    days.push(new Date(year, mon - 1, d));
  }
  return days;
}

function toDateStr(day: Date): string {
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}

function isProjectActiveInMonth(p: Project, month: string): boolean {
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`;
  const start = p.start_month?.slice(0, 10);
  const end = p.end_month?.slice(0, 10);
  if (start && start > monthEnd) return false;
  if (end && end < monthStart) return false;
  return true;
}

export function MyWorkHourCalendar() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => formatYM(new Date()));
  const { data: projects = [] } = useMyProjects();

  const workHourQueries = useQueries({
    queries: projects.map(p => ({
      queryKey: ['work-hours', p.id, month],
      queryFn: async () => {
        const { data } = await apiClient.get<WorkHour[]>(`/projects/${p.id}/work-hours`, {
          params: { month },
        });
        return data;
      },
    })),
  });

  const entries: DayEntry[] = [];
  projects.forEach((p, i) => {
    const data = workHourQueries[i]?.data ?? [];
    data.forEach(wh => entries.push({ ...wh, project_name: p.project_name }));
  });

  const eligibleProjects = projects.filter(p => isProjectActiveInMonth(p, month));

  const [formState, setFormState] = useState<FormState | null>(null);
  const [hoursInt, setHoursInt] = useState(0);
  const [minutesInt, setMinutesInt] = useState(0);
  const [memo, setMemo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentMonth = formatYM(today);
  const isFutureMonth = month > currentMonth;

  const prevMonth = () => {
    const [y, m] = month.split('-').map(Number);
    setMonth(formatYM(new Date(y, m - 2)));
  };

  const nextMonth = () => {
    const [y, m] = month.split('-').map(Number);
    const next = new Date(y, m);
    if (next <= today) setMonth(formatYM(next));
  };

  const findExisting = (date: string, projectId: number) =>
    entries.find(e => e.work_date === date && e.project_id === projectId);

  const loadFields = (date: string, projectId: number) => {
    const existing = findExisting(date, projectId);
    const totalMin = Math.round((existing?.hours ?? 0) * 60);
    setHoursInt(Math.floor(totalMin / 60));
    setMinutesInt(totalMin % 60);
    setMemo(existing?.memo ?? '');
  };

  const openForm = (date: string, projectId: number) => {
    setFormState({ date, projectId });
    setError(null);
    loadFields(date, projectId);
  };

  const openDayForm = (date: string) => {
    const usedProjectIds = new Set(entries.filter(e => e.work_date === date).map(e => e.project_id));
    const defaultProject = eligibleProjects.find(p => !usedProjectIds.has(p.id)) ?? eligibleProjects[0];
    if (!defaultProject) return;
    openForm(date, defaultProject.id);
  };

  const handleProjectChange = (projectId: number) => {
    if (!formState) return;
    setFormState({ ...formState, projectId });
    loadFields(formState.date, projectId);
  };

  const closeForm = () => { setFormState(null); setError(null); };

  const handleSave = async () => {
    if (!formState) return;
    setIsLoading(true);
    setError(null);
    try {
      const h = hoursInt + minutesInt / 60;
      const existing = findExisting(formState.date, formState.projectId);
      if (existing) {
        await apiClient.put(`/projects/${formState.projectId}/work-hours/${existing.id}`, {
          hours: h,
          memo: memo || undefined,
        });
      } else {
        await apiClient.post(`/projects/${formState.projectId}/work-hours`, {
          work_date: formState.date,
          hours: h,
          memo: memo || undefined,
        });
      }
      await qc.invalidateQueries({ queryKey: ['work-hours', formState.projectId, month] });
      closeForm();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const msg = axiosErr?.response?.data?.errors
        ? Object.values(axiosErr.response.data.errors).flat().join(' / ')
        : (axiosErr?.response?.data?.message ?? '保存に失敗しました。');
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!formState) return;
    const existing = findExisting(formState.date, formState.projectId);
    if (!existing) return;
    if (!confirm('この工数を削除してもよいですか？')) return;
    setIsLoading(true);
    try {
      await apiClient.delete(`/projects/${formState.projectId}/work-hours/${existing.id}`);
      await qc.invalidateQueries({ queryKey: ['work-hours', formState.projectId, month] });
      closeForm();
    } finally {
      setIsLoading(false);
    }
  };

  const days = getDaysInMonth(month);
  const firstDayOfWeek = days[0].getDay();
  const blanks = Array.from({ length: firstDayOfWeek });
  const totalHours = entries.reduce((sum, e) => sum + Number(e.hours), 0);
  const existingForForm = formState ? findExisting(formState.date, formState.projectId) : undefined;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={prevMonth}>◀ 前月</Button>
        <span className="font-medium text-gray-900 min-w-[80px] text-center">{month}</span>
        <Button variant="secondary" size="sm" onClick={nextMonth} disabled={month >= currentMonth}>翌月 ▶</Button>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium text-gray-900">{formatMonth(month)}</h3>
          <span className="text-sm text-gray-600">合計: {formatHours(totalHours)}</span>
        </div>

        {isFutureMonth && (
          <div className="mb-3 rounded bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
            翌月以降は工数を入力できません。
          </div>
        )}

        <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
          {DAY_LABELS.map((d, i) => (
            <div key={d} className={`bg-gray-50 px-2 py-1 text-center text-xs font-medium ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
              {d}
            </div>
          ))}
          {blanks.map((_, i) => <div key={`b${i}`} className="bg-white min-h-[60px]" />)}
          {days.map(day => {
            const dateStr = toDateStr(day);
            const dayEntries = entries.filter(e => e.work_date === dateStr);
            const isPast = day <= today;
            const isToday = day.toDateString() === today.toDateString();
            const dow = day.getDay();
            const isSelectable = !isFutureMonth && isPast && eligibleProjects.length > 0;
            const dayTotal = dayEntries.reduce((sum, e) => sum + Number(e.hours), 0);

            return (
              <div
                key={dateStr}
                className={`bg-white min-h-[60px] p-1 flex flex-col ${isToday ? 'ring-2 ring-inset ring-blue-300' : ''}`}
              >
                <button
                  onClick={() => isSelectable && openDayForm(dateStr)}
                  disabled={!isSelectable}
                  className={`w-full text-left px-1 py-0.5 rounded transition-colors
                    ${isSelectable ? 'hover:bg-blue-50 cursor-pointer' : 'cursor-default opacity-50'}
                  `}
                >
                  <span className={`text-xs ${dow === 0 || isHoliday(day) ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-700'} ${isToday ? 'font-bold' : ''}`}>
                    {day.getDate()}
                  </span>
                </button>

                {dayEntries.map(e => (
                  <button
                    key={e.id}
                    onClick={() => openForm(e.work_date, e.project_id)}
                    title={e.project_name}
                    className="mt-1 flex w-full items-center gap-1 rounded bg-blue-100 px-1 py-0.5 text-left text-xs font-medium text-blue-700 hover:bg-blue-200 cursor-pointer"
                  >
                    <span className="min-w-0 flex-1 truncate">{e.project_name.slice(0, 15)}</span>
                    <span className="shrink-0">{formatHours(Number(e.hours))}</span>
                  </button>
                ))}

                {dayEntries.length > 0 && (
                  <div className="mt-auto pt-1 text-right text-[10px] text-gray-500">
                    {formatHours(dayTotal)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {formState && (
        <Modal title={`工数入力 — ${formState.date}`} onClose={closeForm}>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">案件</label>
              <select
                value={formState.projectId}
                onChange={e => handleProjectChange(Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0090B9]"
              >
                {eligibleProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.project_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">工数</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={hoursInt}
                  onChange={e => setHoursInt(Math.max(0, Math.min(24, parseInt(e.target.value, 10) || 0)))}
                  min="0"
                  max="24"
                  className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0090B9]"
                />
                <span className="text-sm text-gray-600">時間</span>
                <select
                  value={minutesInt}
                  onChange={e => setMinutesInt(Number(e.target.value))}
                  className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0090B9]"
                >
                  {MINUTE_OPTIONS.map(m => (
                    <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                  ))}
                </select>
                <span className="text-sm text-gray-600">分</span>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">メモ（任意）</label>
              <input
                value={memo}
                onChange={e => setMemo(e.target.value)}
                maxLength={255}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0090B9]"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <div className="flex justify-between gap-3 pt-2">
              <div>
                {existingForForm && (
                  <Button variant="danger" onClick={handleDelete} disabled={isLoading}>削除</Button>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={closeForm}>キャンセル</Button>
                <Button onClick={handleSave} disabled={isLoading || (hoursInt === 0 && minutesInt === 0)}>
                  {isLoading ? '保存中...' : '保存'}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
