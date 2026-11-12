import { ArrowRight, BookOpen, Code2, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import { courseLevelLabel } from '@/pages/community-space/courses/course-labels';
import { useGetCommunityCoursesQuery } from '@/utils/api/community/community.api';
import type { Course } from '@/utils/api/course/course.type';
import type { CommunityPage } from '../form/UseCommunityPage';
import { LockedPanel } from './locked-panel';
import { SectionHeader } from './section-header';

function CourseCard({ course, open, slug }: { course: Course; open: boolean; slug: string }) {
  const { t } = useTranslation();
  const progress = Math.round(course.user_progress_percent ?? 0);
  const started = progress > 0;
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative aspect-[16/9]">
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <>
            <GlassBackdrop fade={false} />
            <Code2 className="absolute top-1/2 left-1/2 size-9 -translate-x-1/2 -translate-y-1/2 text-brand-strong" aria-hidden />
          </>
        )}
        <span className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-md bg-card/90 px-2.5 py-1 text-xs text-body shadow-2xs">
          <BookOpen className="size-3.5" /> {t('community.classroom.lessons', { count: course.lessons_count })}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-soft uppercase">{courseLevelLabel[course.level]}</p>
        <h3 className="mt-3 text-xl font-semibold text-foreground">{course.title}</h3>
        {course.description && <p className="mt-4 line-clamp-3 text-sm text-soft">{course.description}</p>}

        <div className="mt-auto pt-6">
          {open ? (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-soft">{started ? t('community.classroom.yourProgress') : t('community.classroom.toDiscover')}</span>
                <span className="font-semibold text-brand-strong tabular-nums">{progress} %</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-brand-subtle" aria-hidden>
                <div className="h-full rounded-full bg-blue-900" style={{ width: `${progress}%` }} />
              </div>
              <Link
                to={`/communities/${slug}/courses/${course.slug}`}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-subtle py-3 text-sm font-medium text-foreground transition-colors hover:bg-brand-subtle hover:text-brand-strong"
              >
                {progress >= 100 ? t('community.classroom.review') : started ? t('community.classroom.continue') : t('community.classroom.discover')} <ArrowRight className="size-4" />
              </Link>
            </>
          ) : (
            <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Lock className="size-4" /> {t('community.classroom.membersOnly')}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

/** Published courses (GET communities/<slug>/courses/, signed-in users): open to the members */
export function ClassroomTab({ page }: { page: CommunityPage }) {
  const { t } = useTranslation();
  const community = page.community;
  const signedIn = page.membership !== 'visitor';
  const { data, isLoading, error } = useGetCommunityCoursesQuery({ slug: page.slug, is_published: true, page_size: 50 }, { skip: !signedIn });
  const courses = data?.results ?? [];
  const count = data?.pagination.count ?? community?.courses_count ?? 0;

  const header = (
    <SectionHeader
      eyebrow={t('community.classroom.eyebrow')}
      title={t('community.classroom.title')}
      aside={
        <span className="flex items-center gap-2 text-sm text-soft">
          <BookOpen className="size-4" /> {t('community.classroom.paths', { count })}
        </span>
      }
    >
      {t('community.classroom.intro')}
    </SectionHeader>
  );

  if (!signedIn || error) {
    return (
      <section>
        {header}
        <LockedPanel page={page}>
          {count > 0 ? t('community.classroom.waiting', { count }) : t('community.classroom.willBeHere')}
        </LockedPanel>
      </section>
    );
  }

  return (
    <section>
      {header}
      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t('community.classroom.loading')}</p>
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-12 text-center">
          <BookOpen className="size-8 text-slate-300" />
          <p className="mt-3 font-semibold text-foreground">{t('community.classroom.none')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('community.classroom.preparing')}</p>
        </div>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2" aria-label={t('community.classroom.title')}>
          {courses.map((course) => (
            <li key={course.id}>
              <CourseCard course={course} open={page.membership === 'member'} slug={page.slug} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
