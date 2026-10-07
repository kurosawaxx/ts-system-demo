'use client';

import { Button } from '@/shared/ui/Button';
import { useModalClose } from '@/shared/ui/Modal';
import type { User } from '@/shared/types';
import { useState } from 'react';

interface UserFormProps {
  initialData?: User;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

export function UserForm({ initialData, onSubmit, onCancel }: UserFormProps) {
  const modalClose = useModalClose();
  const [name, setName] = useState(initialData?.name ?? '');
  const [email, setEmail] = useState(initialData?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user' | 'director'>(initialData?.role ?? 'user');
  const [dayCost, setDayCost] = useState(String(initialData?.day_cost ?? ''));
  const [employeeCode, setEmployeeCode] = useState(initialData?.employee_code ?? '');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const payload: Record<string, unknown> = { name, email, role, day_cost: Number(dayCost) };
      if (employeeCode) payload.employee_code = employeeCode;
      if (password) payload.password = password;
      if (!initialData) payload.password = password || undefined;
      await onSubmit(payload);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? '保存に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const field = 'block text-sm font-medium text-gray-700 mb-1';
  const input = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0090B9]';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="rounded bg-red-50 p-3 text-sm text-red-600">{error}</div>}
      <div>
        <label className={field}>氏名</label>
        <input className={input} value={name} onChange={e => setName(e.target.value)} required />
      </div>
      <div>
        <label className={field}>メールアドレス</label>
        <input type="email" className={input} value={email} onChange={e => setEmail(e.target.value)} required />
      </div>
      <div>
        <label className={field}>パスワード{initialData && '（変更する場合のみ）'}</label>
        <input type="password" className={input} value={password} onChange={e => setPassword(e.target.value)} required={!initialData} minLength={8} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={field}>ロール</label>
          <select className={input} value={role} onChange={e => setRole(e.target.value as 'admin' | 'user' | 'director')}>
            <option value="user">メンバー</option>
            <option value="director">ディレクター</option>
            <option value="admin">管理者</option>
          </select>
        </div>
        <div>
          <label className={field}>人日単価（円/日）{role !== 'user' && '（任意）'}</label>
          <input type="number" className={input} value={dayCost} onChange={e => setDayCost(e.target.value)} required={role === 'user'} min="0" />
        </div>
      </div>
      <div>
        <label className={field}>社員コード（任意）</label>
        <input className={input} value={employeeCode} onChange={e => setEmployeeCode(e.target.value)} maxLength={20} />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={modalClose}>キャンセル</Button>
        <Button type="submit" disabled={isLoading}>{isLoading ? '保存中...' : '保存'}</Button>
      </div>
    </form>
  );
}
