'use client';

import { useSyncProjectUsers } from '@/features/project/model/useProjects';
import { useUsers } from '@/features/user/model/useUsers';
import { Button } from '@/shared/ui/Button';
import { useModalClose } from '@/shared/ui/Modal';
import { formatUserName, isInactiveUser } from '@/shared/lib/userLabel';
import type { Project } from '@/shared/types';
import { useState } from 'react';

interface UserAssignPanelProps {
  project: Project;
  onClose: () => void;
}

export function UserAssignPanel({ project, onClose }: UserAssignPanelProps) {
  const modalClose = useModalClose();
  const { data: allUsers } = useUsers();
  const syncUsers = useSyncProjectUsers(project.id);
  const [selected, setSelected] = useState<Set<number>>(
    new Set((project.users ?? []).map(u => u.id))
  );
  const [isLoading, setIsLoading] = useState(false);

  // 無効化(退職等)されたメンバーは新規アサインの候補には出さないが、既にアサイン済みの場合は
  // 過去の工数実績を辿る手掛かりなので外せない形で見せる(保存時も selected に残したまま送る)。
  const assignedInactive = (project.users ?? []).filter(isInactiveUser);

  const toggle = (id: number) => {
    setSelected(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await syncUsers.mutateAsync([...selected]);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">担当者を選択してください。</p>
      <div className="max-h-64 overflow-y-auto space-y-2 rounded border border-gray-200 p-3">
        {allUsers?.filter(u => u.is_active !== false).map(user => (
          <label key={user.id} className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.has(user.id)}
              onChange={() => toggle(user.id)}
              className="h-4 w-4 rounded border-gray-300 accent-[#0090B9]"
            />
            <span className="text-sm text-gray-900">{user.name}</span>
            <span className="text-xs text-gray-400">{user.email}</span>
          </label>
        ))}
      </div>

      {assignedInactive.length > 0 && (
        <div>
          <p className="mb-2 text-xs text-gray-500">
            アサイン済み（無効）— 過去の工数実績を残すため解除できません。
          </p>
          <div className="space-y-2 rounded border border-gray-200 bg-gray-50 p-3">
            {assignedInactive.map(user => (
              <div key={user.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked
                  disabled
                  readOnly
                  aria-label={formatUserName(user)}
                  className="h-4 w-4 rounded border-gray-300 accent-[#0090B9]"
                />
                <span className="text-sm text-gray-500">{formatUserName(user)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={modalClose}>キャンセル</Button>
        <Button onClick={handleSave} disabled={isLoading}>{isLoading ? '保存中...' : '保存'}</Button>
      </div>
    </div>
  );
}
