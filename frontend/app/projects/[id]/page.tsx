'use client';

import { useAuth } from '@/features/auth/model/auth-context';
import { WorkHourCalendar } from '@/features/work-hour/ui/WorkHourCalendar';
import { ProjectMonthlyBreakdown } from '@/features/project/ui/ProjectMonthlyBreakdown';
import { Header } from '@/widgets/header/ui/Header';
import { Button } from '@/shared/ui/Button';
import apiClient from '@/shared/api/client';
import type { Project } from '@/shared/types';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

function formatYM(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [month, setMonth] = useState(() => formatYM(new Date()));

  useEffect(() => {
    if (!authLoading && !user) router.replace('/signin');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    apiClient.get<Project>(`/projects/${id}`).then(r => setProject(r.data)).catch(() => router.replace('/dashboard'));
  }, [id, user, router]);

  const prevMonth = () => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 2);
    setMonth(formatYM(d));
  };

  const nextMonth = () => {
    const [y, m] = month.split('-').map(Number);
    const now = new Date();
    const next = new Date(y, m);
    if (next <= now) setMonth(formatYM(next));
  };

  const currentMonth = formatYM(new Date());

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className={`p-6 ${user.role === 'director' ? '' : 'max-w-4xl mx-auto'}`}>
        <div className="mb-4">
          <Link href="/dashboard" className="text-sm text-[#0090B9] hover:underline">← ダッシュボード</Link>
        </div>

        {project && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">{project.project_name}</h2>
            {project.client_name && <p className="text-sm text-gray-500 mt-1">{project.client_name}</p>}
          </div>
        )}

        {project && user.role === 'director' ? (
          <ProjectMonthlyBreakdown projectId={project.id} />
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-3">
              <Button variant="secondary" size="sm" onClick={prevMonth}>◀ 前月</Button>
              <span className="font-medium text-gray-900 min-w-[80px] text-center">{month}</span>
              <Button variant="secondary" size="sm" onClick={nextMonth} disabled={month >= currentMonth}>翌月 ▶</Button>
            </div>

            {project && (
              <WorkHourCalendar
                projectId={project.id}
                month={month}
                startMonth={project.start_month}
                endMonth={project.end_month}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
