'use client';

import { useCreateWorkHour, useDeleteWorkHour, useUpdateWorkHour, useWorkHours } from '@/features/work-hour/model/useWorkHours';
import { isHoliday } from '@/shared/lib/holidays';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import type { WorkHour } from '@/shared/types';
import { useState } from 'react';

interface WorkHourCalendarProps {
  projectId: number;
  month: string;
  startMonth?: string | null;
  endMonth?: string | null;
}

interface WorkHourFormState {
  date: string;
  existing?: WorkHour;
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

function getDaysInMonth(month: string): Date[] {
  const [year, mon] = month.split('-').map(Number);
  const days: Date[] = [];
  const last = new Date(year, mon, 0).getDate();
  for (let d = 1; d <= last; d++) {
    days.push(new Date(year, mon - 1, d));
  }
  return days;
}

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

export function WorkHourCalendar({ projectId, month, startMonth, endMonth }: WorkHourCalendarProps) {
  const { data: workHours = [] } = useWorkHours(projectId, month);
  const createWH = useCreateWorkHour(projectId, month);
  const updateWH = useUpdateWorkHour(projectId, month);
  const deleteWH = useDeleteWorkHour(projectId, month);

  const [formState, setFormState] = useState<WorkHourFormState | null>(null);
  const [hoursInt, setHoursInt] = useState(0);
  const [minutesInt, setMinutesInt] = useState(0);
  const [memo, setMemo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const isFutureMonth = month > currentMonth;
  const startDateStr = startMonth ? startMonth.slice(0, 10) : null;
  const endDateStr = endMonth ? endMonth.slice(0, 10) : null;

  const workHourByDate = new Map(workHours.map(wh => [wh.work_date, wh]));
  const days = getDaysInMonth(month);

  const firstDayOfWeek = days[0].getDay();
  const blanks = Array.from({ length: firstDayOfWeek });

  const openForm = (date: string) => {
    const existing = workHourByDate.get(date);
    setFormState({ date, existing });
    const totalMin = Math.round((existing?.hours ?? 0) * 60);
    setHoursInt(Math.floor(totalMin / 60));
    setMinutesInt(totalMin % 60);
    setMemo(existing?.memo ?? '');
  };

  const closeForm = () => { setFormState(null); setError(null); };

  const handleSave = async () => {
    if (!formState) return;
    setIsLoading(true);
    setError(null);
    try {
      const h = hoursInt + minutesInt / 60;
      if (formState.existing) {
        await updateWH.mutateAsync({ id: formState.existing.id, hours: h, memo: memo || undefined });
      } else {
        await createWH.mutateAsync({ work_date: formState.date, hours: h, memo: memo || undefined });
      }
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
    if (!formState?.existing) return;
    if (!confirm('この工数を削除してもよいですか？')) return;
    setIsLoading(true);
    try {
      await deleteWH.mutateAsync(formState.existing.id);
      closeForm();
    } finally {
      setIsLoading(false);
    }
  };

  const totalHours = workHours.reduce((sum, wh) => sum + Number(wh.hours), 0);

  return (
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
          const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
          const wh = workHourByDate.get(dateStr);
          const isPast = day <= today;
          const isToday = day.toDateString() === today.toDateString();
          const dow = day.getDay();
          const outOfProjectPeriod =
            (startDateStr !== null && dateStr < startDateStr) ||
            (endDateStr !== null && dateStr > endDateStr);
          const isSelectable = !isFutureMonth && isPast && !outOfProjectPeriod;

          return (
            <button
              key={dateStr}
              onClick={() => isSelectable && openForm(dateStr)}
              disabled={!isSelectable}
              className={`bg-white min-h-[60px] p-2 text-left transition-colors
                ${isSelectable ? 'hover:bg-blue-50 cursor-pointer' : 'cursor-default opacity-50'}
                ${isToday ? 'ring-2 ring-inset ring-blue-300' : ''}
              `}
            >
              <span className={`text-xs ${dow === 0 || isHoliday(day) ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-700'} ${isToday ? 'font-bold' : ''}`}>
                {day.getDate()}
              </span>
              {wh && (
                <div className="mt-1 rounded bg-blue-100 px-1 py-0.5 text-xs text-blue-700 font-medium">
                  {formatHours(Number(wh.hours))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {formState && (
        <Modal
          title={`工数入力 — ${formState.date}`}
          onClose={closeForm}
        >
          <div className="space-y-4">
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
                {formState.existing && (
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
