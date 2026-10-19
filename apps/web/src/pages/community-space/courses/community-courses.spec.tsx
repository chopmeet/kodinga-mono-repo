import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { Course } from '@/utils/api/course/course.type';

vi.setConfig({ testTimeout: 20_000 });

const lesson = (id: string, title: string, order: number) => ({
  id,
  module: 'm1',
  title,
  slug: id,
  lesson_type: 'text' as const,
  content_format: 'markdown' as const,
  cover_image_url: '',
  duration_seconds: 600,
  estimated_duration_display: '10 min',
  has_video: false,
  order,
  is_free_preview: order === 0,
});

const course = (slug: string, title: string, published: boolean, withProgram: boolean): Course => ({
  id: slug,
  title,
  slug,
  description: 'Les bases de Kubernetes en pratique.',
  level: 'beginner',
  thumbnail_url: '',
  is_published: published,
  is_sequential: true,
  order: 0,
  modules_count: withProgram ? 1 : 0,
  lessons_count: withProgram ? 2 : 0,
  duration_seconds: withProgram ? 1200 : 0,
  duration_minutes: withProgram ? 20 : 0,
  created_at: '2026-10-01T10:00:00Z',
  modules: withProgram
    ? [{ id: 'm1', title: 'Premiers pas', description: '', order: 0, lessons_count: 2, lessons: [lesson('l1', 'Installer kubectl', 0), lesson('l2', 'Votre premier pod', 1)] }]
    : [],
});

type Call = { method: string; url: URL; body: Record<string, unknown> | null };

