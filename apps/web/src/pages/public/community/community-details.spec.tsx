import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { User } from '@/utils/api/user/user.type';

vi.setConfig({ testTimeout: 15_000 });

type Membership = { is_member: boolean; role: string | null; status: string | null };
type Options = { privacy?: 'public' | 'private'; pricing?: 'free' | 'paid'; approval?: boolean; membership?: Membership; status?: number };

const NONE: Membership = { is_member: false, role: null, status: null };

const community = (o: Options, membership: Membership) => ({
  id: 'c1',
  name: 'Abidjan React',
  slug: 'abidjan-react',
  tagline: 'Les devs React de Côte d’Ivoire',
  description: 'On partage nos retours sur React 19 et Next.\nMeetup chaque mois à Cocody.',
  avatar_url: '',
  banner_url: '',
  brand_color: '#1D4ED8',
  category: { id: 'cat', name: 'Web & Mobile', slug: 'web-mobile' },
  owner: { id: 'u-owner', username: 'yao', first_name: 'Yao', last_name: 'Kouassi' },
  privacy_type: o.privacy ?? 'public',
  pricing_type: o.pricing ?? 'free',
  is_verified: true,
  is_featured: false,
  members_count: 240,
  posts_count: 57,
  courses_count: 2,
  events_count: 4,
  created_at: '2026-01-01T00:00:00Z',
  user_membership: membership,
  settings: { require_approval_to_join: !!o.approval, allow_member_invites: true, welcome_message: '', default_post_permission: 'all_members' },
  rules: [{ id: 'r1', title: 'Restez bienveillants', description: 'Pas d’attaque personnelle.', order: 1 }],
});

type Call = { method: string; url: URL; body: Record<string, unknown> | null };

/** One community; join / leave change the membership like the api */
function stubCommunityApi(o: Options = {}) {
  let membership = o.membership ?? NONE;
  const calls: Call[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ method: request.method, url, body });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    const path = url.pathname;

    if (o.status === 404 && path.endsWith('/communities/abidjan-react/')) return json({ success: false, code: 'not_found', message: 'Communauté introuvable.' }, 404);
    if (path.endsWith('/communities/abidjan-react/join/')) {
      membership = o.approval ? { is_member: false, role: 'member', status: 'pending' } : { is_member: true, role: 'member', status: 'active' };
      return json({ success: true, data: { id: 'm1', role: 'member', status: membership.status } });
    }
    if (path.endsWith('/communities/abidjan-react/leave/')) {
      membership = { is_member: false, role: 'member', status: 'left' };
      return json({ success: true });
    }
    if (path.endsWith('/communities/abidjan-react/')) return json({ success: true, data: community(o, membership) });
    if (path.endsWith('/posts/p1/react/')) return json({ success: true, data: { reacted: true } });
    if (path.endsWith('/communities/abidjan-react/feed/')) {
      const post = { id: 'p1', community_id: 'c1', author: { id: 'u2', username: 'awa', first_name: 'Awa', last_name: 'Ndiaye' }, title: 'Retour sur React Conf', content: 'Les **Server Components** en prod.', post_type: 'discussion', is_pinned: true, is_locked: false, is_resolved: false, views_count: 1, reactions_count: 12, comments_count: 3, created_at: '2026-10-10T10:00:00Z' };
      return json({ success: true, pagination: { count: 1 }, results: [post] });
    }
    if (path.endsWith('/communities/abidjan-react/leaderboard/')) {
      return json({ success: true, data: [{ rank: 1, user: { id: 'u2', username: 'awa', name: 'Awa Ndiaye', avatar_url: '' }, points: 820, level: 5, rank_title: 'Expert' }] });
    }
    if (path.endsWith('/communities/abidjan-react/hackathons/')) {
      const h = (id: string, title: string, status: string) => ({ id, title, slug: id, tagline: 'Construire pour l’agriculture', cover_image_url: '', status, start_time: '2026-11-01T09:00:00Z', submission_deadline: '2026-11-03T18:00:00Z', participants_count: 42, is_registration_open: status === 'registration_open' });
      return json({ success: true, pagination: { count: 2 }, results: [h('agri', 'Hackathon AgriTech', 'registration_open'), h('brouillon', 'Brouillon secret', 'draft')] });
    }
    if (path.endsWith('/billing/plans/')) {
      return json({ success: true, data: [{ id: 'plan-m', name: 'Mensuel', slug: 'mensuel', description: '', price: '5000.00', currency: 'XOF', billing_interval: 'month', interval_count: 1, community_id: 'c1', community_name: 'Abidjan React', features: ['Lives mensuels'], is_active: true, order: 1 }] });
    }
    if (path.endsWith('/billing/checkout/')) {
      return json({ success: true, data: { payment_id: 'pay1', token: 't', checkout_url: 'https://paydunya.com/checkout/t', amount: '5000.00', currency: 'XOF', plan_name: 'Mensuel' } }, 201);
    }
    if (path.endsWith('/users/me/')) return json({ success: true, data: { id: 'u1', username: 'fatou' } });
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

