import { useEffect, useState } from 'react';

import { customToast } from '@kodinga/ui';
import { type CodeExercise, composeExercise, EMPTY_EXERCISE, exerciseFields, exerciseOfLesson, parseExercise } from '@/pages/shared/code-exercise';
import { useCreateLessonMutation, useGetLessonQuery, useUpdateLessonMutation, useUploadLessonVideoMutation } from '@/utils/api/community/community.api';
import type { CourseLesson, LessonType } from '@/utils/api/course/course.type';
import { parseApiError } from '@/utils/api/errors';
import { checkVideoUrl, type VideoSource } from '../components/video-field';
import { checkQuiz, EMPTY_QUIZ, type QuizDraft, toQuizData, toQuizDraft } from './quiz-draft';

/** The lesson to edit (null to create it), in its module, and the place of a new one */
export type LessonTarget = { moduleId: string; lesson: CourseLesson | null; nextOrder: number } | null;

type Options = { slug: string; courseSlug: string; target: LessonTarget; onClose: () => void };


function UseLessonForm({ slug, courseSlug, target, onClose }: Options) {
  const editing = target?.lesson ?? null;
  const { data: detail, isFetching } = useGetLessonQuery({ slug, courseSlug, lessonId: editing?.id ?? '' }, { skip: !editing });
  const [createLesson, { isLoading: creating }] = useCreateLessonMutation();
  const [updateLesson, { isLoading: updating }] = useUpdateLessonMutation();
  const [uploadVideo, { isLoading: uploading }] = useUploadLessonVideoMutation();
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
  /** The parts of a code exercise, while the type is "code" */
  const [exercise, setExercise] = useState<CodeExercise>(EMPTY_EXERCISE);
  /** The questions, while the type is "quiz" */
  const [quiz, setQuiz] = useState<QuizDraft>(EMPTY_QUIZ);
  const isVideo = type === 'video';
  const isCode = type === 'code';
  const isQuiz = type === 'quiz';

  // Each opening starts from the lesson (its detail once loaded), or from scratch
  useEffect(() => {
    if (!target) return;
    const l = detail ?? editing;
    setTitle(l?.title ?? '');
    setType(l?.lesson_type ?? 'text');
    setContent(l?.content ?? '');
    setExercise((l && exerciseOfLesson(l)) ?? { ...EMPTY_EXERCISE, statement: l?.content ?? '' });
    setQuiz(toQuizDraft(l?.quiz_data));
    setMinutes(l?.duration_seconds ? String(Math.round(l.duration_seconds / 60)) : '');
    setFreePreview(l?.is_free_preview ?? false);
    setError(null);
    setVideoSource('file');
    setVideoFile(null);
    setVideoUrl('');
    setVideoError(null);
  }, [target, editing, detail]);

  /** The text goes from one form to the other: nothing written is lost */
  const changeType = (next: LessonType) => {
    if (next === 'code' && !isCode) setExercise(parseExercise(content) ?? { ...EMPTY_EXERCISE, statement: content });
    if (next !== 'code' && isCode) setContent(composeExercise(exercise));
    setType(next);
  };

  const save = async () => {
    if (!target) return;
    if (title.trim().length < 2) return setError('Donnez un titre à la leçon');
    if (minutes && !/^\d+$/.test(minutes)) return setError('Durée en minutes (nombre entier)');
    if (isCode && !exercise.statement.trim() && !exercise.starter.trim()) return setError('Écrivez l’énoncé ou le code de départ de l’exercice');
    const quizError = isQuiz ? checkQuiz(quiz) : null;
    if (quizError) return setError(quizError);
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
      ...(isCode ? exerciseFields(exercise) : {}),
      // No longer an exercise or a quiz: its parts leave with its type
      ...(!isCode && editing?.lesson_type === 'code' ? { code_language: '', code_snippet: '', code_blocks: [] } : {}),
      ...(isQuiz ? { quiz_data: toQuizData(quiz) } : editing?.lesson_type === 'quiz' ? { quiz_data: {} } : {}),
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

  return {
    editing,
    /** The lesson as saved (its video), for the video field */
    current: detail ?? editing,
    isLoadingDetail: !!editing && isFetching && !detail,
    busy: creating || updating || uploading,
    uploading,
    isVideo,
    isCode,
    isQuiz,
    quiz,
    setQuiz,
    title,
    setTitle,
    type,
    changeType,
    content,
    setContent,
    exercise,
    setExercise,
    minutes,
    setMinutes,
    freePreview,
    setFreePreview,
    error,
    video: {
      source: videoSource,
      setSource: (next: VideoSource) => {
        setVideoSource(next);
        setVideoError(null);
      },
      file: videoFile,
      setFile: setVideoFile,
      url: videoUrl,
      setUrl: (next: string) => {
        setVideoUrl(next);
        setVideoError(null);
      },
      error: videoError,
    },
    save,
  };
}

export type LessonForm = ReturnType<typeof UseLessonForm>;

export default UseLessonForm;
