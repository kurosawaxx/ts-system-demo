'use client';

import { useAuth } from '@/features/auth/model/auth-context';
import { Button } from '@/shared/ui/Button';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Header() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const isAdmin = user?.role === 'admin';

  return (
    <header className="bg-[#4a92d7] shadow-md">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="font-bold text-white tracking-wide">工数管理システム</span>
          <nav className="flex gap-4 text-sm">
            <Link
              href="/dashboard"
              className={`${pathname.startsWith('/dashboard') ? 'text-white font-semibold underline underline-offset-4' : 'text-blue-100 hover:text-white'} transition-colors`}
            >
              ダッシュボード
            </Link>
            {isAdmin && (
              <>
                <Link
                  href="/admin/projects"
                  className={`${pathname.startsWith('/admin/projects') ? 'text-white font-semibold underline underline-offset-4' : 'text-blue-100 hover:text-white'} transition-colors`}
                >
                  案件管理
                </Link>
                <Link
                  href="/admin/users"
                  className={`${pathname.startsWith('/admin/users') ? 'text-white font-semibold underline underline-offset-4' : 'text-blue-100 hover:text-white'} transition-colors`}
                >
                  ユーザー管理
                </Link>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-blue-100">{user?.name}</span>
          <Button variant="secondary" size="sm" onClick={logout}>
            ログアウト
          </Button>
        </div>
      </div>
    </header>
  );
}
