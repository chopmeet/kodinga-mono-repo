import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { useState } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';

import { customToast } from '@kodinga-mono-repo/ui';
import { useAppSelector } from '@/redux/hook';
import {
  useEnrollCourseMutation,
  useGetCommunityQuery,
  useGetCourseQuery,
  useGetLessonQuery,
  useUpdateLessonProgressMutation,
} from '@/utils/api/community/community.api';
import type { CourseLesson, QuizResult } from '@/utils/api/course/course.type';
import { parseApiError } from '@/utils/api/errors';
import { membershipOf } from '../../form/UseCommunityPage';

/**
 * /communities/:slug/courses/:courseSlug(?lesson=<id>) — a member follows a course:
 * GET the course (modules, lessons with is_completed / is_locked for the user), GET the open
 * lesson (403 while locked), POST .../progress/ to mark it done (the api recomputes the course
 * progress and refuses a locked lesson), POST .../enroll/ to start.
 */
function UseCoursePlayer() {
  const { slug = '', courseSlug = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { pathname, search } = useLocation();
  const signedIn = !!useAppSelector((s) => s.user.token);

  const community = useGetCommunityQuery(slug, { skip: !slug });
  const membership = membershipOf(community.data, signedIn);
  const isMember = membership === 'member';
  const course = useGetCourseQuery({ slug, courseSlug }, { skip: !isMember || !courseSlug });

  // Lessons of the course in reading order (modules, then lessons)
  const lessons: CourseLesson[] = [...(course.data?.modules ?? [])]
    .sort((a, b) => a.order - b.order)
    .flatMap((m) => [...m.lessons].sort((a, b) => a.order - b.order));
  /** Where "Continuer" goes: the first lesson not done yet that can be opened */
  const nextToDo = lessons.find((l) => !l.is_completed && !l.is_locked) ?? null;

  const requested = params.get('lesson');
  const currentId = requested ?? nextToDo?.id ?? lessons[0]?.id ?? '';
  const index = lessons.findIndex((l) => l.id === currentId);
  const outline = index >= 0 ? lessons[index] : undefined;
  const lesson = useGetLessonQuery({ slug, courseSlug, lessonId: currentId }, { skip: !course.data || !currentId || !!outline?.is_locked });

  const [enroll, { isLoading: isEnrolling }] = useEnrollCourseMutation();
  const [updateProgress, { isLoading: isSaving }] = useUpdateLessonProgressMutation();
  /** The congratulations: only when the api has just confirmed the course done (100 %) */
  const [justFinished, setJustFinished] = useState(false);
  /** What the api gave for it: the last lesson and the course */
  const [earnedPoints, setEarnedPoints] = useState(0);

  const open = (lessonId: string) => setParams({ lesson: lessonId }, { replace: false });
  const previous = index > 0 ? lessons[index - 1] : null;
  const next = index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : null;

  const congratulate = (points: number) => {
    setEarnedPoints(points);
    setJustFinished(true);
  };

  const run = async (action: Promise<unknown>, message?: string) => {
    try {
      await action;
      if (message) customToast.success({ message });
      return true;
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
      return false;
    }
  };

  return {
    slug,
    courseSlug,
    membership,
    community: community.data,
    course: course.data,
    lessons,
    outline,
    lesson: lesson.data,
    isLoading: community.isLoading || (isMember && course.isLoading),
    isLessonLoading: lesson.isFetching && !lesson.data,
    lessonError: lesson.error as FetchBaseQueryError | undefined,
    notFound: (course.error as FetchBaseQueryError | undefined)?.status === 404,
    loginUrl: `/auth/login?next=${encodeURIComponent(pathname + search)}`,
    progress: Math.round(course.data?.user_progress_percent ?? 0),
    isEnrolled: !!course.data?.user_is_enrolled,
    isFinished: (course.data?.user_progress_percent ?? 0) >= 100,
    position: index + 1,
    previous,
    next,
    nextToDo,
    isEnrolling,
    isSaving,
    open,
    /** Enrolls, then opens the first lesson to do */
    start: async () => {
      if (await run(enroll({ slug, courseSlug }).unwrap(), 'Vous êtes inscrit à la formation.')) {
        const first = nextToDo ?? lessons[0];
        if (first) open(first.id);
      }
    },
    justFinished,
    earnedPoints,
    /** A quiz was graded: the course is read again (unlocked lesson), and maybe done */
    quizGraded: async (result: QuizResult) => {
      await course.refetch();
      if (result.just_completed_course) congratulate(result.congratulations?.xp_awarded ?? 0);
    },
    closeCongratulations: () => setJustFinished(false),
    /**
     * Marks the open lesson done (or not), then goes on to the next one. The answer says what it
     * gave and whether the course is now done; the course is read again to unlock the next lesson.
     */
    toggleDone: async () => {
      if (!outline) return;
      const done = !outline.is_completed;
      try {
        const result = await updateProgress({ slug, courseSlug, lessonId: outline.id, is_completed: done }).unwrap();
        if (!done) return;
        await course.refetch();
        if (result.just_completed_course) {
          congratulate(result.xp_awarded);
          return;
        }
        if (result.xp_awarded > 0) customToast.success({ message: `Leçon terminée : +${result.xp_awarded} point${result.xp_awarded > 1 ? 's' : ''}` });
        if (next) open(next.id);
      } catch (error) {
        customToast.error({ message: parseApiError(error).message });
      }
    },
  };
}

export type CoursePlayer = ReturnType<typeof UseCoursePlayer>;

export default UseCoursePlayer;
