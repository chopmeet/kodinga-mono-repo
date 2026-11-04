import type { GeneratedQuizQuestion } from '@/utils/api/ai/ai.type';
import type { QuizData, QuizQuestion } from '@/utils/api/course/course.type';

// A quiz while it is being written: every field is a text, the ids stay stable to keep the last
// attempts of the learners readable. The api validates it again (validate_and_normalize_quiz_data).

export type QuizOptionDraft = { id: string; text: string; is_correct: boolean };
export type QuizQuestionDraft = { id: string; question: string; multiple: boolean; explanation: string; points: number; options: QuizOptionDraft[] };
export type QuizDraft = { passing_score: string; questions: QuizQuestionDraft[] };

let lastId = 0;
const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(lastId += 1)}`;

export const emptyOption = (): QuizOptionDraft => ({ id: newId('opt'), text: '', is_correct: false });

export const emptyQuestion = (): QuizQuestionDraft => ({ id: newId('q'), question: '', multiple: false, explanation: '', points: 1, options: [emptyOption(), emptyOption()] });

export const EMPTY_QUIZ: QuizDraft = { passing_score: '50', questions: [] };

export const toQuizDraft = (quiz: QuizData | undefined): QuizDraft => ({
  passing_score: String(quiz?.passing_score ?? 50),
  questions: (quiz?.questions ?? []).map((q) => ({
    id: q.id,
    question: q.question,
    multiple: q.question_type === 'multiple_choice',
    explanation: q.explanation ?? '',
    points: q.points ?? 1,
    options: q.options.map((o) => ({ id: o.id, text: o.text, is_correct: !!o.is_correct })),
  })),
});

/** The questions proposed by the AI (one right answer, by position); the ones it wrote badly are left out */
export const generatedToQuestions = (generated: GeneratedQuizQuestion[]): QuizQuestionDraft[] =>
  generated
    .filter((q) => q.question?.trim() && Array.isArray(q.options) && q.options.length >= 2)
    .map((q) => ({
      ...emptyQuestion(),
      question: q.question,
      explanation: q.explanation ?? '',
      options: q.options.map((text, i) => ({ ...emptyOption(), text: String(text), is_correct: i === q.correct_index })),
    }));

/** What is wrong in the quiz, said for the creator; null when it can be sent */
export function checkQuiz(draft: QuizDraft): string | null {
  const score = Number(draft.passing_score);
  if (!draft.passing_score.trim() || Number.isNaN(score) || score < 0 || score > 100) return 'Le score pour réussir est un pourcentage entre 0 et 100.';
  if (draft.questions.length === 0) return 'Ajoutez au moins une question au quiz.';
  for (const [i, q] of draft.questions.entries()) {
    const name = `Question ${i + 1}`;
    if (!q.question.trim()) return `${name} : écrivez l’énoncé.`;
    if (q.options.length < 2) return `${name} : proposez au moins 2 choix.`;
    if (q.options.some((o) => !o.text.trim())) return `${name} : un choix est vide.`;
    const correct = q.options.filter((o) => o.is_correct).length;
    if (correct === 0) return `${name} : indiquez la bonne réponse.`;
    if (!q.multiple && correct > 1) return `${name} : une seule bonne réponse pour un choix unique.`;
  }
  return null;
}

export const toQuizData = (draft: QuizDraft): QuizData => ({
  passing_score: Number(draft.passing_score),
  questions: draft.questions.map(
    (q): QuizQuestion => ({
      id: q.id,
      question: q.question.trim(),
      question_type: q.multiple ? 'multiple_choice' : 'single_choice',
      points: q.points,
      explanation: q.explanation.trim(),
      options: q.options.map((o) => ({ id: o.id, text: o.text.trim(), is_correct: o.is_correct })),
    }),
  ),
});
