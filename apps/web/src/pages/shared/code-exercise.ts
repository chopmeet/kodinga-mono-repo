import type { CourseLesson, LessonCodeBlock } from '@/utils/api/course/course.type';

// A code exercise lesson. The api has fields for it (content: the statement, code_snippet: the
// starting code, code_blocks: "starter", "solution", test cases…), the ones its AI writes too.
// Lessons written before them keep it in their Markdown content, as two marked code blocks:
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
  /** The other blocks of the lesson (test cases of the AI…): kept, and shown to the learner */
  extras: LessonCodeBlock[];
};

export const EMPTY_EXERCISE: CodeExercise = { statement: '', language: 'python', starter: '', solution: '', extras: [] };

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
    extras: [],
  };
}

/** The Markdown content of an exercise (the empty parts are left out) */
export function composeExercise({ statement, language, starter, solution }: CodeExercise): string {
  const lang = language === 'autre' ? '' : language;
  const block = (mark: string, code: string) => `\`\`\`${lang} ${mark}\n${code.replace(/\n+$/, '')}\n\`\`\``;
  return [statement.trim(), starter.trim() && block(MARKS.starter, starter), solution.trim() && block(MARKS.solution, solution)].filter(Boolean).join('\n\n');
}

/** The exercise of a lesson: its fields, else its marked Markdown; null when it has neither */
export function exerciseOfLesson(lesson: Pick<CourseLesson, 'content' | 'code_language' | 'code_snippet' | 'code_blocks'>): CodeExercise | null {
  const blocks = lesson.code_blocks ?? [];
  const starter = lesson.code_snippet || blocks.find((b) => b.id === 'starter')?.code || '';
  if (!starter && blocks.length === 0) return parseExercise(lesson.content ?? '');
  return {
    statement: lesson.content ?? '',
    language: lesson.code_language || blocks[0]?.language || EMPTY_EXERCISE.language,
    starter,
    solution: blocks.find((b) => b.id === 'solution')?.code ?? '',
    extras: blocks.filter((b) => b.id !== 'starter' && b.id !== 'solution' && b.code !== starter),
  };
}

/** The fields of a lesson for an exercise */
export function exerciseFields({ statement, language, starter, solution, extras }: CodeExercise) {
  const lang = language === 'autre' ? '' : language;
  const block = (id: string, title: string, code: string): LessonCodeBlock => ({ id, title, language: lang, code: code.replace(/\n+$/, '') });
  return {
    content: statement.trim(),
    code_language: lang,
    code_snippet: starter.trim() ? starter.replace(/\n+$/, '') : '',
    code_blocks: [...(starter.trim() ? [block('starter', 'Code de départ', starter)] : []), ...(solution.trim() ? [block('solution', 'Solution de référence', solution)] : []), ...extras],
  };
}
