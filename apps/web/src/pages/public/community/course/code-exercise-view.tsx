import { Eye, EyeOff, Lightbulb } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@kodinga-mono-repo/ui';
import { CodeBlock } from '@/pages/shared/code-block';
import type { CodeExercise } from '@/pages/shared/code-exercise';
import { Markdown } from '@/pages/shared/markdown';

/**
 * A code exercise in the course player: the statement, the starting code to copy into one's editor,
 * and the solution, hidden until the learner chooses to open it
 */
export function CodeExerciseView({ exercise }: { exercise: CodeExercise }) {
  const [showSolution, setShowSolution] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {exercise.statement && <Markdown source={exercise.statement} />}

      {exercise.starter && (
        <section aria-labelledby="exercise-starter">
          <h2 id="exercise-starter" className="text-base font-semibold text-slate-900">
            À vous de jouer
          </h2>
          <p className="mt-1 text-sm text-slate-500">Copiez ce code de départ dans votre éditeur et complétez-le.</p>
          <CodeBlock code={exercise.starter} language={exercise.language} className="mt-3" />
        </section>
      )}

      {exercise.extras.map((b) => (
        <section key={b.id} aria-label={b.title || 'Code'}>
          {b.title && <h2 className="text-base font-semibold text-slate-900">{b.title}</h2>}
          <CodeBlock code={b.code} language={b.language} className="mt-3" />
        </section>
      ))}

      {exercise.solution && (
        <section aria-labelledby="exercise-solution" className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="exercise-solution" className="flex items-center gap-2 text-base font-semibold text-amber-900">
              <Lightbulb className="size-4" aria-hidden /> Solution
            </h2>
            <Button variant="outline" size="sm" onClick={() => setShowSolution((v) => !v)} aria-expanded={showSolution} aria-controls="exercise-solution-code">
              {showSolution ? <EyeOff /> : <Eye />}
              {showSolution ? 'Masquer la solution' : 'Voir la solution'}
            </Button>
          </div>
          {showSolution ? (
            <div id="exercise-solution-code">
              <CodeBlock code={exercise.solution} language={exercise.language} className="mt-3" />
            </div>
          ) : (
            <p className="mt-1 text-sm text-amber-900/80">Essayez d’abord par vous-même : la solution reste là si vous bloquez.</p>
          )}
        </section>
      )}
    </div>
  );
}
