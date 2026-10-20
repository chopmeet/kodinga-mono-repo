import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW, TEST_TOKEN } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { User } from '@/utils/api/user/user.type';

vi.setConfig({ testTimeout: 30_000 });

type Call = { method: string; url: URL; body: Record<string, unknown> | null };
const person = { id: 'u9', username: 'awa', first_name: 'Awa', last_name: 'Ndiaye', avatar_url: '', headline: '' };
const tech = { id: 't1', name: 'React', slug: 'react', icon_url: '' };

/** abidjan-react: two offers (one already applied to elsewhere), a project; raw DRF answers */
function stubApi({ member = true } = {}) {
  const calls: Call[] = [];
  let applied = false;
  let upvoted = false;
  const comments: { id: string; author: typeof person; content: string; parent_id: null; replies: unknown[]; created_at: string }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ method: request.method, url, body });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    const path = url.pathname;
    const offer = {
      id: 'o1', title: 'Développeuse React', slug: 'dev-react', company_name: 'Wave', company_logo_url: '', company_website: 'https://wave.com',
      opportunity_type: 'full_time', workplace_type: 'remote', location: 'Dakar', salary_min: '500000', salary_max: '800000', currency: 'XOF', experience_level: 'mid',
      status: 'open', views_count: 3, applications_count: applied ? 1 : 0, expires_at: null, has_applied: applied, poster: person, technologies: [tech], created_at: '2026-10-01T10:00:00Z',
    };
    const project = {
      id: 'p1', title: 'Tontine Plus', slug: 'tontine-plus', tagline: 'La tontine en ligne', cover_image_url: '', demo_url: 'https://tontine.example.com', repository_url: '',
      status: 'published', upvotes_count: upvoted ? 5 : 4, views_count: 10, is_featured: false, is_upvoted: upvoted, owner: person, technologies: [tech], created_at: '2026-10-02T10:00:00Z',
    };

    if (path.endsWith('/communities/abidjan-react/')) {
      return json({
        success: true,
        data: {
          id: 'c1', name: 'Abidjan React', slug: 'abidjan-react', privacy_type: 'public', pricing_type: 'free', members_count: 40, owner: { id: 'o', username: 'o' },
          user_membership: member ? { is_member: true, role: 'member', status: 'active' } : { is_member: false, role: null, status: null },
        },
      });
    }
    if (path.endsWith('/opportunities/') && request.method === 'GET') return json([offer, { ...offer, id: 'o2', slug: 'stage-data', title: 'Stage data', opportunity_type: 'internship', status: 'closed' }]);
    if (path.endsWith('/opportunities/my-applications/')) return json(applied ? [{ id: 'a1', opportunity: offer, status: 'reviewing', created_at: '2026-10-05T10:00:00Z' }] : []);
    if (path.endsWith('/opportunities/dev-react/apply/')) {
      applied = true;
      return json({ id: 'a1', status: 'pending' }, 201);
    }
    if (path.endsWith('/opportunities/dev-react/')) return json({ ...offer, description: '## Missions\n\nConstruire le **checkout**.', requirements: '', apply_url: '', apply_email: '', community_id: 'c1', updated_at: '' });
    if (path.endsWith('/projects/') && request.method === 'GET') return json([project]);
    if (path.endsWith('/projects/') && request.method === 'POST') return json({ ...project, ...body, slug: 'nouveau' }, 201);
    if (path.endsWith('/projects/tontine-plus/upvote/')) {
      upvoted = !upvoted;
      return json({ is_upvoted: upvoted, upvotes_count: upvoted ? 5 : 4 });
    }
    if (path.endsWith('/projects/tontine-plus/comments/')) {
      if (request.method === 'POST') comments.push({ id: `c${comments.length}`, author: person, content: body?.content, parent_id: null, replies: [], created_at: new Date().toISOString() });
      return json(request.method === 'POST' ? comments.at(-1) : comments, request.method === 'POST' ? 201 : 200);
    }
    if (path.endsWith('/projects/tontine-plus/')) return json({ ...project, description: 'Une **tontine** en ligne.', community_id: 'c1', updated_at: '' });
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
  });
  return calls;
}

