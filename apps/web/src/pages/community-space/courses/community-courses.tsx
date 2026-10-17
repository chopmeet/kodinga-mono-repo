import { BookOpen, GraduationCap, Plus, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Badge, Button, ColgateWrapper, EmptyAlert, Pagination, TopTitle } from '@kodinga-mono-repo/ui';
import { FilterChip } from '@/pages/shared/filter-chip';
import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import { RowActions } from '@/pages/shared/row-actions';
import { useGetCommunityCoursesQuery } from '@/utils/api/community/community.api';
import type { Course } from '@/utils/api/course/course.type';
import { parseApiError } from '@/utils/api/errors';
import { useCommunitySpace } from '../community-space-context';
import { courseLevelLabel, formatDuration } from './course-labels';
import UseCourseActions from './form/UseCourseActions';
import CourseModal from './modals/course-modal';

const FILTERS = [
  { id: 'all', label: 'Toutes', published: undefined },
  { id: 'published', label: 'Publiées', published: true },
  { id: 'draft', label: 'Brouillons', published: false },
] as const;

/** /c/:slug/courses — the courses of the community */
function CommunityCourses() {
  const { community } = useCommunitySpace();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(12);
  const [editing, setEditing] = useState<Course | 'new' | null>(null);
  const { canManage, actionsFor, confirmDialog } = UseCourseActions({ onEdit: setEditing });
  const { data, isLoading, isFetching, error, refetch } = useGetCommunityCoursesQuery({
    slug: community.slug,
    is_published: FILTERS.find((f) => f.id === filter)?.published,
    page,
    page_size: size,
  });
  const courses = data?.results ?? [];
  const total = data?.pagination.count ?? 0;

  return (
    <div className="community__courses">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <TopTitle title="Formations" paragraph={`Les cours de ${community.name}`} />
        {canManage && (
          <Button onClick={() => setEditing('new')}>
            <Plus />
            Nouvelle formation
          </Button>
        )}
      </div>

      <ColgateWrapper className="border border-neutral-200 p-4">
        <div className="flex gap-2" role="group" aria-label="Filtrer les formations">
          {FILTERS.map((f) => (
            <FilterChip
              key={f.id}
              active={filter === f.id}
              onClick={() => {
                setFilter(f.id);
                setPage(1);
              }}
            >
              {f.label}
            </FilterChip>
          ))}
        </div>

        <div className="mt-4" aria-busy={isFetching}>
          {isLoading ? (
            <p className="py-10 text-center text-sm text-slate-500">Chargement des formations…</p>
          ) : error && !data ? (
            <div className="flex flex-col items-start gap-3">
              <EmptyAlert text={parseApiError(error).message} />
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RotateCw />
                Réessayer
              </Button>
            </div>
          ) : courses.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-xl bg-blue-50 text-primary" aria-hidden>
                <GraduationCap className="size-6" />
              </span>
              <p className="mt-4 font-semibold text-slate-900">Aucune formation {filter === 'all' ? 'pour le moment' : 'ici'}</p>
              <p className="mt-1 text-sm text-slate-500">Structurez votre savoir en modules et leçons.</p>
              {canManage && (
                <Button className="mt-5" onClick={() => setEditing('new')}>
                  <Plus />
                  Créer une formation
                </Button>
              )}
            </div>
          ) : (
            <>
              <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Formations">
                {courses.map((course) => (
                  <li key={course.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="relative h-32">
                      {course.thumbnail_url ? <img src={course.thumbnail_url} alt="" className="absolute inset-0 size-full object-cover" /> : <GlassBackdrop fade={false} />}
                      <div className="relative flex justify-end p-2">
                        <span className="rounded-lg bg-white/90">
                          <RowActions label={`Actions pour ${course.title}`} actions={actionsFor(course)} />
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={course.is_published ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-600'}
                        >
                          {course.is_published ? 'Publiée' : 'Brouillon'}
                        </Badge>
                        <Badge variant="outline" className="text-slate-600">
                          {courseLevelLabel[course.level]}
                        </Badge>
                      </div>
                      <Link to={`/c/${community.slug}/courses/${course.slug}`} className="mt-2 block font-semibold text-slate-900 hover:text-primary">
                        {course.title}
                      </Link>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                        <BookOpen className="size-3.5" aria-hidden />
                        {course.modules_count} module{course.modules_count > 1 ? 's' : ''} · {course.lessons_count} leçon{course.lessons_count > 1 ? 's' : ''}
                        {course.duration_seconds ? ` · ${formatDuration(course.duration_seconds)}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              {total > size && (
                <Pagination
                  totalItems={total}
                  currentPage={page}
                  perPage={size}
                  onPageChange={setPage}
                  onPageSizeChange={(n) => {
                    setSize(n);
                    setPage(1);
                  }}
                />
              )}
            </>
          )}
        </div>
      </ColgateWrapper>

      <CourseModal
        slug={community.slug}
        open={editing !== null}
        course={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        // A new course opens its editor straight away
        onSaved={(saved) => editing === 'new' && navigate(`/c/${community.slug}/courses/${saved.slug}`)}
      />
      {confirmDialog}
    </div>
  );
}

export default CommunityCourses;
