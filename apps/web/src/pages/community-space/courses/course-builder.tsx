import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { ArrowDown, ArrowLeft, ArrowUp, EyeOff, FileText, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  Badge,
  Button,
  ColgateWrapper,
  customToast,
  DetailsPageSkeleton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyAlert,
} from '@kodinga-mono-repo/ui';
import { RowActions } from '@/pages/shared/row-actions';
import {
  useDeleteLessonMutation,
  useDeleteModuleMutation,
  useGetCourseQuery,
  useUpdateLessonMutation,
  useUpdateModuleMutation,
} from '@/utils/api/community/community.api';
import type { CourseLesson, CourseModule } from '@/utils/api/course/course.type';
import { parseApiError } from '@/utils/api/errors';
import { useCommunitySpace } from '../community-space-context';
import { courseLevelLabel, formatDuration, lessonTypeLabel } from './course-labels';
import UseCourseActions from './form/UseCourseActions';
import CourseModal from './modals/course-modal';
import LessonModal from './modals/lesson-modal';
import ModuleModal from './modals/module-modal';

const byOrder = <T extends { order: number }>(items: T[]) => [...items].sort((a, b) => a.order - b.order);

type Removal = { kind: 'module'; item: CourseModule } | { kind: 'lesson'; item: CourseLesson } | null;