const signIn = () =>
  act(() => {
    store.dispatch(onSetUserToken({ user: { id: 'u1', username: 'fatou' } as User, token: TEST_TOKEN, refresh: 'r' }));
  });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(onLogout());
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Opportunities of a community (members)', () => {
  it('lists the open offers, opens one and applies to it', async () => {
    signIn();
    const calls = stubApi();
    const { where } = renderAppAt('/communities/abidjan-react?tab=opportunities');
    const list = await screen.findByRole('list', { name: 'Opportunités' }, SLOW);
    // Closed offers are not listed
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(list.textContent).toMatch(/500\s000 – 800\s000 FCFA/);
    fireEvent.click(within(list).getByRole('link', { name: 'Développeuse React' }));
    await waitFor(() => expect(where()).toBe('/opportunities/dev-react?from=abidjan-react'), SLOW);

    expect(await screen.findByRole('heading', { level: 1, name: 'Développeuse React' }, SLOW)).toBeTruthy();
    expect(screen.getByText('checkout').tagName).toBe('STRONG');
    fireEvent.click(screen.getByRole('button', { name: 'Postuler' }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Envoyer ma candidature' }));
    expect((await within(dialog).findByRole('alert')).textContent).toMatch(/au moins/);
    fireEvent.change(within(dialog).getByLabelText('Portfolio ou GitHub'), { target: { value: 'https://github.com/fatou' } });
    fireEvent.change(within(dialog).getByLabelText('Message au recruteur'), { target: { value: 'Je suis motivée.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Envoyer ma candidature' }));
    await waitFor(() => expect(calls.find((c) => c.url.pathname.endsWith('/apply/'))?.body).toEqual({ resume_url: '', portfolio_url: 'https://github.com/fatou', cover_letter: 'Je suis motivée.' }), SLOW);
    const card = await screen.findByRole('region', { name: 'Candidature' }, SLOW);
    expect(await within(card).findByText('Candidature envoyée', {}, SLOW)).toBeTruthy();
    expect(await within(card).findByText('En cours d’examen', {}, SLOW)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Opportunités de la communauté/ }).getAttribute('href')).toBe('/communities/abidjan-react?tab=opportunities');
  });

  it('asks a visitor to sign in before applying', async () => {
    stubApi({ member: false });
    renderAppAt('/opportunities/dev-react');
    expect((await screen.findByRole('link', { name: 'Se connecter pour postuler' }, SLOW)).getAttribute('href')).toContain('/auth/login?next=');
  });
});

describe('Projects of a community', () => {
  it('lists the projects, votes for one and shares a new one (member)', async () => {
    signIn();
    const calls = stubApi();
    renderAppAt('/communities/abidjan-react?tab=projects');
    const list = await screen.findByRole('list', { name: 'Projets' }, SLOW);
    fireEvent.click(within(list).getByRole('button', { name: 'Voter pour « Tontine Plus » (4)' }));
    expect(await within(list).findByRole('button', { name: 'Retirer mon vote pour « Tontine Plus » (5)' }, SLOW)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Partager un projet/ }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText(/^Nom du projet/), { target: { value: 'Mobile Money Kit' } });
    fireEvent.change(within(dialog).getByLabelText(/^Dépôt de code/), { target: { value: 'https://github.com/fatou/mmkit' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Partager le projet' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.url.pathname.endsWith('/projects/'))?.body).toMatchObject({ title: 'Mobile Money Kit', community_id: 'c1', status: 'published' }), SLOW);
  });

  it('opens a project and posts a comment; a visitor is sent to the login to vote', async () => {
    signIn();
    const calls = stubApi();
    renderAppAt('/projects/tontine-plus?from=abidjan-react');
    expect(await screen.findByRole('heading', { level: 1, name: 'Tontine Plus' }, SLOW)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Voir la démo/ }).getAttribute('href')).toBe('https://tontine.example.com');
    fireEvent.change(screen.getByLabelText('Votre avis sur le projet…'), { target: { value: 'Bravo, très utile !' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publier' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.url.pathname.endsWith('/comments/'))?.body).toEqual({ content: 'Bravo, très utile !' }), SLOW);
    expect(await within(await screen.findByRole('list', { name: 'Commentaires' }, SLOW)).findByText('Bravo, très utile !', {}, SLOW)).toBeTruthy();

    cleanup();
    act(() => {
      store.dispatch(onLogout());
    });
    renderAppAt('/projects/tontine-plus');
    expect((await screen.findByRole('link', { name: 'Voter pour « Tontine Plus » (4)' }, SLOW)).getAttribute('href')).toContain('/auth/login');
  });
});
