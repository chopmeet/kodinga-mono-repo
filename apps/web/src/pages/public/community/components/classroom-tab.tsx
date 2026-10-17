import { BookOpen, Clock, Lock, PlayCircle } from 'lucide-react';

import { cn } from '@kodinga-mono-repo/ui';
import { courseLevelLabel, formatDuration } from '@/pages/community-space/courses/course-labels';
import { useGetCommunityCoursesQuery } from '@/utils/api/community/community.api';
import type { CommunityPage } from '../form/UseCommunityPage';
import { LockedPanel } from './locked-panel';

/** Published courses (GET communities/<slug>/courses/, signed-in users): open to the members */
export function ClassroomTab({ page }: { page: CommunityPage }) {
  const community = page.community;
  const signedIn = page.membership !== 'visitor';
  const { data, isLoading, error } = useGetCommunityCoursesQuery({ slug: page.slug, is_published: true, page_size: 50 }, { skip: !signedIn });
  const courses = data?.results ?? [];
  const count = community?.courses_count ?? 0;

  if (!signedIn || error) {
    return (
      <LockedPanel page={page}>
        {count > 0 ? `${count} formation${count > 1 ? 's' : ''} vous attend${count > 1 ? 'ent' : ''} dans cette communauté.` : 'Les formations de la communauté seront ici.'}
      </LockedPanel>
    );
  }
  if (isLoading) return <p className="py-12 text-center text-sm text-slate-500">Chargement des formations…</p>;
  if (courses.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
        <BookOpen className="size-8 text-slate-300" />
        <p className="mt-3 font-semibold text-slate-900">Pas encore de formation</p>
        <p className="mt-1 text-sm text-slate-500">L'équipe de la communauté prépare ses premiers cours.</p>
      </div>
    );
  }

  const open = page.membership === 'member';
  return (
    <ul className="grid gap-4 sm:grid-cols-2" aria-label="Formations">
      {courses.map((course) => (
        <li key={course.id}>
          <article className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div
              className={cn('relative flex h-28 items-center justify-center', !open && 'grayscale-[35%]')}
              style={{ backgroundColor: community?.brand_color || '#1D4ED8' }}
            >
              {course.thumbnail_url && <img src={course.thumbnail_url} alt="" className="absolute inset-0 size-full object-cover" />}
              <span className="absolute top-3 left-3 rounded bg-black/40 px-2 py-0.5 font-mono text-[10px] font-bold text-white uppercase">
                {courseLevelLabel[course.level]}
              </span>
              {open ? <PlayCircle className="relative size-10 text-white/90" /> : <Lock className="relative size-8 text-white/80" />}
            </div>
            <div className="flex flex-1 flex-col p-4">
              <h3 className="font-bold text-slate-900">{course.title}</h3>
              {course.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{course.description}</p>}
              <p className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                <span>
                  {course.lessons_count} leçon{course.lessons_count > 1 ? 's' : ''}
                </span>
                {course.duration_seconds > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" /> {formatDuration(course.duration_seconds)}
                  </span>
                )}
              </p>
              <p className={cn('mt-auto pt-3 text-xs font-semibold', open ? 'text-emerald-700' : 'text-slate-400')}>
                {open ? 'Accessible' : 'Réservé aux membres'}
              </p>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
