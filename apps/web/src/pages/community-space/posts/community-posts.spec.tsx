import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

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

type Call = { method: string; url: URL };

/** Fake feed api: type / q / pinned filters, pin, lock, delete */
function stubFeedApi() {
  let posts = [...POSTS];
  const calls: Call[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    calls.push({ method: request.method, url });
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
    if (url.pathname.endsWith('/feed/')) {
      const p = url.searchParams;
      const q = (p.get('q') ?? '').toLowerCase();
      const found = posts.filter(
        (x) =>
          (!p.get('type') || x.post_type === p.get('type')) &&
          (p.get('pinned') !== 'true' || x.is_pinned) &&
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
    // Not a filter of the api yet
    expect(screen.getByRole('button', { name: /Verrouillées/ })).toHaveProperty('disabled', true);
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
});
