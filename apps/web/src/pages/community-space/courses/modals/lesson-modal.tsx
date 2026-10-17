import { useEffect, useState } from 'react';

import {
  Button,
  customToast,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kodinga-mono-repo/ui';
import SettingSwitch from '@/pages/shared/setting-switch';
import { useCreateLessonMutation, useGetLessonQuery, useUpdateLessonMutation } from '@/utils/api/community/community.api';
import type { CourseLesson, LessonType } from '@/utils/api/course/course.type';
import { parseApiError } from '@/utils/api/errors';
import { lessonTypeLabel } from '../course-labels';

// Video lessons need an upload (media/videos/): text based types for now
const EDITABLE_TYPES: LessonType[] = ['text', 'article', 'code', 'quiz'];

type Target = { moduleId: string; lesson: CourseLesson | null; nextOrder: number } | null;
type Props = { slug: string; courseSlug: string; target: Target; onClose: () => void };

/** Create or edit a lesson (Markdown content); the detail is loaded to edit its content */
function LessonModal({ slug, courseSlug, target, onClose }: Props) {
  const editing = target?.lesson ?? null;
  const { data: detail, isFetching } = useGetLessonQuery({ slug, courseSlug, lessonId: editing?.id ?? '' }, { skip: !editing });
  const [createLesson, { isLoading: creating }] = useCreateLessonMutation();
  const [updateLesson, { isLoading: updating }] = useUpdateLessonMutation();
  const busy = creating || updating;
  const [title, setTitle] = useState('');
  const [type, setType] = useState<LessonType>('text');
  const [content, setContent] = useState('');
  const [minutes, setMinutes] = useState('');
  const [freePreview, setFreePreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    const l = detail ?? editing;
    setTitle(l?.title ?? '');
    setType(l?.lesson_type ?? 'text');
    setContent(l?.content ?? '');
    setMinutes(l?.duration_seconds ? String(Math.round(l.duration_seconds / 60)) : '');
    setFreePreview(l?.is_free_preview ?? false);
    setError(null);
  }, [target, editing, detail]);

  const save = async () => {
    if (!target) return;
    if (title.trim().length < 2) return setError('Donnez un titre à la leçon');
    if (minutes && !/^\d+$/.test(minutes)) return setError('Durée en minutes (nombre entier)');
    const body = {
      title: title.trim(),
      lesson_type: type,
      content,
      content_format: 'markdown' as const,
      duration_seconds: minutes ? Number(minutes) * 60 : 0,
      is_free_preview: freePreview,
    };
    try {
      if (editing) await updateLesson({ slug, courseSlug, lessonId: editing.id, ...body }).unwrap();
      else await createLesson({ slug, courseSlug, moduleId: target.moduleId, ...body, order: target.nextOrder }).unwrap();
      customToast.success({ message: editing ? 'Leçon mise à jour.' : 'Leçon ajoutée.' });
      onClose();
    } catch (err) {
      setError(parseApiError(err).message);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent position="top" className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Modifier la leçon' : 'Nouvelle leçon'}</DialogTitle>
          <DialogDescription>Le contenu s'écrit en Markdown (titres, listes, blocs de code…).</DialogDescription>
        </DialogHeader>
        {editing && isFetching && !detail ? (
          <p className="text-sm text-slate-500">Chargement de la leçon…</p>
        ) : (
          <form
            id="lesson-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="grid gap-3 sm:grid-cols-[1fr_12rem_8rem]"
          >
            <label className="flex flex-col gap-1">
              <span className="custom-form-label">Titre</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="custom-form-control bg-background px-4 py-2" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="custom-form-label">Type</span>
              <select value={type} onChange={(e) => setType(e.target.value as LessonType)} className="custom-form-control bg-background px-3 py-2">
                {(EDITABLE_TYPES.includes(type) ? EDITABLE_TYPES : [type, ...EDITABLE_TYPES]).map((t) => (
                  <option key={t} value={t}>
                    {lessonTypeLabel[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="custom-form-label">Durée (min)</span>
              <input value={minutes} inputMode="numeric" onChange={(e) => setMinutes(e.target.value)} className="custom-form-control bg-background px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-3">
              <span className="custom-form-label">Contenu</span>
              <textarea
                rows={14}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={'## Objectif\n\nCe que vous allez apprendre…'}
                className="custom-form-control bg-background px-4 py-3 font-mono text-sm"
              />
            </label>
            <div className="sm:col-span-3">
              <SettingSwitch
                label="Aperçu gratuit"
                description="Visible par les non-inscrits pour donner envie."
                checked={freePreview}
                onCheckedChange={setFreePreview}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-600 sm:col-span-3">
                {error}
              </p>
            )}
          </form>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button type="submit" form="lesson-form" isLoading={busy}>
            {editing ? 'Enregistrer' : 'Ajouter la leçon'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LessonModal;
