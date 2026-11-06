import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@kodinga-mono-repo/ui';
import SettingSwitch from '@/pages/shared/setting-switch';
import type { LessonType } from '@/utils/api/course/course.type';
import { CodeExerciseFields } from '../components/code-exercise-fields';
import { LessonAIPanel } from '../components/lesson-ai-panel';
import { QuizFields } from '../components/quiz-fields';
import VideoField from '../components/video-field';
import { lessonTypeLabel } from '../course-labels';
import UseLessonForm, { type LessonTarget } from '../form/UseLessonForm';

const EDITABLE_TYPES: LessonType[] = ['text', 'video', 'article', 'code', 'quiz'];

type Props = { slug: string; courseSlug: string; target: LessonTarget; onClose: () => void };

/** Create or edit a lesson: the fields of its type (text, video, code exercise…), see UseLessonForm */
function LessonModal({ slug, courseSlug, target, onClose }: Props) {
  const form = UseLessonForm({ slug, courseSlug, target, onClose });
  const { 
    editing, 
    busy, 
    uploading, 
    isVideo, 
    isCode, 
    isQuiz,
    type 
  } = form;

  return (
    <Dialog open={!!target} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent position="top" className="max-h-[92svh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Modifier la leçon' : 'Nouvelle leçon'}</DialogTitle>
          <DialogDescription>
            {isVideo
              ? 'Une vidéo, accompagnée si besoin d’un texte en Markdown.'
              : isCode
                ? 'Un énoncé, le code de départ que l’apprenant complète, et la solution qu’il ouvre quand il veut.'
                : isQuiz
                  ? 'Des questions à choix unique ou multiple, corrigées automatiquement. Réussi, le quiz termine la leçon.'
                  : 'Le contenu s’écrit en Markdown (titres, listes, blocs de code…).'}
          </DialogDescription>
        </DialogHeader>
        {form.isLoadingDetail ? (
          <p className="text-sm text-slate-500">Chargement de la leçon…</p>
        ) : (
          <form
            id="lesson-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              form.save();
            }}
            className="grid gap-3 sm:grid-cols-[1fr_12rem_8rem]"
          >
            <label className="flex flex-col gap-1">
              <span className="custom-form-label">Titre</span>
              <input value={form.title} onChange={(e) => form.setTitle(e.target.value)} className="custom-form-control bg-background px-4 py-2" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="custom-form-label">Type</span>
              <select
                value={type}
                onChange={(e) => form.changeType(e.target.value as LessonType)}
                className="custom-form-control bg-background px-3 py-2"
              >
                {(EDITABLE_TYPES.includes(type) ? EDITABLE_TYPES : [type, ...EDITABLE_TYPES]).map((t) => (
                  <option key={t} value={t}>
                    {lessonTypeLabel[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="custom-form-label">Durée (min)</span>
              <input value={form.minutes} inputMode="numeric" onChange={(e) => form.setMinutes(e.target.value)} className="custom-form-control bg-background px-3 py-2" />
            </label>
            {isVideo && (
              <div className="sm:col-span-3">
                <VideoField
                  source={form.video.source}
                  onSourceChange={form.video.setSource}
                  file={form.video.file}
                  onFileChange={form.video.setFile}
                  url={form.video.url}
                  onUrlChange={form.video.setUrl}
                  current={form.current}
                  // Fills the duration with the length of the video, unless it was given
                  onDuration={(seconds) => form.setMinutes((m) => m || String(Math.max(1, Math.round(seconds / 60))))}
                  error={form.video.error}
                />
              </div>
            )}
            {(isCode || isQuiz) && <LessonAIPanel slug={slug} courseSlug={courseSlug} form={form} />}
            {isCode ? (
              <CodeExerciseFields value={form.exercise} onChange={form.setExercise} />
            ) : (
              <label className="flex flex-col gap-1 sm:col-span-3">
                <span className="custom-form-label">{isVideo ? 'Texte d’accompagnement (optionnel)' : isQuiz ? 'Consigne (facultatif)' : 'Contenu'}</span>
                <textarea
                  rows={isVideo ? 6 : isQuiz ? 3 : 14}
                  value={form.content}
                  onChange={(e) => form.setContent(e.target.value)}
                  placeholder={'## Objectif\n\nCe que vous allez apprendre…'}
                  className="custom-form-control bg-background px-4 py-3 font-mono text-sm"
                />
              </label>
            )}
            {isQuiz && <QuizFields value={form.quiz} onChange={form.setQuiz} />}
            <div className="sm:col-span-3">
              <SettingSwitch
                label="Aperçu gratuit"
                description="Visible par les non-inscrits pour donner envie."
                checked={form.freePreview}
                onCheckedChange={form.setFreePreview}
              />
            </div>
            {form.error && (
              <p role="alert" className="text-sm text-red-600 sm:col-span-3">
                {form.error}
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
