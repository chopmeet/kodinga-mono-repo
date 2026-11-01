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
import type { CourseLesson } from '@/utils/api/course/course.type';
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

  const open = (lessonId: string) => setParams({ lesson: lessonId }, { replace: false });
  const previous = index > 0 ? lessons[index - 1] : null;
  const next = index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : null;

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
    closeCongratulations: () => setJustFinished(false),
    /**
     * Marks the open lesson done (or not), then goes on to the next one. The course is read again:
     * it unlocks the next lesson, and says whether the course is now done (the api recomputes it)
     */
    toggleDone: async () => {
      if (!outline) return;
      const done = !outline.is_completed;
      const wasFinished = (course.data?.user_progress_percent ?? 0) >= 100;
      const ok = await run(updateProgress({ slug, courseSlug, lessonId: outline.id, is_completed: done }).unwrap());
      if (!ok || !done) return;
      const fresh = await course.refetch();
      if (!wasFinished && (fresh.data?.user_progress_percent ?? 0) >= 100) {
        setJustFinished(true);
        return;
      }
      if (next) open(next.id);
    },
  };
}

export type CoursePlayer = ReturnType<typeof UseCoursePlayer>;

export default UseCoursePlayer;
