'use client';

import { useAuth } from '@/features/auth/model/auth-context';
import { Header } from '@/widgets/header/ui/Header';
import { Spinner } from '@/shared/ui/Spinner';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace('/signin');
    else if (user.role !== 'admin') router.replace('/dashboard');
  }, [user, isLoading, router]);

  if (isLoading) return <Spinner />;

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 min-h-0 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
