'use client';

import { useCreateUser, useSetUserActive, useUpdateUser, useUsers } from '@/features/user/model/useUsers';
import { useAuth } from '@/features/auth/model/auth-context';
import { UserForm } from '@/features/user/ui/UserForm';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { TableSkeleton } from '@/shared/ui/Skeleton';
import type { User } from '@/shared/types';
import { useState } from 'react';

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser();
  const setUserActive = useSetUserActive();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  // 無効化はログインとアクセスを即座に断つため確認を取る。有効化は元に戻すだけなので確認しない。
  const handleToggleActive = async (user: User) => {
    const isActive = user.is_active !== false;
    if (isActive && !confirm(`${user.name} を無効にします。ログインできなくなり、案件の担当者候補にも出なくなります。よろしいですか？`)) return;
    await setUserActive.mutateAsync({ id: user.id, isActive: !isActive });
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">ユーザー管理</h2>
        <Button onClick={() => setShowCreate(true)}>+ 新規ユーザー</Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3">氏名</th>
                <th className="px-4 py-3">メール</th>
                <th className="px-4 py-3">ロール</th>
                <th className="px-4 py-3 text-right">人日単価</th>
                <th className="px-4 py-3">社員コード</th>
                <th className="px-4 py-3">状態</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users?.map(user => (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                  <td className="px-4 py-3 text-gray-600">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700'
                      : user.role === 'director' ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700'
                    }`}>
                      {user.role === 'admin' ? '管理者' : user.role === 'director' ? 'ディレクター' : 'メンバー'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    ¥{Number(user.day_cost).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{user.employee_code ?? '—'}</td>
                  <td className="px-4 py-3">
                    {user.is_active !== false ? (
                      <span className="text-xs text-green-600">有効</span>
                    ) : (
                      <span className="text-xs text-gray-400">
                        無効
                        {/* 退職日として使えるよう、無効化した日付を併記する。 */}
                        {user.deactivated_at && `（${user.deactivated_at.slice(0, 10)}〜）`}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(user)}>編集</Button>
                      {/* 自分自身を無効にすると自力で戻せなくなるため、その行にはボタンを出さない。 */}
                      {currentUser?.id !== user.id && (
                        <Button
                          size="sm"
                          variant={user.is_active === false ? 'secondary' : 'danger'}
                          onClick={() => handleToggleActive(user)}
                        >
                          {user.is_active === false ? '有効化' : '無効化'}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <Modal title="新規ユーザー作成" onClose={() => setShowCreate(false)}>
          <UserForm
            onSubmit={async (data) => {
              await createUser.mutateAsync(data as Parameters<typeof createUser.mutateAsync>[0]);
              setShowCreate(false);
            }}
            onCancel={() => setShowCreate(false)}
          />
        </Modal>
      )}

      {editing && (
        <EditUserModal user={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function EditUserModal({ user, onClose }: { user: User; onClose: () => void }) {
  const updateUser = useUpdateUser(user.id);

  return (
    <Modal title="ユーザー編集" onClose={onClose}>
      <UserForm
        initialData={user}
        onSubmit={async (data) => {
          await updateUser.mutateAsync(data);
          onClose();
        }}
        onCancel={onClose}
      />
    </Modal>
  );
}
