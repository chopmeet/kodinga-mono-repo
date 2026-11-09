import { ArrowLeft, ArrowRight, Check, CircleCheck, CircleX, RotateCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button, cn } from '@kodinga/ui';
import type { CourseLesson, QuizQuestion, QuizResult } from '@/utils/api/course/course.type';
import UseQuizPlayer from './form/UseQuizPlayer';

const percent = (n: number) => `${Math.round(n * 10) / 10} %`;

/**
 * The score, and each question with the answers given. The api gives the right answers and the
 * explanations only once the quiz is passed: before, each question only says right or wrong.
 */
function QuizResultView({ result, questions, onRestart }: { result: QuizResult; questions: QuizQuestion[]; onRestart: () => void }) {
  const optionsOf = (id: string) => questions.find((q) => q.id === id)?.options ?? [];
  const correctionHidden = !result.passed && result.question_results.every((r) => r.correct_option_ids.length === 0);
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-label={t('course.quiz.result')}
        className={cn('flex flex-wrap items-center gap-4 rounded-xl border p-5', result.passed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50')}
      >
        {result.passed ? <CircleCheck className="size-9 shrink-0 text-emerald-700" aria-hidden /> : <CircleX className="size-9 shrink-0 text-amber-700" aria-hidden />}
        <div className="min-w-0 flex-1">
          <p className={cn('text-2xl font-bold tabular-nums', result.passed ? 'text-emerald-900' : 'text-amber-900')}>{percent(result.score_percent)}</p>
          <p className={cn('text-sm', result.passed ? 'text-emerald-900' : 'text-amber-900')}>
            {result.passed ? t('course.quiz.passed') : t('course.quiz.needToPass', { score: percent(result.passing_score) })} ·{' '}
            {t('course.quiz.correct', { count: result.correct_questions_count, total: result.total_questions_count })}
          </p>
        </div>
        <Button variant={result.passed ? 'outline' : 'default'} onClick={onRestart}>
          <RotateCw /> {t('course.quiz.restart')}
        </Button>
      </section>

      {correctionHidden && (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {t('course.quiz.hidden')}
        </p>
      )}

      <ol className="flex flex-col gap-4" aria-label={correctionHidden ? t('course.quiz.yourAnswers') : t('course.quiz.correction')}>
        {result.question_results.map((r, i) => (
          <li key={r.question_id} className="rounded-xl border border-slate-200 p-4">
            <p className="flex items-start gap-2 font-medium text-slate-900">
              {r.is_correct ? <Check className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-label={t('course.quiz.right')} /> : <X className="mt-0.5 size-4 shrink-0 text-red-700" aria-label={t('course.quiz.wrong')} />}
              <span>
                {i + 1}. {r.question}
              </span>
            </p>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm">
              {optionsOf(r.question_id).map((o) => {
                const chosen = r.selected_option_ids.includes(o.id);
                const right = r.correct_option_ids.includes(o.id);
                return (
                  <li
                    key={o.id}
                    className={cn(
                      'flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2',
                      right ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : chosen ? 'border-red-200 bg-red-50 text-red-900' : 'border-slate-100 text-slate-600',
                    )}
                  >
                    <span className="min-w-0">{o.text}</span>
                    <span className="text-xs font-semibold">{[chosen && t('course.quiz.yourAnswer'), right && t('course.quiz.right')].filter(Boolean).join(' · ')}</span>
                  </li>
                );
              })}
            </ul>
            {r.explanation && <p className="mt-3 text-sm text-slate-600">{r.explanation}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

type Props = {
  slug: string;
  courseSlug: string;
  lesson: CourseLesson;
  onGraded: (result: QuizResult) => void;
};

/** The questions of a quiz lesson, one at a time, then the result of the api */
export function QuizView({ slug, courseSlug, lesson, onGraded }: Props) {
  const { t } = useTranslation();
  const quiz = UseQuizPlayer({ slug, courseSlug, lesson, onGraded });
  const { question } = quiz;

  if (quiz.result) return <QuizResultView result={quiz.result} questions={quiz.questions} onRestart={quiz.restart} />;
  if (!question) return null;
  const multiple = question.question_type === 'multiple_choice';

  return (
    <section aria-label={t('course.quiz.label')} className="flex flex-col gap-4">
      {quiz.description && <p className="text-slate-700">{quiz.description}</p>}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
          <span className="font-semibold text-slate-900">
            {t('course.quiz.questionOf', { n: quiz.index + 1, total: quiz.questions.length })}
          </span>
          <span>{t('course.quiz.toPass', { score: percent(quiz.passingScore) })}</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-slate-100" role="progressbar" aria-label={t('course.quiz.answered')} aria-valuenow={quiz.answered} aria-valuemin={0} aria-valuemax={quiz.questions.length}>
          <div className="h-full rounded-full bg-blue-900 transition-[width]" style={{ width: `${(quiz.answered / quiz.questions.length) * 100}%` }} />
        </div>
      </div>

      <fieldset className="rounded-xl border border-slate-200 p-4 sm:p-5">
        <legend className="sr-only">{question.question}</legend>
        <p className="font-medium text-slate-900">{question.question}</p>
        <p className="mt-1 text-xs text-slate-500">{multiple ? t('course.quiz.multiple') : t('course.quiz.single')}</p>
        <div className="mt-4 flex flex-col gap-2">
          {question.options.map((o) => {
            const checked = quiz.selected.includes(o.id);
            return (
              <label
                key={o.id}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                  checked ? 'border-blue-900 bg-blue-50 text-blue-950' : 'border-slate-200 text-slate-700 hover:border-slate-300',
                )}
              >
                <input
                  type={multiple ? 'checkbox' : 'radio'}
                  name={`quiz-${question.id}`}
                  checked={checked}
                  onChange={() => quiz.choose(question.id, o.id, multiple)}
                  className="mt-0.5 size-4 shrink-0 accent-blue-900"
                />
                <span className="min-w-0">{o.text}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {quiz.error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {quiz.error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" onClick={quiz.previous} disabled={quiz.index === 0 || quiz.isSubmitting}>
          <ArrowLeft /> {t('course.quiz.previous')}
        </Button>
        {quiz.isLast ? (
          <Button onClick={quiz.submit} isLoading={quiz.isSubmitting}>
            <Check /> {t('course.quiz.validate')}
          </Button>
        ) : (
          <Button onClick={quiz.next}>
            {t('course.quiz.next')} <ArrowRight />
          </Button>
        )}
      </div>
    </section>
  );
}
