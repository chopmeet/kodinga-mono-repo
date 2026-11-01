import type { KeyboardEvent } from 'react';

import { CODE_LANGUAGE_OPTIONS, CodeBlock } from '@/pages/shared/code-block';
import type { CodeExercise } from '@/pages/shared/code-exercise';

type Props = { value: CodeExercise; onChange: (value: CodeExercise) => void };

const codeClass = 'custom-form-control bg-background px-4 py-3 font-mono text-sm [tab-size:2]';

/** Keeps the Tab key in a code field (an indentation, not the next field) */
function indentOnTab(e: KeyboardEvent<HTMLTextAreaElement>, onValue: (v: string) => void) {
  if (e.key !== 'Tab' || e.shiftKey) return;
  e.preventDefault();
  const el = e.currentTarget;
  const { selectionStart: start, selectionEnd: end, value } = el;
  onValue(`${value.slice(0, start)}  ${value.slice(end)}`);
  requestAnimationFrame(() => el.setSelectionRange(start + 2, start + 2));
}

/**
 * The parts of a code exercise lesson: the statement (Markdown), the language, the starting code
 * the learner copies, and the solution they open when they want. Previews in the colors of the lesson.
 */
export function CodeExerciseFields({ value, onChange }: Props) {
  const set = (patch: Partial<CodeExercise>) => onChange({ ...value, ...patch });

  return (
    <fieldset className="grid gap-3 sm:col-span-3" aria-label="Exercice de code">
      <label className="flex flex-col gap-1">
        <span className="custom-form-label">Énoncé</span>
        <textarea
          rows={6}
          value={value.statement}
          onChange={(e) => set({ statement: e.target.value })}
          placeholder={'## Objectif\n\nÉcrivez une fonction qui…'}
          className="custom-form-control bg-background px-4 py-3 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 sm:w-56">
        <span className="custom-form-label">Langage</span>
        <select value={value.language} onChange={(e) => set({ language: e.target.value })} className="custom-form-control bg-background px-3 py-2">
          {CODE_LANGUAGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 lg:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="custom-form-label">Code de départ</span>
          <textarea
            rows={8}
            spellCheck={false}
            value={value.starter}
            onChange={(e) => set({ starter: e.target.value })}
            onKeyDown={(e) => indentOnTab(e, (starter) => set({ starter }))}
            placeholder="Le squelette que l’apprenant complète"
            className={codeClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="custom-form-label">Solution (facultatif)</span>
          <textarea
            rows={8}
            spellCheck={false}
            value={value.solution}
            onChange={(e) => set({ solution: e.target.value })}
            onKeyDown={(e) => indentOnTab(e, (solution) => set({ solution }))}
            placeholder="Cachée à l’apprenant tant qu’il ne l’ouvre pas"
            className={codeClass}
          />
        </label>
      </div>
      {(value.starter.trim() || value.solution.trim()) && (
        <div role="group" aria-label="Aperçu de l'exercice" className="grid gap-3 lg:grid-cols-2">
          {value.starter.trim() && <CodeBlock code={value.starter} language={value.language} className="mt-0" />}
          {value.solution.trim() && <CodeBlock code={value.solution} language={value.language} className="mt-0 lg:col-start-2" />}
        </div>
      )}
    </fieldset>
  );
}
