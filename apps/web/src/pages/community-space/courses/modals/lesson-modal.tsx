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
import { useCreateLessonMutation, useGetLessonQuery, useUpdateLessonMutation, useUploadLessonVideoMutation } from '@/utils/api/community/community.api';
import type { CourseLesson, LessonType } from '@/utils/api/course/course.type';
import { parseApiError } from '@/utils/api/errors';
import VideoField, { checkVideoUrl, type VideoSource } from '../components/video-field';
import { lessonTypeLabel } from '../course-labels';

const EDITABLE_TYPES: LessonType[] = ['text', 'video', 'article', 'code', 'quiz'];

type Target = { moduleId: string; lesson: CourseLesson | null; nextOrder: number } | null;
type Props = { slug: string; courseSlug: string; target: Target; onClose: () => void };

/**
 * Create or edit a lesson (Markdown content); the detail is loaded to edit its content. A video
 * lesson also sends its video (file or link) to .../video/ once the lesson is saved.
 */
function LessonModal({ slug, courseSlug, target, onClose }: Props) {
  const editing = target?.lesson ?? null;
  const { data: detail, isFetching } = useGetLessonQuery({ slug, courseSlug, lessonId: editing?.id ?? '' }, { skip: !editing });
  const [createLesson, { isLoading: creating }] = useCreateLessonMutation();
  const [updateLesson, { isLoading: updating }] = useUpdateLessonMutation();
  const [uploadVideo, { isLoading: uploading }] = useUploadLessonVideoMutation();
  const busy = creating || updating || uploading;
  const [title, setTitle] = useState('');
  const [type, setType] = useState<LessonType>('text');
  const [content, setContent] = useState('');
  const [minutes, setMinutes] = useState('');
  const [freePreview, setFreePreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoSource, setVideoSource] = useState<VideoSource>('file');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoError, setVideoError] = useState<string | null>(null);
  const isVideo = type === 'video';

  useEffect(() => {
    if (!target) return;
    const l = detail ?? editing;
    setTitle(l?.title ?? '');
    setType(l?.lesson_type ?? 'text');
    setContent(l?.content ?? '');
    setMinutes(l?.duration_seconds ? String(Math.round(l.duration_seconds / 60)) : '');
    setFreePreview(l?.is_free_preview ?? false);
    setError(null);
    setVideoSource('file');
    setVideoFile(null);
    setVideoUrl('');
    setVideoError(null);
  }, [target, editing, detail]);

  const save = async () => {
    if (!target) return;
    if (title.trim().length < 2) return setError('Donnez un titre à la leçon');
    if (minutes && !/^\d+$/.test(minutes)) return setError('Durée en minutes (nombre entier)');
    // The video to send, if any: the one in the current mode
    const video = isVideo ? (videoSource === 'file' ? (videoFile ? { file: videoFile } : null) : videoUrl.trim() ? { url: videoUrl.trim() } : null) : null;
    if (video?.url) {
      const invalid = checkVideoUrl(video.url);
      if (invalid) return setVideoError(invalid);
    }
    if (isVideo && !video && !(detail ?? editing)?.has_video) return setVideoError('Ajoutez la vidéo de la leçon : un fichier ou un lien.');
    setVideoError(null);
    const body = {
      title: title.trim(),
      lesson_type: type,
      content,
      content_format: 'markdown' as const,
      duration_seconds: minutes ? Number(minutes) * 60 : 0,
      is_free_preview: freePreview,
    };
    let lessonId = editing?.id;
    try {
      if (editing) await updateLesson({ slug, courseSlug, lessonId: editing.id, ...body }).unwrap();
      else lessonId = (await createLesson({ slug, courseSlug, moduleId: target.moduleId, ...body, order: target.nextOrder }).unwrap()).id;
    } catch (err) {
      return setError(parseApiError(err).message);
    }
    if (video && lessonId) {
      try {
        await uploadVideo({ slug, courseSlug, lessonId, ...video }).unwrap();
      } catch (err) {
        // The lesson is saved: the video can be sent again by editing it
        customToast.error({ message: `Leçon enregistrée, mais la vidéo n’a pas pu être envoyée : ${parseApiError(err).message} Modifiez la leçon pour réessayer.` });
        return onClose();
      }
    }
    customToast.success({ message: editing ? 'Leçon mise à jour.' : 'Leçon ajoutée.' });
    onClose();
  };

  return (
    <Dialog open={!!target} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent position="top" className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Modifier la leçon' : 'Nouvelle leçon'}</DialogTitle>
          <DialogDescription>
            {isVideo ? 'Une vidéo, accompagnée si besoin d’un texte en Markdown.' : 'Le contenu s’écrit en Markdown (titres, listes, blocs de code…).'}
          </DialogDescription>
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
            {isVideo && (
              <div className="sm:col-span-3">
                <VideoField
                  source={videoSource}
                  onSourceChange={(next) => {
                    setVideoSource(next);
                    setVideoError(null);
                  }}
                  file={videoFile}
                  onFileChange={setVideoFile}
                  url={videoUrl}
                  onUrlChange={(next) => {
                    setVideoUrl(next);
                    setVideoError(null);
                  }}
                  current={detail ?? editing}
                  // Fills the duration with the length of the video, unless it was given
                  onDuration={(seconds) => setMinutes((m) => m || String(Math.max(1, Math.round(seconds / 60))))}
                  error={videoError}
                />
              </div>
            )}
            <label className="flex flex-col gap-1 sm:col-span-3">
              <span className="custom-form-label">{isVideo ? 'Texte d’accompagnement (optionnel)' : 'Contenu'}</span>
              <textarea
                rows={isVideo ? 6 : 14}
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
            {uploading ? 'Envoi de la vidéo…' : editing ? 'Enregistrer' : 'Ajouter la leçon'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LessonModal;
