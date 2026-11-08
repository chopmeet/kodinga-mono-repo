import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@kodinga/ui';
import { emptyOption, emptyQuestion, type QuizDraft, type QuizOptionDraft, type QuizQuestionDraft } from '../form/quiz-draft';

type Props = { value: QuizDraft; onChange: (value: QuizDraft) => void };

/** The questions of a quiz lesson: statement, single or multiple choice, right answers, explanation */
export function QuizFields({ value, onChange }: Props) {
  const setQuestion = (id: string, patch: Partial<QuizQuestionDraft>) => onChange({ ...value, questions: value.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) });
  const setOption = (q: QuizQuestionDraft, optionId: string, patch: Partial<QuizOptionDraft>) =>
    setQuestion(q.id, { options: q.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)) });
  // Single choice: the right answer is unique
  const setCorrect = (q: QuizQuestionDraft, optionId: string, checked: boolean) =>
    setQuestion(q.id, { options: q.options.map((o) => (o.id === optionId ? { ...o, is_correct: checked } : q.multiple ? o : { ...o, is_correct: false })) });
  const setMultiple = (q: QuizQuestionDraft, multiple: boolean) => {
    let kept = false;
    // Back to a single choice: only the first right answer stays
    const options = multiple
      ? q.options
      : q.options.map((o) => {
          const is_correct = o.is_correct && !kept;
          kept = kept || is_correct;
          return { ...o, is_correct };
        });
    setQuestion(q.id, { multiple, options });
  };

  return (
    <fieldset className="grid gap-4 sm:col-span-3" aria-label="Quiz">
      <label className="flex flex-col gap-1 sm:w-56">
        <span className="custom-form-label">Score pour réussir (%)</span>
        <input
          inputMode="numeric"
          value={value.passing_score}
          onChange={(e) => onChange({ ...value, passing_score: e.target.value })}
          className="custom-form-control bg-background px-3 py-2"
        />
      </label>

      {value.questions.map((q, i) => (
        <section key={q.id} aria-label={`Question ${i + 1}`} className="grid gap-3 rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Question {i + 1}</p>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...value, questions: value.questions.filter((x) => x.id !== q.id) })} aria-label={`Retirer la question ${i + 1}`}>
              <Trash2 /> Retirer
            </Button>
          </div>
          <label className="flex flex-col gap-1">
            <span className="custom-form-label">Énoncé</span>
            <textarea rows={2} value={q.question} onChange={(e) => setQuestion(q.id, { question: e.target.value })} className="custom-form-control bg-background px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 sm:w-56">
            <span className="custom-form-label">Réponses attendues</span>
            <select value={q.multiple ? 'multiple' : 'single'} onChange={(e) => setMultiple(q, e.target.value === 'multiple')} className="custom-form-control bg-background px-3 py-2">
              <option value="single">Choix unique</option>
              <option value="multiple">Choix multiple</option>
            </select>
          </label>
          <ul className="grid gap-2" aria-label={`Choix de la question ${i + 1}`}>
            {q.options.map((o, j) => (
              <li key={o.id} className="flex items-center gap-2">
                <input
                  type={q.multiple ? 'checkbox' : 'radio'}
                  name={`correct-${q.id}`}
                  checked={o.is_correct}
                  onChange={(e) => setCorrect(q, o.id, e.target.checked)}
                  aria-label={`Bonne réponse : choix ${j + 1} de la question ${i + 1}`}
                  className="size-4 shrink-0 accent-emerald-700"
                />
                <input
                  value={o.text}
                  onChange={(e) => setOption(q, o.id, { text: e.target.value })}
                  placeholder={`Choix ${j + 1}`}
                  aria-label={`Choix ${j + 1} de la question ${i + 1}`}
                  className="custom-form-control min-w-0 flex-1 bg-background px-3 py-2 text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={q.options.length <= 2}
                  onClick={() => setQuestion(q.id, { options: q.options.filter((x) => x.id !== o.id) })}
                  aria-label={`Retirer le choix ${j + 1} de la question ${i + 1}`}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">Cochez la ou les bonnes réponses.</p>
          <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => setQuestion(q.id, { options: [...q.options, emptyOption()] })}>
            <Plus /> Ajouter un choix
          </Button>
          <label className="flex flex-col gap-1">
            <span className="custom-form-label">Explication (facultatif)</span>
            <textarea rows={2} value={q.explanation} onChange={(e) => setQuestion(q.id, { explanation: e.target.value })} placeholder="Affichée avec la correction" className="custom-form-control bg-background px-3 py-2 text-sm" />
          </label>
        </section>
      ))}

      <Button type="button" variant="outline" className="justify-self-start" onClick={() => onChange({ ...value, questions: [...value.questions, emptyQuestion()] })}>
        <Plus /> Ajouter une question
      </Button>
    </fieldset>
  );
}
