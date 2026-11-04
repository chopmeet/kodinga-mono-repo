import { composeExercise, exerciseFields, exerciseOfLesson, parseExercise } from './code-exercise';

const exercise = { statement: '## Objectif\n\nAdditionnez deux nombres.', language: 'python', starter: 'def add(a, b):\n    pass', solution: 'def add(a, b):\n    return a + b', extras: [] };

describe('code exercise in Markdown', () => {
  it('writes the statement then the two marked blocks, and reads them back', () => {
    const content = composeExercise(exercise);
    expect(content).toBe('## Objectif\n\nAdditionnez deux nombres.\n\n```python exercice\ndef add(a, b):\n    pass\n```\n\n```python solution\ndef add(a, b):\n    return a + b\n```');
    expect(parseExercise(content)).toEqual(exercise);
  });

  it('leaves out the empty parts, and keeps "autre" without a language', () => {
    const content = composeExercise({ ...exercise, language: 'autre', solution: '' });
    expect(content).not.toMatch(/solution/);
    expect(content).toMatch(/^```\s+exercice$/m);
    expect(parseExercise(content)).toMatchObject({ starter: 'def add(a, b):\n    pass', solution: '' });
  });

  it('keeps the other code blocks of the statement in it', () => {
    const content = `Exemple :\n\n\`\`\`python\nprint(1)\n\`\`\`\n\n\`\`\`python exercice\nx = 1\n\`\`\``;
    expect(parseExercise(content)).toMatchObject({ statement: 'Exemple :\n\n```python\nprint(1)\n```', starter: 'x = 1' });
  });

  it('says when a lesson was written as plain text', () => {
    expect(parseExercise('Un texte avec du code :\n\n```js\nlet a = 1\n```')).toBeNull();
  });

  it('reads and writes the fields of the api, keeping the other blocks', () => {
    const tests = { id: 'test_cases', title: 'Cas de test', language: 'json', code: '[]' };
    const fields = exerciseFields({ ...exercise, extras: [tests] });
    expect(fields).toEqual({
      content: exercise.statement,
      code_language: 'python',
      code_snippet: exercise.starter,
      code_blocks: [
        { id: 'starter', title: 'Code de départ', language: 'python', code: exercise.starter },
        { id: 'solution', title: 'Solution de référence', language: 'python', code: exercise.solution },
        tests,
      ],
    });
    expect(exerciseOfLesson(fields)).toEqual({ ...exercise, extras: [tests] });
  });

  it('still reads a lesson written in marked Markdown, and nothing from a plain text', () => {
    expect(exerciseOfLesson({ content: composeExercise(exercise), code_snippet: '', code_blocks: [] })).toEqual(exercise);
    expect(exerciseOfLesson({ content: 'Un texte', code_snippet: '', code_blocks: [] })).toBeNull();
  });
});
