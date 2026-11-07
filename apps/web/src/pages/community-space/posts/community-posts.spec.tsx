import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { CommunityPostItem, PostType } from '@/utils/api/community/community.type';
import type { User } from '@/utils/api/user/user.type';

// Full app tree + Radix dialogs/menus: slow when the whole suite runs in parallel
vi.setConfig({ testTimeout: 15_000 });

const post = (id: string, title: string, post_type: PostType, extra: Partial<CommunityPostItem> = {}): CommunityPostItem => ({
  id,
  community_id: 'c',
  author: { id: 'u1', username: 'awa', first_name: 'Awa', last_name: 'Ndiaye', email: 'awa@example.com' } as User,
  title,
  content: 'Contenu de la publication.',
  post_type,
  is_pinned: false,
  is_locked: false,
  is_resolved: false,
  views_count: 40,
  reactions_count: 6,
  comments_count: 3,
  created_at: '2026-10-01T10:00:00Z',
  ...extra,
});

const POSTS = [
  post('p1', 'Bienvenue dans la communauté', 'announcement', { is_pinned: true }),
  post('p2', 'Comment typer un hook générique ?', 'question'),
  post('p3', 'Mon portfolio en React 19', 'project_showcase', { is_locked: true }),
  post('p4', '', 'discussion', { content: 'Qui vient au meetup de samedi à Abidjan ?' }),
];

type Call = { method: string; url: URL; body: Record<string, unknown> | null };

/** Fake feed api: type / q / pinned filters, pin, lock, delete */
function stubFeedApi() {
  let posts = [...POSTS];
  const calls: Call[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ method: request.method, url, body });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    const id = url.pathname.match(/posts\/([^/]+)\//)?.[1];

    if (id && url.pathname.endsWith('/pin/')) {
      posts = posts.map((p) => (p.id === id ? { ...p, is_pinned: !p.is_pinned } : p));
      return json({ success: true });
    }
    if (id && url.pathname.endsWith('/lock/')) {
      posts = posts.map((p) => (p.id === id ? { ...p, is_locked: !p.is_locked } : p));
      return json({ success: true });
    }
    if (id && request.method === 'DELETE') {
      posts = posts.filter((p) => p.id !== id);
      return json({ success: true });
    }
    if (url.pathname.endsWith('/ai/check-duplicates/')) {
      const similar = String(body?.title).toLowerCase().includes('hook');
      return json({ success: true, data: { has_duplicates: similar, count: similar ? 1 : 0, duplicates: similar ? [{ id: 'p2', title: 'Comment typer un hook générique ?', similarity_score: 0.91, url: '/communities/frontend-francophone/posts/p2', snippet: '', is_solved: true }] : [] } });
    }
    if (url.pathname.endsWith('/feed/') && request.method === 'POST') {
      const created = post('p9', String(body?.title ?? ''), body?.post_type, { content: String(body?.content), created_at: '2026-10-17T10:00:00Z' });
      posts = [created, ...posts];
      return json({ success: true, data: created }, 201);
    }
    if (id && request.method === 'PATCH') {
      posts = posts.map((p) => (p.id === id ? { ...p, ...body } : p));
      return json({ success: true, data: posts.find((p) => p.id === id) });
    }
    if (url.pathname.endsWith('/feed/')) {
      const p = url.searchParams;
      const q = (p.get('q') ?? '').toLowerCase();
      const found = posts.filter(
        (x) =>
          (!p.get('type') || x.post_type === p.get('type')) &&
          (p.get('pinned') !== 'true' || x.is_pinned) &&
          (p.get('locked') !== 'true' || x.is_locked) &&
          (!q || `${x.title} ${x.content}`.toLowerCase().includes(q)),
      );
      const size = Number(p.get('page_size') ?? 20);
      return json({ success: true, pagination: { count: found.length }, results: found.slice(0, size) });
    }
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
  });
  return calls;
}

