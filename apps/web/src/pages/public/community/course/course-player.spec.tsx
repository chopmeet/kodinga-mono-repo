import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { User } from '@/utils/api/user/user.type';

vi.setConfig({ testTimeout: 15_000 });

const URL_PATH = '/communities/abidjan-react/courses/react-19';
const LESSONS = [
  { id: 'l1', title: 'Les hooks', content: '# Les hooks\n\nUn hook **commence** par `use`.' },
  { id: 'l2', title: 'Server Components', content: 'Rendus **côté serveur**.' },
];

type Call = { method: string; url: URL; body: Record<string, unknown> | null };

/** A sequential course of two lessons; enroll / progress like the api (unlock, percent) */
function stubCourseApi({ member = true, slowCourse = false, video = '', finished = false, exercise = false, quiz = false, embed = false } = {}) {
  let enrolled = finished;
  const done = new Set<string>(finished ? LESSONS.map((l) => l.id) : []);
  const calls: Call[] = [];
  const outline = () =>
    LESSONS.map((l, i) => ({
      id: l.id,
      module: 'm1',
      title: l.title,
      slug: l.id,
      lesson_type: quiz && i === LESSONS.length - 1 ? 'quiz' : exercise && i === 0 ? 'code' : 'text',
      content_format: 'markdown',
      duration_seconds: 300,
      order: i,
      is_free_preview: false,
      is_completed: done.has(l.id),
      is_locked: i > 0 && !done.has(LESSONS[i - 1].id),
    }));
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ method: request.method, url, body });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    const path = url.pathname;

    if (path.endsWith('/communities/abidjan-react/')) {
      return json({
        success: true,
        data: {
          id: 'c1', name: 'Abidjan React', slug: 'abidjan-react', privacy_type: 'public', pricing_type: 'free', members_count: 40, owner: { id: 'o', username: 'o' },
          user_membership: member ? { is_member: true, role: 'member', status: 'active' } : { is_member: false, role: null, status: null },
        },
      });
    }
    if (path.endsWith('/courses/react-19/enroll/')) {
      enrolled = true;
      return json({ success: true, data: { progress_percent: 0 } });
    }
    const progressId = path.match(/lessons\/([^/]+)\/progress\/$/)?.[1];
    if (progressId) {
      if (body?.is_completed) done.add(progressId);
      else done.delete(progressId);
      enrolled = true;
      return json({ success: true, data: { is_completed: body?.is_completed } });
    }
    if (path.endsWith('/lessons/l2/quiz/submit/')) {
      const right = body?.answers?.q1?.[0] === 'a' && [...(body?.answers?.q2 ?? [])].sort().join() === 'a,b';
      if (right) done.add('l2');
      const results = [
        { question_id: 'q1', question: 'Un hook commence par ?', question_type: 'single_choice', selected_option_ids: body?.answers?.q1, correct_option_ids: ['a'], is_correct: body?.answers?.q1?.[0] === 'a', points_earned: 1, points_possible: 1, explanation: 'C’est la convention de React.' },
        { question_id: 'q2', question: 'Quels hooks existent ?', question_type: 'multiple_choice', selected_option_ids: body?.answers?.q2, correct_option_ids: ['a', 'b'], is_correct: right, points_earned: 1, points_possible: 1, explanation: '' },
      ];
      return json({ success: true, data: { score_percent: right ? 100 : 50, passing_score: 70, passed: right, earned_points: right ? 2 : 1, total_points: 2, correct_questions_count: right ? 2 : 1, total_questions_count: 2, submitted_at: '2026-11-04T10:00:00Z', question_results: results, just_completed_course: right } });
    }
    const lessonId = path.match(/courses\/react-19\/lessons\/([^/]+)\/$/)?.[1];
    if (lessonId) {
      const l = outline().find((x) => x.id === lessonId);
      if (l?.is_locked) return json({ success: false, code: 'permission_denied', message: 'Leçon verrouillée.' }, 403);
      // video: the url of the first lesson's video, or "preparing" while Mux encodes it
      const media = lessonId === 'l1' && video ? { has_video: true, video_status: video === 'preparing' ? 'preparing' : 'ready', video_source_url: video === 'preparing' ? '' : video } : {};
      const content = exercise && lessonId === 'l1' ? 'Écrivez un hook.\n\n```typescript exercice\nfunction useToggle() {}\n```\n\n```typescript solution\nfunction useToggle() { return useState(false); }\n```' : LESSONS.find((x) => x.id === lessonId)?.content;
      // As a learner gets it: no is_correct
      const quizData = quiz && lessonId === 'l2' ? { quiz_data: { passing_score: 70, questions: [
        { id: 'q1', question: 'Un hook commence par ?', question_type: 'single_choice', points: 1, options: [{ id: 'a', text: 'use' }, { id: 'b', text: 'get' }] },
        { id: 'q2', question: 'Quels hooks existent ?', question_type: 'multiple_choice', points: 1, options: [{ id: 'a', text: 'useState' }, { id: 'b', text: 'useEffect' }, { id: 'c', text: 'useBanana' }] },
      ] } } : {};
      const embedded = embed && lessonId === 'l1' ? { has_video: true, video_status: 'ready', video_provider: 'youtube', video_source_url: 'https://www.youtube.com/watch?v=abc123', video_embed_url: 'https://www.youtube.com/embed/abc123' } : {};
      return json({ success: true, data: { ...l, ...media, ...embedded, ...quizData, content, estimated_duration_display: '5 min' } });
    }
    if (path.endsWith('/communities/abidjan-react/gamification/rules/')) {
      return json({ success: true, data: [{ id: 'r1', action: 'course_completed', label: 'Formation achevée', description: '', points: 50, default_points: 50, is_active: true, allow_multiple_per_reference: false, updated_at: '' }] });
    }
    if (path.endsWith('/communities/abidjan-react/courses/')) {
      const course = (slug: string, title: string, user_progress_percent: number) => ({ id: slug, slug, title, description: '', level: 'beginner', thumbnail_url: '', lessons_count: 2, duration_seconds: 0, user_progress_percent });
      return json({ success: true, pagination: { count: 2 }, results: [course('react-19', 'React 19 de A à Z', 50), course('typescript', 'TypeScript', 0)] });
    }
    if (path.endsWith('/courses/react-19/')) {
      // A slow network: the course comes back after the progress
      if (slowCourse && done.size > 0) await new Promise((r) => setTimeout(r, 400));
      return json({
        success: true,
        data: {
          id: 'k1', title: 'React 19 de A à Z', slug: 'react-19', description: '', level: 'intermediate', thumbnail_url: '', is_published: true, is_sequential: true,
          modules_count: 1, lessons_count: 2, duration_seconds: 600, user_is_enrolled: enrolled, user_progress_percent: (done.size / LESSONS.length) * 100,
          modules: [{ id: 'm1', title: 'Les bases', description: '', order: 0, lessons_count: 2, lessons: outline() }],
        },
      });
    }
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
  });
  return calls;
}

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '');
const signIn = () =>
  act(() => {
    store.dispatch(onSetUserToken({ user: { id: 'u1', username: 'fatou' } as User, token: `${b64({ alg: 'HS256' })}.${b64({ exp: 4102444800 })}.sig`, refresh: 'r' }));
  });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(onLogout());
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Course player (member)', () => {
  it('starts the course, follows it lesson by lesson, and celebrates the end', async () => {
    signIn();
    const calls = stubCourseApi();
    const { where } = renderAppAt(URL_PATH);
    expect(await screen.findByRole('heading', { level: 1, name: 'React 19 de A à Z' }, SLOW)).toBeTruthy();

    // Sequential: the second lesson waits for the first one
    const plan = screen.getByRole('navigation', { name: 'Plan de la formation' });
    expect(within(plan).getByRole('button', { name: /Server Components/ })).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('button', { name: /Commencer la formation/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.pathname.endsWith('/react-19/enroll/'))).toBe(true), SLOW);
    await waitFor(() => expect(where()).toBe(`${URL_PATH}?lesson=l1`), SLOW);
    // The Markdown of the lesson, as elements
    expect(await screen.findByRole('heading', { name: 'Les hooks', level: 2 }, SLOW)).toBeTruthy();
    expect(screen.getByText('commence').tagName).toBe('STRONG');

    fireEvent.click(screen.getByRole('button', { name: /Terminer et continuer/ }));
    await waitFor(() => expect(calls.find((c) => c.url.pathname.endsWith('/lessons/l1/progress/'))?.body).toEqual({ is_completed: true }), SLOW);
    await waitFor(() => expect(where()).toBe(`${URL_PATH}?lesson=l2`), SLOW);
    expect(await screen.findByRole('heading', { level: 1, name: 'Server Components' }, SLOW)).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('progressbar', { name: 'Progression de la formation' }).getAttribute('aria-valuenow')).toBe('50'), SLOW);

    fireEvent.click(screen.getByRole('button', { name: /Marquer comme terminée/ }));
    // Once the api says the course is done: the congratulations, with what was achieved
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    expect(within(dialog).getByRole('heading', { name: 'Félicitations !' })).toBeTruthy();
    // The logo, not a link (the learner stays on the course)
    expect(within(dialog).getByRole('img', { name: 'Kodinga' })).toBeTruthy();
    expect(within(dialog).queryByRole('link', { name: /Kodinga/ })).toBeNull();
    expect(within(dialog).getByText('« React 19 de A à Z »')).toBeTruthy();
    const achieved = within(dialog).getByRole('group', { name: 'Ce que vous avez accompli' });
    expect(achieved.textContent).toMatch(/2leçons suivies/);
    expect(await within(achieved).findByText('+50', {}, SLOW)).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: 'Suivre une autre formation' }).getAttribute('href')).toBe('/communities/abidjan-react?tab=classroom');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Revoir la formation' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), SLOW);
    expect(screen.getByText('Formation terminée, bravo !')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Progression de la formation' }).getAttribute('aria-valuenow')).toBe('100');
  });

  it('does not congratulate again when a finished course is opened', async () => {
    signIn();
    stubCourseApi({ finished: true });
    renderAppAt(`${URL_PATH}?lesson=l2`);
    expect(await screen.findByText('Formation terminée, bravo !', {}, SLOW)).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the courses for the members of the community', async () => {
    signIn();
    const calls = stubCourseApi({ member: false });
    renderAppAt(URL_PATH);
    expect(await screen.findByRole('heading', { name: 'Réservé aux membres' }, SLOW)).toBeTruthy();
    expect(calls.some((c) => c.url.pathname.endsWith('/courses/react-19/'))).toBe(false);
  });

  it('opens a course from the "Formations" tab, to discover it or to continue it', async () => {
    signIn();
    stubCourseApi();
    renderAppAt('/communities/abidjan-react?tab=classroom');
    const list = await screen.findByRole('list', { name: 'Formations' }, SLOW);
    expect(within(list).getByRole('link', { name: /Continuer/ }).getAttribute('href')).toBe(URL_PATH);
    expect(within(list).getByRole('link', { name: /Découvrir le parcours/ }).getAttribute('href')).toBe('/communities/abidjan-react/courses/typescript');
  });

  it('plays the video of a lesson, or says it is being prepared', async () => {
    signIn();
    stubCourseApi({ video: 'https://cdn.example.com/hooks.mp4' });
    renderAppAt(`${URL_PATH}?lesson=l1`);
    await screen.findByRole('heading', { level: 1, name: 'Les hooks' }, SLOW);
    expect(document.querySelector('video')?.getAttribute('src')).toBe('https://cdn.example.com/hooks.mp4');
    cleanup();
    act(() => {
      store.dispatch(CommunityApi.util.resetApiState());
    });

    vi.restoreAllMocks();
    stubCourseApi({ video: 'preparing' });
    renderAppAt(`${URL_PATH}?lesson=l1`);
    expect(await screen.findByText(/La vidéo est en cours de préparation/, {}, SLOW)).toBeTruthy();
    expect(document.querySelector('video')).toBeNull();
  });

  it('never shows the next lesson as locked while the course reloads', async () => {
    signIn();
    stubCourseApi({ slowCourse: true });
    const { where } = renderAppAt(`${URL_PATH}?lesson=l1`);
    fireEvent.click(await screen.findByRole('button', { name: /Terminer et continuer/ }, SLOW));
    await waitFor(() => expect(where()).toBe(`${URL_PATH}?lesson=l2`), SLOW);
    // Right when the next lesson opens, it is already unlocked
    expect(screen.queryByText('Leçon verrouillée')).toBeNull();
    expect(await screen.findByRole('heading', { level: 1, name: 'Server Components' }, SLOW)).toBeTruthy();
  });

  it('shows a code exercise: the statement, the starting code, the solution on demand', async () => {
    signIn();
    stubCourseApi({ exercise: true, finished: true });
    renderAppAt(`${URL_PATH}?lesson=l1`);
    expect(await screen.findByText('Écrivez un hook.', {}, SLOW)).toBeTruthy();
    const starter = screen.getByRole('region', { name: 'À vous de jouer' });
    expect(within(starter).getByText('TypeScript')).toBeTruthy();
    expect(within(starter).getByRole('button', { name: 'Copier le code TypeScript' })).toBeTruthy();
    // Hidden until asked
    const solution = screen.getByRole('region', { name: 'Solution' });
    expect(within(solution).queryByText(/return useState/)).toBeNull();
    fireEvent.click(within(solution).getByRole('button', { name: 'Voir la solution' }));
    expect(within(solution).getByText(/return/)).toBeTruthy();
  });

  it('runs a quiz: one question at a time, the score, the correction, then the end of the course', async () => {
    signIn();
    const calls = stubCourseApi({ quiz: true });
    // The first lesson done, the quiz is open
    renderAppAt(URL_PATH);
    fireEvent.click(await screen.findByRole('button', { name: /Commencer la formation/ }, SLOW));
    fireEvent.click(await screen.findByRole('button', { name: /Terminer et continuer/ }, SLOW));
    const quiz = await screen.findByRole('region', { name: 'Quiz' }, SLOW);
    expect(within(quiz).getByText('Question 1 sur 2')).toBeTruthy();
    // Done by passing it, not by hand
    expect(screen.queryByRole('button', { name: /Marquer comme terminée/ })).toBeNull();
    expect(screen.getByText('Réussissez le quiz pour terminer cette leçon.')).toBeTruthy();

    // A single answer, then several
    fireEvent.click(within(quiz).getByRole('radio', { name: 'get' }));
    fireEvent.click(within(quiz).getByRole('radio', { name: 'use' }));
    expect(within(quiz).getByRole('radio', { name: 'get' })).toHaveProperty('checked', false);
    fireEvent.click(within(quiz).getByRole('button', { name: /Question suivante/ }));
    expect(within(quiz).getByText('Plusieurs réponses possibles')).toBeTruthy();
    // Not answered: said, nothing is sent
    fireEvent.click(within(quiz).getByRole('button', { name: /Valider mes réponses/ }));
    expect(within(quiz).getByRole('alert').textContent).toBe('Répondez à la question 2 avant de valider.');
    expect(calls.some((c) => c.url.pathname.endsWith('/quiz/submit/'))).toBe(false);

    // Failed: the score, the correction, start again
    fireEvent.click(within(quiz).getByRole('checkbox', { name: 'useState' }));
    fireEvent.click(within(quiz).getByRole('button', { name: /Valider mes réponses/ }));
    const score = await screen.findByRole('region', { name: 'Résultat du quiz' }, SLOW);
    expect(score.textContent).toMatch(/50 %/);
    expect(score.textContent).toMatch(/Il faut 70 % pour réussir/);
    expect(calls.find((c) => c.url.pathname.endsWith('/quiz/submit/'))?.body).toEqual({ answers: { q1: ['a'], q2: ['a'] } });
    const correction = screen.getByRole('list', { name: 'Correction' });
    expect(within(correction).getByText('C’est la convention de React.')).toBeTruthy();
    expect(within(correction).getAllByText('Bonne réponse').length).toBeGreaterThan(0);

    // Passed: the course is done
    fireEvent.click(within(score).getByRole('button', { name: /Recommencer/ }));
    const again = await screen.findByRole('region', { name: 'Quiz' }, SLOW);
    fireEvent.click(within(again).getByRole('radio', { name: 'use' }));
    fireEvent.click(within(again).getByRole('button', { name: /Question suivante/ }));
    fireEvent.click(within(again).getByRole('checkbox', { name: 'useState' }));
    fireEvent.click(within(again).getByRole('checkbox', { name: 'useEffect' }));
    fireEvent.click(within(again).getByRole('button', { name: /Valider mes réponses/ }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    expect(within(dialog).getByRole('heading', { name: 'Félicitations !' })).toBeTruthy();
  });

  it('plays a video of a platform in its own player', async () => {
    signIn();
    stubCourseApi({ embed: true, finished: true });
    renderAppAt(`${URL_PATH}?lesson=l1`);
    const player = await screen.findByTitle('Vidéo : Les hooks', {}, SLOW);
    expect(player.getAttribute('src')).toBe('https://www.youtube.com/embed/abc123');
  });
});
