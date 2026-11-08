import { Sparkles } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@kodinga/ui';
import type { LessonForm } from '../form/UseLessonForm';
import UseLessonAI from '../form/UseLessonAI';
import type { AIDifficulty } from '@/utils/api/ai/ai.type';

const DIFFICULTIES: { value: AIDifficulty; label: string }[] = [
  { value: 'beginner', label: 'Débutant' },
  { value: 'intermediate', label: 'Intermédiaire' },
  { value: 'advanced', label: 'Avancé' },
];
const COUNTS = [3, 5, 10];

const selectClass = 'h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700';

/** Asks the AI for a quiz or an exercise; a lesson not saved yet has no content for it to read */
export function LessonAIPanel({ slug, courseSlug, form }: { slug: string; courseSlug: string; form: LessonForm }) {
  const [difficulty, setDifficulty] = useState<AIDifficulty>('intermediate');
  const [count, setCount] = useState(3);
  const ai = UseLessonAI({
    slug,
    courseSlug,
    lessonId: form.editing?.id ?? '',
    addQuestions: (questions) => form.setQuiz({ ...form.quiz, questions: [...form.quiz.questions, ...questions] }),
    exercise: form.exercise,
    setExercise: form.setExercise,
  });
  const hasExercise = !!(form.exercise.statement.trim() || form.exercise.starter.trim() || form.exercise.solution.trim());

  return (
    <section aria-label="Proposition de l’IA" className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 sm:col-span-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-blue-950">
        <Sparkles className="size-4" aria-hidden />
        {form.isQuiz ? 'Proposer des questions avec l’IA' : 'Proposer un exercice avec l’IA'}
      </p>
      {!form.editing ? (
        <p className="mt-1 text-xs text-slate-600">Enregistrez d’abord la leçon : l’IA part de son contenu.</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-slate-600">À partir du contenu enregistré de la leçon. Rien n’est publié tant que vous n’enregistrez pas.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {form.isQuiz && (
              <select aria-label="Nombre de questions" value={count} onChange={(e) => setCount(Number(e.target.value))} className={selectClass}>
                {COUNTS.map((n) => (
                  <option key={n} value={n}>
                    {n} questions
                  </option>
                ))}
              </select>
            )}
            <select aria-label="Niveau" value={difficulty} onChange={(e) => setDifficulty(e.target.value as AIDifficulty)} className={selectClass}>
              {DIFFICULTIES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              isLoading={ai.isGenerating}
              onClick={() => (form.isQuiz ? ai.generateQuiz(count, difficulty) : ai.generateExercise(difficulty))}
            >
              {form.isQuiz ? 'Ajouter les questions' : hasExercise ? 'Remplacer l’exercice' : 'Proposer l’exercice'}
            </Button>
          </div>
          {ai.unavailable && (
            <p role="alert" className="mt-2 text-sm text-amber-800">
              {ai.unavailable}
            </p>
          )}
        </>
      )}
    </section>
  );
}