describe('Public community page', () => {
  it('shows the community of the api to a visitor, who signs in to join', async () => {
    stubCommunityApi();
    renderAppAt('/communities/abidjan-react');
    expect(await screen.findByRole('heading', { level: 1, name: 'Abidjan React' }, SLOW)).toBeTruthy();
    expect(screen.getByText(/Meetup chaque mois à Cocody/)).toBeTruthy();
    expect(screen.getByText('Restez bienveillants')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Rejoindre la communauté' }).getAttribute('href')).toBe(`/auth/login?next=${encodeURIComponent('/communities/abidjan-react')}`);
  });

  it('opens the feed of a public and free community to everyone', async () => {
    stubCommunityApi();
    renderAppAt('/communities/abidjan-react?tab=feed');
    const feed = await screen.findByRole('list', { name: 'Publications' }, SLOW);
    expect(within(feed).getByText('Retour sur React Conf')).toBeTruthy();
    expect(within(feed).getByText('Les Server Components en prod.')).toBeTruthy();
  });

  it('lets a signed-in user join a free community, then leave it', async () => {
    signIn();
    const calls = stubCommunityApi();
    renderAppAt('/communities/abidjan-react');
    const aside = await screen.findByRole('complementary', {}, SLOW);
    fireEvent.click(await within(aside).findByRole('button', { name: 'Rejoindre la communauté' }, SLOW));
    // The page turns into the member's space
    expect(await screen.findByText('Votre espace communauté', {}, SLOW)).toBeTruthy();
    expect(within(screen.getByRole('complementary')).getByText('Vous êtes membre de cette communauté')).toBeTruthy();
    expect(calls.some((c) => c.method === 'POST' && c.url.pathname.endsWith('/join/'))).toBe(true);

    // Leaving: from the role menu of the header
    const trigger = screen.getByRole('button', { name: 'Votre rôle : Membre' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(within(await screen.findByRole('menu', {}, SLOW)).getByRole('menuitem', { name: /Quitter la communauté/ }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.click(within(dialog).getByRole('button', { name: /Quitter/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.pathname.endsWith('/leave/'))).toBe(true), SLOW);
    expect(await within(screen.getByRole('complementary')).findByRole('button', { name: 'Rejoindre la communauté' }, SLOW)).toBeTruthy();
  });

  it('keeps the feed of a private community for its members, and sends a join request', async () => {
    signIn();
    const calls = stubCommunityApi({ privacy: 'private', approval: true });
    renderAppAt('/communities/abidjan-react?tab=feed');
    expect(await screen.findByText('Réservé aux membres', {}, SLOW)).toBeTruthy();
    expect(calls.some((c) => c.url.pathname.endsWith('/feed/'))).toBe(false);

    const aside = screen.getByRole('complementary');
    fireEvent.click(within(aside).getByRole('button', { name: 'Demander à rejoindre' }));
    expect(await within(aside).findByText("Demande en cours d'examen", {}, SLOW)).toBeTruthy();
  });

  it('sends to PayDunya to subscribe to a paid community', async () => {
    signIn();
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, origin: 'http://localhost:4200', assign } });
    try {
      const calls = stubCommunityApi({ pricing: 'paid' });
      renderAppAt('/communities/abidjan-react');
      const plans = await screen.findByRole('list', { name: "Formules d'adhésion" }, SLOW);
      expect(within(plans).getByText('5 000 FCFA')).toBeTruthy();
      fireEvent.click(within(plans).getByRole('button', { name: /S'abonner — Mensuel/ }));
      await waitFor(() => expect(assign).toHaveBeenCalledWith('https://paydunya.com/checkout/t'), SLOW);
      expect(calls.find((c) => c.url.pathname.endsWith('/billing/checkout/'))?.body).toEqual({
        plan_id: 'plan-m',
        return_url: 'http://localhost:4200/communities/abidjan-react?payment=done',
        cancel_url: 'http://localhost:4200/communities/abidjan-react?payment=cancelled',
      });
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });

  it('says when the community does not exist', async () => {
    stubCommunityApi({ status: 404 });
    renderAppAt('/communities/abidjan-react');
    expect(await screen.findByRole('heading', { name: 'Communauté introuvable' }, SLOW)).toBeTruthy();
  });

  it('shows the members, the hackathons and the ranking of the community', async () => {
    stubCommunityApi();
    renderAppAt('/communities/abidjan-react');
    // "Membres" sub-tab of "À propos": the count, the creator and the most active members
    fireEvent.click(await screen.findByRole('tab', { name: /Membres/ }, SLOW));
    expect(await screen.findByText('Créateur', {}, SLOW)).toBeTruthy();
    expect(within(await screen.findByRole('list', { name: 'Membres les plus actifs' }, SLOW)).getByText('Awa Ndiaye')).toBeTruthy();
    cleanup();

    renderAppAt('/communities/abidjan-react?tab=hackathons');
    const hackathons = await screen.findByRole('list', { name: 'Hackathons' }, SLOW);
    expect(within(hackathons).getByText('Hackathon AgriTech')).toBeTruthy();
    expect(within(hackathons).queryByText('Brouillon secret')).toBeNull();
    cleanup();

    // "Membres" tab: cards of the contributors, with their public profile
    renderAppAt('/communities/abidjan-react?tab=members');
    // Visitor: the contributors, said as such (the api keeps the full list for the team)
    expect(await screen.findByRole('heading', { name: 'Membres actifs' }, SLOW)).toBeTruthy();
    expect(await screen.findByText((_, el) => el?.tagName === 'P' && !!el.textContent?.includes('1 membre actif sur 240 au total'), {}, SLOW)).toBeTruthy();
    const members = await screen.findByRole('list', { name: 'Membres actifs' }, SLOW);
    expect(within(members).getByRole('link', { name: /Voir le profil/ }).getAttribute('href')).toBe('/profiles/awa');
    cleanup();

    renderAppAt('/communities/abidjan-react?tab=leaderboard');
    const ranking = await screen.findByRole('list', { name: 'Classement' }, SLOW);
    expect(within(ranking).getByText('820 pts')).toBeTruthy();
  });

  it('lets a member like a post and open the composer', async () => {
    signIn();
    const calls = stubCommunityApi({ membership: { is_member: true, role: 'member', status: 'active' } });
    // Members land on the feed
    renderAppAt('/communities/abidjan-react');
    const feed = await screen.findByRole('list', { name: 'Publications' }, SLOW);
    expect(within(feed).getByText('Épinglé par l’équipe')).toBeTruthy();

    const like = within(feed).getByRole('button', { name: 'J’aime' });
    expect(like.textContent).toContain('12');
    fireEvent.click(like);
    await waitFor(() => expect(within(feed).getByRole('button', { name: 'Retirer mon j’aime' }).textContent).toContain('13'), SLOW);
    expect(calls.find((c) => c.url.pathname.endsWith('/posts/p1/react/'))?.body).toEqual({ reaction_type: 'like' });

    fireEvent.click(screen.getByRole('button', { name: /Une question, une idée, un projet/ }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    expect(within(dialog).getByRole('radio', { name: /Discussion/ }).getAttribute('aria-checked')).toBe('true');
  });
});
