import { ArrowRight, BookOpen, Code2, Lock } from 'lucide-react';

import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import { SoonBadge } from '@/pages/shared/row-actions';
import { courseLevelLabel } from '@/pages/community-space/courses/course-labels';
import { useGetCommunityCoursesQuery } from '@/utils/api/community/community.api';
import type { Course } from '@/utils/api/course/course.type';
import type { CommunityPage } from '../form/UseCommunityPage';
import { LockedPanel } from './locked-panel';
import { SectionHeader } from './section-header';

function CourseCard({ course, open }: { course: Course; open: boolean }) {
  const progress = Math.round(course.user_progress_percent ?? 0);
  const started = progress > 0;
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="relative aspect-[16/9]">
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <>
            <GlassBackdrop fade={false} />
            <Code2 className="absolute top-1/2 left-1/2 size-9 -translate-x-1/2 -translate-y-1/2 text-blue-900" aria-hidden />
          </>
        )}
        <span className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-md bg-white/90 px-2.5 py-1 text-xs text-slate-700 shadow-2xs">
          <BookOpen className="size-3.5" /> {course.lessons_count} leçon{course.lessons_count > 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-600 uppercase">{courseLevelLabel[course.level]}</p>
        <h3 className="mt-3 text-xl font-semibold text-slate-900">{course.title}</h3>
        {course.description && <p className="mt-4 line-clamp-3 text-sm text-slate-600">{course.description}</p>}

        <div className="mt-auto pt-6">
          {open ? (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">{started ? 'Votre progression' : 'À découvrir'}</span>
                <span className="font-semibold text-blue-900 tabular-nums">{progress} %</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-blue-50" aria-hidden>
                <div className="h-full rounded-full bg-blue-900" style={{ width: `${progress}%` }} />
              </div>
              {/* No course player for the members yet */}
              <button type="button" disabled title="Bientôt disponible" className="mt-5 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg py-3 text-sm text-slate-500">
                {started ? 'Continuer' : 'Découvrir le parcours'} <ArrowRight className="size-4" /> <SoonBadge />
              </button>
            </>
          ) : (
            <p className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
              <Lock className="size-4" /> Réservé aux membres
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

/** Published courses (GET communities/<slug>/courses/, signed-in users): open to the members */
export function ClassroomTab({ page }: { page: CommunityPage }) {
  const community = page.community;
  const signedIn = page.membership !== 'visitor';
  const { data, isLoading, error } = useGetCommunityCoursesQuery({ slug: page.slug, is_published: true, page_size: 50 }, { skip: !signedIn });
  const courses = data?.results ?? [];
  const count = data?.pagination.count ?? community?.courses_count ?? 0;

  const header = (
    <SectionHeader
      eyebrow="Apprendre à votre rythme"
      title="Formations"
      aside={
        <span className="flex items-center gap-2 text-sm text-slate-600">
          <BookOpen className="size-4" /> {count} parcours
        </span>
      }
    >
      Un nouveau savoir. Un projet concret. Une étape à la fois.
    </SectionHeader>
  );

  if (!signedIn || error) {
    return (
      <section>
        {header}
        <LockedPanel page={page}>
          {count > 0 ? `${count} formation${count > 1 ? 's' : ''} vous attend${count > 1 ? 'ent' : ''} dans cette communauté.` : 'Les formations de la communauté seront ici.'}
        </LockedPanel>
      </section>
    );
  }

  return (
    <section>
      {header}
      {isLoading ? (
        <p className="py-12 text-center text-sm text-slate-500">Chargement des formations…</p>
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <BookOpen className="size-8 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-900">Pas encore de formation</p>
          <p className="mt-1 text-sm text-slate-500">L'équipe de la communauté prépare ses premiers cours.</p>
        </div>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2" aria-label="Formations">
          {courses.map((course) => (
            <li key={course.id}>
              <CourseCard course={course} open={page.membership === 'member'} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
