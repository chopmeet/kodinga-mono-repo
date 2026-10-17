import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { getMyCommunity } from '@/data/community-space.data';
import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { Project, ProjectComment } from '@/utils/api/project/project.type';
import type { User } from '@/utils/api/user/user.type';

vi.setConfig({ testTimeout: 20_000 });

const COMMUNITY_ID = getMyCommunity('dakar-devops')?.community.id ?? '';
const me = { id: 'u-me', username: 'fatou', first_name: 'Fatou', last_name: 'Sow', avatar_url: '', headline: 'SRE' };
const awa = { id: 'u-awa', username: 'awa', first_name: 'Awa', last_name: 'Ndiaye', avatar_url: '', headline: 'Data engineer' };

const project = (slug: string, title: string, extra: Partial<Project> = {}): Project => ({
  id: slug,
  slug,
  title,
  tagline: 'Un outil pour la communauté',
  description: 'Né pendant le hackathon de Dakar.',
  cover_image_url: '',
  demo_url: 'https://demo.example.com',
  repository_url: 'https://github.com/kodinga/demo',
  status: 'published',
  upvotes_count: 3,
  views_count: 20,
  is_featured: false,
  is_upvoted: false,
  owner: awa,
  technologies: [{ id: 't1', name: 'Python', slug: 'python', icon_url: '' }],
  created_at: '2026-10-01T10:00:00Z',
  community_id: COMMUNITY_ID,
  updated_at: '2026-10-01T10:00:00Z',
  ...extra,
});

type Call = { method: string; url: URL; body: Record<string, unknown> | null };

/** Fake projects api (raw responses): list (order_by), detail, create, upvote, comments */
function stubProjectsApi() {
  let projects = [project('irrigo', 'Irrigo', { upvotes_count: 12, is_featured: true }), project('kube-dash', 'Kube Dash', { owner: me })];
  let comments: ProjectComment[] = [
    { id: 'c1', author: me, content: 'Bravo pour la démo !', parent_id: null, replies: [], created_at: '2026-10-02T10:00:00Z' },
  ];
  const calls: Call[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ method: request.method, url, body });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    const path = url.pathname;
    const slug = path.match(/projects\/([^/]+)\//)?.[1];

    if (path.endsWith('/projects/')) {
      if (request.method === 'POST') {
        const created = project('new-project', String(body?.title), { ...body, owner: me, technologies: [] });
        projects = [...projects, created];
        return json(created, 201);
      }
      const sorted = url.searchParams.get('order_by') === 'recent' ? [...projects].reverse() : projects;
      return json(sorted.filter((p) => url.searchParams.get('community') === 'dakar-devops' && p.community_id === COMMUNITY_ID));
    }
    if (slug && path.endsWith('/upvote/')) {
      projects = projects.map((p) => (p.slug === slug ? { ...p, is_upvoted: !p.is_upvoted, upvotes_count: p.upvotes_count + (p.is_upvoted ? -1 : 1) } : p));
      const p = projects.find((x) => x.slug === slug);
      return json({ is_upvoted: p?.is_upvoted, upvotes_count: p?.upvotes_count });
    }
    if (slug && path.endsWith('/comments/')) {
      if (request.method === 'POST') {
        const reply = { id: 'c2', author: me, content: String(body?.content), created_at: '2026-10-03T10:00:00Z' };
        comments = comments.map((c) => (c.id === body?.parent_id ? { ...c, replies: [...c.replies, reply] } : c));
        return json({ ...reply, parent_id: body?.parent_id ?? null, replies: [] }, 201);
      }
      return json(comments);
    }
    if (slug) return json(projects.find((p) => p.slug === slug));
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
  });
  return calls;
}

beforeEach(() => {
  act(() => {
    store.dispatch(onSetUserToken({ user: { ...me } as unknown as User, token: 'access', refresh: 'r' }));
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(onLogout());
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Community space: projects', () => {
  it('lists the projects of the community, sorted by the api, filtered here', async () => {
    const calls = stubProjectsApi();
    renderAppAt('/c/dakar-devops/projects');
    const grid = await screen.findByRole('list', { name: 'Projets' }, SLOW);
    expect(within(grid).getAllByRole('link').map((a) => a.textContent)).toEqual(['Irrigo', 'Kube Dash']);
    expect(calls.find((c) => c.url.pathname.endsWith('/projects/'))?.url.searchParams.get('order_by')).toBe('upvotes');

    fireEvent.click(screen.getByRole('button', { name: 'Les plus récents' }));
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Projets' })).getAllByRole('link')[0].textContent).toBe('Kube Dash'), SLOW);

    fireEvent.click(screen.getByRole('button', { name: 'Mes projets' }));
    expect(within(screen.getByRole('list', { name: 'Projets' })).getAllByRole('link').map((a) => a.textContent)).toEqual(['Kube Dash']);
  });

  it("shows featuring as coming soon, and no delete on someone else's project", async () => {
    stubProjectsApi();
    renderAppAt('/c/dakar-devops/projects');
    const trigger = await screen.findByRole('button', { name: 'Actions pour Irrigo' }, SLOW);
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    const menu = await screen.findByRole('menu', {}, SLOW);
    expect(within(menu).getByRole('menuitem', { name: /Ne plus mettre en avant/ }).getAttribute('aria-disabled')).toBe('true');
    expect(within(menu).queryByRole('menuitem', { name: 'Supprimer' })).toBeNull();
  });

  it('shares a project with the community: a repository or a demo is required', async () => {
    const calls = stubProjectsApi();
    renderAppAt('/c/dakar-devops/projects');
    fireEvent.click(await screen.findByRole('button', { name: /Partager un projet/ }, SLOW));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText(/^Nom du projet/), { target: { value: 'Mobile Money SDK' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Partager le projet' }));
    expect(await within(dialog).findByText('Indiquez le dépôt ou la démo', {}, SLOW)).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText(/^Dépôt de code/), { target: { value: 'https://github.com/fatou/momo-sdk' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Partager le projet' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true), SLOW);
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({
      title: 'Mobile Money SDK',
      repository_url: 'https://github.com/fatou/momo-sdk',
      community_id: COMMUNITY_ID,
      status: 'published',
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Mobile Money SDK' }, SLOW)).toBeTruthy();
  });

  it('votes for a project and answers a comment', async () => {
    const calls = stubProjectsApi();
    renderAppAt('/c/dakar-devops/projects/irrigo');
    fireEvent.click(await screen.findByRole('button', { name: /Voter · 12/ }, SLOW));
    expect(await screen.findByRole('button', { name: /Voté · 13/ }, SLOW)).toBeTruthy();
    // The vote patches the cache: the project is not fetched again (each GET counts a view)
    expect(calls.filter((c) => c.method === 'GET' && c.url.pathname.endsWith('/projects/irrigo/'))).toHaveLength(1);

    const list = await screen.findByRole('list', { name: 'Commentaires' }, SLOW);
    fireEvent.click(within(list).getByRole('button', { name: 'Répondre' }));
    fireEvent.change(within(list).getByLabelText('Répondre à Fatou Sow'), { target: { value: 'Merci !' } });
    fireEvent.click(within(list).getByRole('button', { name: /Publier/ }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.url.pathname.endsWith('/comments/'))?.body).toEqual({ content: 'Merci !', parent_id: 'c1' }), SLOW);
    expect(await within(list).findByText('Merci !', {}, SLOW)).toBeTruthy();
  });
});
