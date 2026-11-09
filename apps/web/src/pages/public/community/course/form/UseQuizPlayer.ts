import { useState } from 'react';
import i18n from '@/utils/i18n';

import { useSubmitQuizMutation } from '@/utils/api/community/community.api';
import type { CourseLesson, QuizResult } from '@/utils/api/course/course.type';
import { parseApiError } from '@/utils/api/errors';

type Options = {
  slug: string;
  courseSlug: string;
  lesson: CourseLesson;
  /** After each graded attempt: the player reads the course again */
  onGraded: (result: QuizResult) => void;
};

/**
 * A quiz in the course player: one question at a time, one or several choices depending on the
 * question, then the score and the correction of the api (POST .../quiz/submit/). Passed, the
 * lesson is done; failed, the learner starts again. Opens on the last attempt, if any.
 */
function UseQuizPlayer({ slug, courseSlug, lesson, onGraded }: Options) {
  const questions = lesson.quiz_data?.questions ?? [];
  const [submitQuiz, { isLoading: isSubmitting }] = useSubmitQuizMutation();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<QuizResult | null>(lesson.user_quiz_result ?? null);
  const [error, setError] = useState<string | null>(null);

  const question = questions[index];
  const missing = questions.findIndex((q) => !answers[q.id]?.length);

  const choose = (questionId: string, optionId: string, multiple: boolean) => {
    setError(null);
    setAnswers((all) => {
      const current = all[questionId] ?? [];
      if (!multiple) return { ...all, [questionId]: [optionId] };
      return { ...all, [questionId]: current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId] };
    });
  };

  const goTo = (next: number) => {
    setError(null);
    setIndex(next);
  };

  const submit = async () => {
    // Every question is answered: back to the first one left out
    if (missing >= 0) {
      setIndex(missing);
      setError(i18n.t('course.quiz.answerFirst', { n: missing + 1 }));
      return;
    }
    setError(null);
    try {
      const graded = await submitQuiz({ slug, courseSlug, lessonId: lesson.id, answers }).unwrap();
      setResult(graded);
      onGraded(graded);
    } catch (err) {
      setError(parseApiError(err).message);
    }
  };

  return {
    title: lesson.quiz_data?.title ?? '',
    description: lesson.quiz_data?.description ?? '',
    passingScore: lesson.quiz_data?.passing_score ?? 50,
    attempts: lesson.quiz_attempts_count ?? 0,
    questions,
    question,
    index,
    isLast: index === questions.length - 1,
    answered: questions.length - questions.filter((q) => !answers[q.id]?.length).length,
    selected: question ? (answers[question.id] ?? []) : [],
    result,
    error,
    isSubmitting,
    choose,
    previous: () => goTo(index - 1),
    next: () => goTo(index + 1),
    submit,
    restart: () => {
      setAnswers({});
      setIndex(0);
      setResult(null);
      setError(null);
    },
  };
}

export default UseQuizPlayer;