/** /c/:slug/courses/:courseSlug — the course editor: modules, lessons and their order */
function CourseBuilder() {
  const { community } = useCommunitySpace();
  const slug = community.slug;
  const { courseSlug = '' } = useParams();
  const navigate = useNavigate();
  const back = `/c/${slug}/courses`;
  const { data: course, isLoading, error } = useGetCourseQuery({ slug, courseSlug });
  const [editingCourse, setEditingCourse] = useState(false);
  const { canManage, togglePublished, actionsFor, confirmDialog } = UseCourseActions({
    onEdit: () => setEditingCourse(true),
    afterDelete: () => navigate(back),
  });
  const [moduleTarget, setModuleTarget] = useState<{ module: CourseModule | null } | null>(null);
  const [lessonTarget, setLessonTarget] = useState<{ moduleId: string; lesson: CourseLesson | null; nextOrder: number } | null>(null);
  const [removal, setRemoval] = useState<Removal>(null);
  const [updateModule] = useUpdateModuleMutation();
  const [updateLesson] = useUpdateLessonMutation();
  const [deleteModule, { isLoading: deletingModule }] = useDeleteModuleMutation();
  const [deleteLesson, { isLoading: deletingLesson }] = useDeleteLessonMutation();

  if (isLoading) return <DetailsPageSkeleton />;
  if (!course) {
    const notFound = (error as FetchBaseQueryError | undefined)?.status === 404;
    return (
      <div className="flex flex-col items-start gap-4">
        <EmptyAlert text={notFound ? 'Cette formation est introuvable ou a été supprimée.' : 'Impossible de charger la formation.'} />
        <Button asChild variant="outline" size="sm">
          <Link to={back}>Retour aux formations</Link>
        </Button>
      </div>
    );
  }

  const modules = byOrder(course.modules ?? []);

  /** Swaps two neighbours: both get their new position as order */
  const move = async <T extends { id: string }>(list: T[], index: number, offset: -1 | 1, save: (item: T, order: number) => Promise<unknown>) => {
    const other = index + offset;
    if (other < 0 || other >= list.length) return;
    try {
      await Promise.all([save(list[index], other), save(list[other], index)]);
    } catch (err) {
      customToast.error({ message: parseApiError(err).message });
    }
  };
  const saveModuleOrder = (m: CourseModule, order: number) => updateModule({ slug, courseSlug, moduleId: m.id, order }).unwrap();
  const saveLessonOrder = (l: CourseLesson, order: number) => updateLesson({ slug, courseSlug, lessonId: l.id, order }).unwrap();

  const runRemoval = async () => {
    if (!removal) return;
    try {
      if (removal.kind === 'module') await deleteModule({ slug, courseSlug, moduleId: removal.item.id }).unwrap();
      else await deleteLesson({ slug, courseSlug, lessonId: removal.item.id }).unwrap();
      customToast.success({ message: removal.kind === 'module' ? 'Module supprimé.' : 'Leçon supprimée.' });
      setRemoval(null);
    } catch (err) {
      customToast.error({ message: parseApiError(err).message });
    }
  };

  return (
    <div className="community__course">
      <Link to={back} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="size-4" />
        Formations
      </Link>

      <ColgateWrapper className="border border-neutral-200 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
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
              {course.is_sequential && <Badge variant="outline" className="text-slate-600">Parcours progressif</Badge>}
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{course.title}</h1>
            {course.description && <p className="mt-1 max-w-3xl text-slate-600">{course.description}</p>}
            <p className="mt-2 text-sm text-slate-500">
              {course.modules_count} module{course.modules_count > 1 ? 's' : ''} · {course.lessons_count} leçon{course.lessons_count > 1 ? 's' : ''}
              {course.duration_seconds ? ` · ${formatDuration(course.duration_seconds)}` : ''}
            </p>
          </div>
          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant={course.is_published ? 'outline' : 'default'} onClick={() => togglePublished(course)}>
                {course.is_published ? <EyeOff /> : <Send />}
                {course.is_published ? 'Repasser en brouillon' : 'Publier'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingCourse(true)}>
                <Pencil />
                Modifier
              </Button>
              <RowActions label={`Actions pour ${course.title}`} actions={actionsFor(course, { withOpen: false }).filter((a) => a.label === 'Supprimer')} />
            </div>
          )}
        </div>
      </ColgateWrapper>

      <section aria-label="Programme" className="mt-6 flex flex-col gap-4">
        {modules.length === 0 && (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 py-12 text-center">
            <p className="font-semibold text-slate-900">Le programme est vide</p>
            <p className="mt-1 text-sm text-slate-500">Commencez par un module, puis ajoutez-y des leçons.</p>
          </div>
        )}

        {modules.map((m, mi) => {
          const lessons = byOrder(m.lessons ?? []);
          return (
            <ColgateWrapper key={m.id} className="border border-neutral-200 p-0" aria-label={`Module ${m.title}`}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Module {mi + 1}</p>
                  <h2 className="truncate font-semibold text-slate-900">{m.title}</h2>
                  {m.description && <p className="text-sm text-slate-500">{m.description}</p>}
                </div>
                {canManage && (
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon-sm" aria-label={`Monter le module ${m.title}`} disabled={mi === 0} onClick={() => move(modules, mi, -1, saveModuleOrder)}>
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Descendre le module ${m.title}`}
                      disabled={mi === modules.length - 1}
                      onClick={() => move(modules, mi, 1, saveModuleOrder)}
                    >
                      <ArrowDown />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Modifier le module ${m.title}`} onClick={() => setModuleTarget({ module: m })}>
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-red-600 hover:text-red-700"
                      aria-label={`Supprimer le module ${m.title}`}
                      onClick={() => setRemoval({ kind: 'module', item: m })}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </div>

              <ol className="divide-y divide-slate-100">
                {lessons.map((l, li) => (
                  <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                    <FileText className="size-4 shrink-0 text-slate-400" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{l.title}</span>
                      <span className="text-xs text-slate-500">
                        {lessonTypeLabel[l.lesson_type]}
                        {l.duration_seconds ? ` · ${formatDuration(l.duration_seconds)}` : ''}
                      </span>
                    </span>
                    {l.is_free_preview && <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">Aperçu gratuit</Badge>}
                    {canManage && (
                      <span className="flex items-center gap-0.5">
                        <Button variant="ghost" size="icon-sm" aria-label={`Monter la leçon ${l.title}`} disabled={li === 0} onClick={() => move(lessons, li, -1, saveLessonOrder)}>
                          <ArrowUp />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Descendre la leçon ${l.title}`}
                          disabled={li === lessons.length - 1}
                          onClick={() => move(lessons, li, 1, saveLessonOrder)}
                        >
                          <ArrowDown />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Modifier la leçon ${l.title}`}
                          onClick={() => setLessonTarget({ moduleId: m.id, lesson: l, nextOrder: l.order })}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-red-600 hover:text-red-700"
                          aria-label={`Supprimer la leçon ${l.title}`}
                          onClick={() => setRemoval({ kind: 'lesson', item: l })}
                        >
                          <Trash2 />
                        </Button>
                      </span>
                    )}
                  </li>
                ))}
                {lessons.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">Aucune leçon dans ce module.</li>}
              </ol>

              {canManage && (
                <div className="border-t border-slate-100 px-5 py-3">
                  <Button variant="ghost" size="sm" onClick={() => setLessonTarget({ moduleId: m.id, lesson: null, nextOrder: lessons.length })}>
                    <Plus />
                    Ajouter une leçon
                  </Button>
                </div>
              )}
            </ColgateWrapper>
          );
        })}

        {canManage && (
          <Button variant="outline" className="self-start" onClick={() => setModuleTarget({ module: null })}>
            <Plus />
            Ajouter un module
          </Button>
        )}
      </section>

      <CourseModal slug={slug} open={editingCourse} course={course} onClose={() => setEditingCourse(false)} />
      <ModuleModal
        slug={slug}
        courseSlug={courseSlug}
        open={!!moduleTarget}
        module={moduleTarget?.module ?? null}
        nextOrder={modules.length}
        onClose={() => setModuleTarget(null)}
      />
      <LessonModal slug={slug} courseSlug={courseSlug} target={lessonTarget} onClose={() => setLessonTarget(null)} />

      <Dialog open={!!removal} onOpenChange={(open) => !open && !(deletingModule || deletingLesson) && setRemoval(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer « {removal?.item.title} » ?</DialogTitle>
            <DialogDescription>
              {removal?.kind === 'module'
                ? 'Le module et toutes ses leçons seront supprimés.'
                : 'La leçon et la progression des membres sur cette leçon seront supprimées.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoval(null)} disabled={deletingModule || deletingLesson}>
              Retour
            </Button>
            <Button variant="danger" onClick={runRemoval} isLoading={deletingModule || deletingLesson}>
              <Trash2 />
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}

export default CourseBuilder;
