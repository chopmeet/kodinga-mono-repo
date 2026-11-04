import { customToast } from '@kodinga-mono-repo/ui';
import type { CodeExercise } from '@/pages/shared/code-exercise';
import type { AIDifficulty } from '@/utils/api/ai/ai.type';
import { useGenerateExerciseMutation, useGenerateQuizMutation } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import { generatedToQuestions, type QuizQuestionDraft } from './quiz-draft';

type Options = {
  courseSlug: string;
  lessonId: string;
  addQuestions: (questions: QuizQuestionDraft[]) => void;
  exercise: CodeExercise;
  setExercise: (exercise: CodeExercise) => void;
};

/**
 * A proposal of the AI, written from the saved content of the lesson, goes in the form: the author
 * reads it, and it is saved with the lesson like the rest (never directly, by apply-assessment).
 */
function UseLessonAI({ courseSlug, lessonId, addQuestions, exercise, setExercise }: Options) {
  const [askQuiz, { isLoading: isQuizLoading }] = useGenerateQuizMutation();
  const [askExercise, { isLoading: isExerciseLoading }] = useGenerateExerciseMutation();

  return {
    isGenerating: isQuizLoading || isExerciseLoading,
    generateQuiz: async (question_count: number, difficulty: AIDifficulty) => {
      try {
        const { questions } = await askQuiz({ courseSlug, lesson_id: lessonId, question_count, difficulty }).unwrap();
        const drafts = generatedToQuestions(questions);
        if (drafts.length === 0) return customToast.error({ message: 'L’IA n’a proposé aucune question exploitable : réessayez.' });
        addQuestions(drafts);
        customToast.success({ message: `${drafts.length} question${drafts.length > 1 ? 's' : ''} ajoutée${drafts.length > 1 ? 's' : ''} : relisez avant d’enregistrer.` });
      } catch (error) {
        customToast.error({ message: parseApiError(error).message });
      }
    },
    generateExercise: async (difficulty: AIDifficulty) => {
      try {
        const language = exercise.language === 'autre' ? undefined : exercise.language;
        const { exercise: e } = await askExercise({ courseSlug, lesson_id: lessonId, difficulty, language }).unwrap();
        setExercise({
          statement: e.instructions_markdown,
          language: e.language || exercise.language,
          starter: e.starter_code,
          solution: e.solution_code,
          extras: [
            ...exercise.extras.filter((b) => b.id !== 'test_cases'),
            ...(e.test_cases?.length ? [{ id: 'test_cases', title: 'Cas de test', language: 'json', code: JSON.stringify(e.test_cases, null, 2) }] : []),
          ],
        });
        customToast.success({ message: 'Exercice proposé : relisez avant d’enregistrer.' });
      } catch (error) {
        customToast.error({ message: parseApiError(error).message });
      }
    },
  };
}

export default UseLessonAI;
