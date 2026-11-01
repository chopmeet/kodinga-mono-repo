// A code exercise lesson, kept in its Markdown content (the api has no field for it): the statement,
// then two marked code blocks. Still plain Markdown: any other reader shows two code blocks.
//
//   The statement…
//
//   ```python exercice
//   # starting code
//   ```
//
//   ```python solution
//   # solution
//   ```

export type CodeExercise = {
  /** Markdown */
  statement: string;
  /** As in the post form: "typescript", "python"… */
  language: string;
  starter: string;
  solution: string;
};

export const EMPTY_EXERCISE: CodeExercise = { statement: '', language: 'python', starter: '', solution: '' };

const MARKS = { starter: 'exercice', solution: 'solution' } as const;

/** One marked block: ```<language> <mark> … ``` (the language may be empty) */
const blockOf = (mark: string) => new RegExp('^```[ \\t]*([\\w+-]*)[ \\t]+' + mark + '[ \\t]*\\n([\\s\\S]*?)\\n?^```[ \\t]*$\\n?', 'm');

/** The exercise of a lesson; null when its content has no marked block (a lesson written as text) */
export function parseExercise(content: string): CodeExercise | null {
  const starter = content.match(blockOf(MARKS.starter));
  const solution = content.match(blockOf(MARKS.solution));
  if (!starter && !solution) return null;
  const statement = content.replace(blockOf(MARKS.starter), '').replace(blockOf(MARKS.solution), '').trim();
  return {
    statement,
    language: starter?.[1] || solution?.[1] || EMPTY_EXERCISE.language,
    starter: starter?.[2] ?? '',
    solution: solution?.[2] ?? '',
  };
}

/** The Markdown content of an exercise (the empty parts are left out) */
export function composeExercise({ statement, language, starter, solution }: CodeExercise): string {
  const lang = language === 'autre' ? '' : language;
  const block = (mark: string, code: string) => `\`\`\`${lang} ${mark}\n${code.replace(/\n+$/, '')}\n\`\`\``;
  return [statement.trim(), starter.trim() && block(MARKS.starter, starter), solution.trim() && block(MARKS.solution, solution)].filter(Boolean).join('\n\n');
}