/** Fake courses api of dakar-devops */
function stubCoursesApi() {
  const courses = [course('k8s', 'Kubernetes de A à Z', true, true), course('ci', 'CI/CD avec GitHub Actions', false, false)];
  const calls: Call[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    // A multipart body holding a File never resolves in jsdom: the tests spy FormData instead
    const multipart = request.headers.get('Content-Type')?.startsWith('multipart/form-data');
    const text = request.method === 'GET' || multipart ? '' : await request.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ method: request.method, url, body });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    const path = url.pathname;
    const courseSlug = path.match(/courses\/([^/]+)\//)?.[1];

    if (path.endsWith('/communities/dakar-devops/courses/')) {
      if (request.method === 'POST') return json({ success: true, data: { ...course('docker', String(body?.title), false, false), ...body } }, 201);
      const published = url.searchParams.get('is_published');
      const found = courses.filter((c) => published === null || String(c.is_published) === published);
      return json({ success: true, pagination: { count: found.length }, results: found });
    }
    if (path.endsWith('/video/')) return json({ success: true, data: { ...lesson('new', 'Vidéo', 2), lesson_type: 'video', has_video: true } });
    if (path.endsWith('/modules/') || path.endsWith('/lessons/')) return json({ success: true, data: { id: 'new', ...body, lessons: [] } }, 201);
    if (request.method === 'PATCH') return json({ success: true, data: { id: 'x', ...body } });
    if (courseSlug && request.method === 'GET') return json({ success: true, data: courses.find((c) => c.slug === courseSlug) ?? course(courseSlug, 'Docker', false, false) });
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
  });
  return calls;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Community space: courses', () => {
  it('lists the courses and filters the drafts', async () => {
    const calls = stubCoursesApi();
    renderAppAt('/c/dakar-devops/courses');
    expect(await screen.findByRole('link', { name: 'Kubernetes de A à Z' }, SLOW)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Brouillons' }));
    await waitFor(() => expect(calls.at(-1)?.url.searchParams.get('is_published')).toBe('false'), SLOW);
  });

  it('creates a course as a draft and opens its editor', async () => {
    const calls = stubCoursesApi();
    const { where } = renderAppAt('/c/dakar-devops/courses');
    fireEvent.click(await screen.findByRole('button', { name: /Nouvelle formation/ }, SLOW));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText(/^Titre/), { target: { value: 'Docker pour débutants' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Créer la formation' }));
    await waitFor(() => expect(where()).toBe('/c/dakar-devops/courses/docker'), SLOW);
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ title: 'Docker pour débutants', is_published: false, is_sequential: true });
  });

  it('builds the program: a module, then a lesson in it', async () => {
    const calls = stubCoursesApi();
    renderAppAt('/c/dakar-devops/courses/k8s');
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter un module/ }, SLOW));
    let dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText('Titre'), { target: { value: 'Déploiements' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ajouter le module' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.pathname.endsWith('/k8s/modules/'))).toBe(true), SLOW);
    expect(calls.find((c) => c.url.pathname.endsWith('/k8s/modules/'))?.body).toEqual({ title: 'Déploiements', description: '', order: 1 });

    fireEvent.click(screen.getByRole('button', { name: /Ajouter une leçon/ }));
    dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText('Titre'), { target: { value: 'Les services' } });
    fireEvent.change(within(dialog).getByLabelText('Contenu'), { target: { value: '## Les services\n\nExposer un pod.' } });
    fireEvent.change(within(dialog).getByLabelText('Durée (min)'), { target: { value: '15' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ajouter la leçon' }));
    await waitFor(() => expect(calls.some((c) => c.url.pathname.endsWith('/modules/m1/lessons/'))).toBe(true), SLOW);
    expect(calls.find((c) => c.url.pathname.endsWith('/modules/m1/lessons/'))?.body).toMatchObject({
      title: 'Les services',
      lesson_type: 'text',
      content_format: 'markdown',
      duration_seconds: 900,
      order: 2,
    });
  });

  it('adds a video lesson from a link, then sends its video', async () => {
    const calls = stubCoursesApi();
    const append = vi.spyOn(FormData.prototype, 'append');
    renderAppAt('/c/dakar-devops/courses/k8s');
    fireEvent.click((await screen.findAllByRole('button', { name: /Ajouter une leçon/ }, SLOW))[0]);
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText('Titre'), { target: { value: 'Démo kubectl' } });
    fireEvent.change(within(dialog).getByLabelText('Type'), { target: { value: 'video' } });

    // A video lesson needs its video
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ajouter la leçon' }));
    expect((await within(dialog).findByRole('alert', {}, SLOW)).textContent).toMatch(/Ajoutez la vidéo/);

    fireEvent.click(within(dialog).getByRole('radio', { name: /Lien/ }));
    const link = within(dialog).getByLabelText('Lien de la vidéo');
    fireEvent.change(link, { target: { value: 'https://youtu.be/abc' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ajouter la leçon' }));
    expect((await within(dialog).findByRole('alert', {}, SLOW)).textContent).toMatch(/YouTube/);
    expect(calls.some((c) => c.method === 'POST' && c.url.pathname.endsWith('/lessons/'))).toBe(false);

    fireEvent.change(link, { target: { value: 'https://cdn.example.com/demo.mp4' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ajouter la leçon' }));
    await waitFor(() => expect(calls.some((c) => c.url.pathname.endsWith('/lessons/new/video/'))).toBe(true), SLOW);
    expect(calls.find((c) => c.url.pathname.endsWith('/modules/m1/lessons/'))?.body).toMatchObject({ title: 'Démo kubectl', lesson_type: 'video' });
    expect(append).toHaveBeenCalledWith('video_url', 'https://cdn.example.com/demo.mp4');
  });

  it('sends the chosen video file of a lesson', async () => {
    const calls = stubCoursesApi();
    const append = vi.spyOn(FormData.prototype, 'append');
    renderAppAt('/c/dakar-devops/courses/k8s');
    fireEvent.click((await screen.findAllByRole('button', { name: /Ajouter une leçon/ }, SLOW))[0]);
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText('Titre'), { target: { value: 'Démo kubectl' } });
    fireEvent.change(within(dialog).getByLabelText('Type'), { target: { value: 'video' } });
    const input = within(dialog).getByLabelText('Fichier vidéo');
    fireEvent.change(input, { target: { files: [new File(['%PDF'], 'notes.pdf', { type: 'application/pdf' })] } });
    expect((await within(dialog).findByRole('alert', {}, SLOW)).textContent).toMatch(/Format non pris en charge/);
    fireEvent.change(input, { target: { files: [new File(['video'], 'demo.mp4', { type: 'video/mp4' })] } });
    expect(within(dialog).getByText('demo.mp4')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ajouter la leçon' }));
    await waitFor(() => expect(calls.some((c) => c.url.pathname.endsWith('/lessons/new/video/'))).toBe(true), SLOW);
    expect(append).toHaveBeenCalledWith('video', expect.objectContaining({ name: 'demo.mp4' }));
  });

  it('reorders two lessons', async () => {
    const calls = stubCoursesApi();
    renderAppAt('/c/dakar-devops/courses/k8s');
    fireEvent.click(await screen.findByRole('button', { name: 'Descendre la leçon Installer kubectl' }, SLOW));
    await waitFor(() => expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(2), SLOW);
    const patches = calls.filter((c) => c.method === 'PATCH').map((c) => [c.url.pathname.split('/').at(-2), c.body?.order]);
    expect(patches).toEqual(expect.arrayContaining([['l1', 1], ['l2', 0]]));
  });

  it('does not publish a course without lessons', async () => {
    const calls = stubCoursesApi();
    renderAppAt('/c/dakar-devops/courses/ci');
    fireEvent.click(await screen.findByRole('button', { name: 'Publier' }, SLOW));
    expect(await screen.findByText('Ajoutez au moins une leçon avant de publier.', {}, SLOW)).toBeTruthy();
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('lets a moderator browse the courses, not edit them', async () => {
    stubCoursesApi();
    renderAppAt('/c/python-africa-core/courses');
    await screen.findByRole('heading', { name: 'Formations' }, SLOW);
    expect(screen.queryByRole('button', { name: /Nouvelle formation/ })).toBeNull();
  });
});