const openMenu = async (label: string) => {
  const trigger = await screen.findByRole('button', { name: label }, SLOW);
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
  return screen.findByRole('menu', {}, SLOW);
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(onLogout());
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Community space: posts', () => {
  it('lists the feed, an untitled discussion by its first words, and the pinned ones on demand', async () => {
    const calls = stubFeedApi();
    renderAppAt('/c/frontend-francophone/posts');
    // The table is rendered again once loaded (skeleton first)
    await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(POSTS.length + 1), SLOW);
    const table = screen.getByRole('table');
    expect(within(table).getByText('Qui vient au meetup de samedi à Abidjan ?')).toBeTruthy();
    expect(within(table).getAllByText(/par Awa Ndiaye/)).toHaveLength(POSTS.length);

    fireEvent.click(await screen.findByRole('button', { name: /Épinglées 1/ }, SLOW));
    await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2), SLOW);
    expect(calls.some((c) => c.url.searchParams.get('pinned') === 'true' && c.url.searchParams.get('page_size') === '10')).toBe(true);
    // The posts whose comments are closed, filtered by the api
    fireEvent.click(screen.getByRole('button', { name: /Verrouillées 1/ }));
    expect(await within(screen.getByRole('table')).findByText('Mon portfolio en React 19', {}, SLOW)).toBeTruthy();
    await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2), SLOW);
    expect(calls.some((c) => c.url.searchParams.get('locked') === 'true' && c.url.searchParams.get('page_size') === '10')).toBe(true);
  });

  it('filters on the post type and searches through the api', async () => {
    const calls = stubFeedApi();
    renderAppAt('/c/frontend-francophone/posts');
    await screen.findByRole('table', {}, SLOW);
    fireEvent.change(await screen.findByLabelText('Filtrer par type', {}, SLOW), { target: { value: 'question' } });
    await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2), SLOW);
    expect(calls.some((c) => c.url.searchParams.get('type') === 'question')).toBe(true);

    fireEvent.change(screen.getByLabelText('Filtrer par type'), { target: { value: 'all' } });
    fireEvent.change(screen.getByLabelText('Rechercher une publication'), { target: { value: 'portfolio' } });
    await waitFor(() => expect(calls.some((c) => c.url.searchParams.get('q') === 'portfolio')).toBe(true), SLOW);
    await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2), SLOW);
  });

  it('locks the comments of a post', async () => {
    const calls = stubFeedApi();
    renderAppAt('/c/frontend-francophone/posts');
    const menu = await openMenu('Actions pour Comment typer un hook générique ?');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Verrouiller les commentaires' }));
    expect(await screen.findByText('Commentaires verrouillés.', {}, SLOW)).toBeTruthy();
    expect(calls.some((c) => c.method === 'POST' && c.url.pathname.endsWith('/posts/p2/lock/'))).toBe(true);
  });

  it('deletes a post after confirmation (moderator)', async () => {
    const calls = stubFeedApi();
    renderAppAt('/c/python-africa-core/posts');
    const menu = await openMenu('Actions pour Mon portfolio en React 19');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Supprimer' }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }));
    expect(await screen.findByText('Publication supprimée.', {}, SLOW)).toBeTruthy();
    expect(calls.some((c) => c.method === 'DELETE' && c.url.pathname.endsWith('/posts/p3/'))).toBe(true);
    await waitFor(() => expect(within(screen.getByRole('table')).queryByText('Mon portfolio en React 19')).toBeNull(), SLOW);
  });

  it('shows the questions already asked, close to a new one, without blocking it', async () => {
    const calls = stubFeedApi();
    renderAppAt('/c/frontend-francophone/posts');
    fireEvent.click(await screen.findByRole('button', { name: /Nouvelle publication/ }, SLOW));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    const checks = () => calls.filter((c) => c.url.pathname.endsWith('/ai/check-duplicates/'));
    // An announcement is not compared
    fireEvent.change(within(dialog).getByLabelText(/^Titre/), { target: { value: 'Comment typer un hook en TypeScript ?' } });
    await new Promise((r) => setTimeout(r, 900));
    expect(checks()).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole('radio', { name: /Question/ }));
    const similar = await within(dialog).findByRole('list', { name: 'Questions proches' }, SLOW);
    const link = within(similar).getByRole('link', { name: 'Comment typer un hook générique ?' });
    expect(link.getAttribute('href')).toBe('/communities/frontend-francophone/posts/p2');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(within(similar).getByText('Résolue')).toBeTruthy();
    expect(checks()[0].body).toMatchObject({ title: 'Comment typer un hook en TypeScript ?', limit: 3 });
    // Publishing stays possible
    expect(within(dialog).getByRole('button', { name: 'Publier' })).toHaveProperty('disabled', false);
  });

  it('publishes an announcement: the title is required', async () => {
    const calls = stubFeedApi();
    renderAppAt('/c/frontend-francophone/posts');
    fireEvent.click(await screen.findByRole('button', { name: /Nouvelle publication/ }, SLOW));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    expect(within(dialog).getByRole('radio', { name: /Annonce/ }).getAttribute('aria-checked')).toBe('true');
    fireEvent.change(within(dialog).getByLabelText(/^Contenu/), { target: { value: 'Le meetup de novembre aura lieu à Cocody.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publier' }));
    expect(await within(dialog).findByText('Au moins 3 caractères', {}, SLOW)).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText(/^Titre/), { target: { value: 'Meetup de novembre' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publier' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.pathname.endsWith('/communities/frontend-francophone/feed/'))).toBe(true), SLOW);
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      post_type: 'announcement',
      title: 'Meetup de novembre',
      content: 'Le meetup de novembre aura lieu à Cocody.',
      code_snippet: '',
      code_language: '',
    });
    expect(await screen.findByText('Publication partagée avec la communauté.', {}, SLOW)).toBeTruthy();
  });

  it('creates a poll with at least two options', async () => {
    const calls = stubFeedApi();
    renderAppAt('/c/frontend-francophone/posts');
    fireEvent.click(await screen.findByRole('button', { name: /Nouvelle publication/ }, SLOW));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.click(within(dialog).getByRole('radio', { name: /Sondage/ }));
    fireEvent.change(within(dialog).getByLabelText(/^Question du sondage/), { target: { value: 'Quel framework pour 2027 ?' } });
    fireEvent.change(within(dialog).getByLabelText(/^Contexte/), { target: { value: 'On prépare le programme des ateliers.' } });
    fireEvent.change(within(dialog).getByLabelText('Option 1'), { target: { value: 'React' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publier' }));
    expect(await within(dialog).findByText('Au moins 2 options', {}, SLOW)).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText('Option 2'), { target: { value: 'Vue' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Ajouter une option/ }));
    fireEvent.change(within(dialog).getByLabelText('Option 3'), { target: { value: 'Svelte' } });
    fireEvent.change(within(dialog).getByLabelText('Durée du vote'), { target: { value: '3' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publier' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true), SLOW);
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({
      post_type: 'poll',
      poll: { question: 'Quel framework pour 2027 ?', options: ['React', 'Vue', 'Svelte'], is_multiple_choice: false, duration_days: 3 },
    });
  });

  it('shares a discussion without a title, with a code snippet', async () => {
    const calls = stubFeedApi();
    renderAppAt('/c/frontend-francophone/posts');
    fireEvent.click(await screen.findByRole('button', { name: /Nouvelle publication/ }, SLOW));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.click(within(dialog).getByRole('radio', { name: /Discussion/ }));
    fireEvent.change(within(dialog).getByLabelText(/^Contenu/), { target: { value: 'Vous typez vos hooks comment ?' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Ajouter du code/ }));
    fireEvent.change(within(dialog).getByLabelText('Code'), { target: { value: 'const useX = <T,>() => {}' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publier' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true), SLOW);
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      post_type: 'discussion',
      title: '',
      content: 'Vous typez vos hooks comment ?',
      code_snippet: 'const useX = <T,>() => {}',
      code_language: 'typescript',
    });
  });

  it("lets the author edit their post, not someone else's", async () => {
    act(() => {
      store.dispatch(onSetUserToken({ user: { id: 'u1', username: 'awa' } as User, token: 'access', refresh: 'r' }));
    });
    const calls = stubFeedApi();
    renderAppAt('/c/frontend-francophone/posts');
    const menu = await openMenu('Actions pour Comment typer un hook générique ?');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Modifier' }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    expect((within(dialog).getByLabelText(/^Titre/) as HTMLInputElement).value).toBe('Comment typer un hook générique ?');
    // A post cannot become a poll afterwards
    expect(within(dialog).queryByRole('radio', { name: /Sondage/ })).toBeNull();
    fireEvent.change(within(dialog).getByLabelText(/^Titre/), { target: { value: 'Typer un hook générique en TS 5.9' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toMatchObject({ title: 'Typer un hook générique en TS 5.9' }), SLOW);
    expect(calls.find((c) => c.method === 'PATCH')?.url.pathname).toMatch(/\/posts\/p2\/$/);
    cleanup();

    act(() => {
      store.dispatch(onSetUserToken({ user: { id: 'u-other', username: 'kofi' } as User, token: 'access', refresh: 'r' }));
    });
    renderAppAt('/c/frontend-francophone/posts');
    const other = await openMenu('Actions pour Mon portfolio en React 19');
    expect(within(other).queryByRole('menuitem', { name: 'Modifier' })).toBeNull();
  });
});
