import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { User } from '@/utils/api/user/user.type';
import i18n from '@/utils/i18n';

vi.setConfig({ testTimeout: 15_000 });

type Membership = { is_member: boolean; role: string | null; status: string | null };
type Options = {
  /** reactions_summary of the post p1 (none: before the emoji reactions) */
  summary?: Record<string, number>;
  /** Attachments of the post p1 */
  media?: Record<string, unknown>[]; privacy?: 'public' | 'private'; pricing?: 'free' | 'paid'; approval?: boolean; membership?: Membership; status?: number; plansInDetail?: boolean; commentsFail?: boolean; membersFail?: boolean; notificationsOn?: boolean };

const monthlyPlan = { id: 'plan-m', name: 'Mensuel', slug: 'mensuel', description: '', price: '5000.00', currency: 'XOF', billing_interval: 'month', interval_count: 1, community_id: 'c1', community_name: 'Abidjan React', features: ['Lives mensuels'], is_active: true, order: 1 };

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

/** communities/<slug>/me/dashboard/ and analytics/member/dashboard/ (MemberActivityDashboardResponseSerializer) */
const ACTIVITY = {
  kpis: {
    hackathons: { total_participated: 2, successful_count: 1, failed_count: 1, in_progress_count: 0, prizes_won_count: 1, submissions_count: 2, success_rate: 50 },
    events: { total_registered: 5, attended_count: 3, upcoming_count: 1, completed_count: 4, missed_count: 1, attendance_rate: 75 },
    opportunities: { total_applied: 4, accepted_count: 1, rejected_count: 1, in_review_count: 2, success_rate: 50 },
    courses: { total_enrolled: 2, completed_count: 1, in_progress_count: 1, total_lessons_completed: 14, average_progress_percent: 87.5 },
  },
  highlights: {
    recent_hackathons: [{ id: 'h1', title: 'Hackathon AgriTech', slug: 'agri', tagline: '', banner_url: null, status: 'completed', status_display: 'Terminé', start_time: '2026-09-01T09:00:00Z', end_time: '2026-09-03T18:00:00Z', community: { id: 'c1', name: 'Abidjan React', slug: 'abidjan-react', logo_url: '' }, participation_mode: 'team', team: { id: 't1', name: 'Les Baobabs', slug: 'baobabs', role: 'leader', is_leader: true }, submission: null, member_result: 'won', is_winner: true, is_podium: true }],
    upcoming_or_recent_events: [{ id: 'e1', title: 'Atelier Next.js', slug: 'atelier', event_type: 'workshop', event_type_display: 'Atelier', format: 'livekit', format_display: 'Live', status: 'scheduled', status_display: 'Programmé', start_time: '2026-11-20T18:00:00Z', end_time: '2026-11-20T20:00:00Z', community: { id: 'c1', name: 'Abidjan React', slug: 'abidjan-react', logo_url: '' }, rsvp_status: 'attending', rsvp_status_display: 'Inscrit', is_checked_in: false, is_upcoming: true, is_in_progress: false, is_completed: false }],
    recent_opportunity_applications: [{ id: 'a1', status: 'shortlisted', status_display: 'Présélectionné', applied_at: '2026-10-10T10:00:00Z', is_successful: false, is_failed: false, is_in_review: true, opportunity: { id: 'o1', title: 'Dev React', slug: 'dev-react', company_name: 'Wave', company_logo_url: '', opportunity_type_display: 'CDI' } }],
    active_courses: [{ id: 'en1', course_id: 'co1', title: 'React 19 en pratique', slug: 'react-19', level_display: 'Intermédiaire', thumbnail_url: '', community: { id: 'c1', name: 'Abidjan React', slug: 'abidjan-react', logo_url: '' }, enrolled_at: '2026-10-01T10:00:00Z', completed_at: null, overall_progress_percent: 60, total_lessons: 10, completed_lessons: 6, is_completed: false }],
  },
};

type Call = { method: string; url: URL; body: Record<string, unknown> | null };

/** One community; join / leave change the membership like the api */
const comment = (id: string, content: string) => ({
  id, post_id: 'p1', parent_id: null, author: { id: 'u2', username: 'awa', first_name: 'Awa', last_name: 'Ndiaye' }, content,
  is_accepted_answer: false, reactions_count: 0, user_reactions: [], replies: [], created_at: '2026-10-10T10:00:00Z',
});

function stubCommunityApi(o: Options = {}) {
  let membership = o.membership ?? NONE;
  let peerDeclined = false;
  let membersRecovered = false;
  // Three comments are shown at first: five to show "2 de plus"
  let comments = ['Bravo', 'Merci', 'Top', 'Génial', 'Super'].map((text, i) => comment(`c${i + 1}`, text));
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
    if (path.endsWith('/communities/abidjan-react/')) {
      return json({ success: true, data: { ...community(o, membership), ...(o.plansInDetail ? { subscription_plans: [monthlyPlan] } : {}), notifications_enabled: !!o.notificationsOn } });
    }
    if (path.endsWith('/posts/p1/react/')) return json({ success: true, data: { reacted: true } });
    if (path.endsWith('/media/assets/m3/download/')) return json({ success: true, data: { id: 'm3', file_name: 'slides.pdf', file_url: 'https://utfs.io/f/m3', mime_type: 'application/pdf', file_size: 2048 } });
    if (path.endsWith('/posts/p1/bookmark/')) return json({ success: true, data: { is_bookmarked: true } });
    if (path.endsWith('/ai/semantic-search/')) {
      return json({ success: true, data: { query: body?.query, count: 2, results: [
        { id: 'p1', content_type: 'post', title: 'Mémoïser un composant', similarity_score: 0.8, url: '/communities/abidjan-react/posts/p1', snippet: 'useMemo et React.memo' },
        { id: 'l1', content_type: 'lesson', title: 'Les hooks en pratique', similarity_score: 0.7, url: '/communities/abidjan-react/courses/react-19?lesson=l1', snippet: '' },
      ] } });
    }
    if (path.endsWith('/ai/weekly-digest/')) return json({ id: 'd1', week_identifier: '2026-W45', headline: 'La semaine de la communauté', summary_markdown: 'Un résumé.', top_debates: [], highlighted_project: null, upcoming_events: [], kpis_snapshot: {}, created_at: '2026-11-03T10:00:00Z' });
    if (path.endsWith('/ai/peer-matches/pm1/respond/')) {
      peerDeclined = true;
      return json({ id: 'pm1', status: 'declined' });
    }
    if (path.endsWith('/ai/peer-matches/')) {
      return json([{ id: 'pm1', user_id: 'u-fatou', username: 'fatou', first_name: 'Fatou', last_name: 'Sow', avatar_url: null, match_reasons: ['Compétences partagées : React'], status: peerDeclined ? 'declined' : 'suggested', match_type: 'pair_programming', compatibility_score: 0.9 }]);
    }
    if (path.endsWith('/communities/abidjan-react/notifications/toggle/')) return json({ success: true, data: { notifications_enabled: body?.notifications_enabled } });
    if (path.endsWith('/conversations/') && request.method === 'POST') return json({ id: 'conv-kofi', conversation_type: 'direct', participants: [], last_message: null, unread_count: 0 }, 201);
    if (path.endsWith('/communities/abidjan-react/members/')) {
      if (o.membersFail && !membersRecovered) {
        membersRecovered = true;
        return json({ success: false, code: 'error', message: 'Erreur serveur.' }, 500);
      }
      const m = (id: string, first_name: string, role: string, is_online = false) => ({ id, user: { id, username: first_name.toLowerCase(), first_name, last_name: 'Diop', avatar_url: '' }, role, status: 'active', custom_title: '', joined_at: '2026-01-15T10:00:00Z', reputation_score: 0, created_at: '', is_online });
      const all = [m('m1', 'Awa', 'admin'), m('m2', 'Kofi', 'member', true)];
      const found = url.searchParams.get('online') === 'true' ? all.filter((x) => x.is_online) : all;
      return json({ success: true, pagination: { count: found.length }, results: found });
    }
    if (path.endsWith('/posts/p1/comments/')) {
      if (o.commentsFail) return json({ success: false, code: 'error', message: 'Les commentaires sont indisponibles.' }, 500);
      if (request.method === 'POST') {
        const created = comment(`c${comments.length + 1}`, String(body?.content));
        comments = [...comments, created];
        return json({ success: true, data: created }, 201);
      }
      return json({ success: true, data: comments });
    }
    if (path.endsWith('/communities/abidjan-react/feed/')) {
      const post = { id: 'p1', community_id: 'c1', author: { id: 'u2', username: 'awa', first_name: 'Awa', last_name: 'Ndiaye' }, title: 'Retour sur React Conf', content: 'Les **Server Components** en prod.', post_type: 'discussion', is_pinned: true, is_locked: false, is_resolved: false, views_count: 1, reactions_count: 12, comments_count: 3, created_at: '2026-10-10T10:00:00Z', ...(o.summary ? { reactions_summary: o.summary } : {}), ...(o.media ? { media: o.media } : {}) };
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
      return json({ success: true, data: [monthlyPlan] });
    }
    if (path.endsWith('/billing/checkout/')) {
      return json({ success: true, data: { payment_id: 'pay1', token: 't', checkout_url: 'https://paydunya.com/checkout/t', amount: '5000.00', currency: 'XOF', plan_name: 'Mensuel' } }, 201);
    }
    if (path.endsWith('/users/me/')) return json({ success: true, data: { id: 'u1', username: 'fatou' } });
    if (path.endsWith('/communities/abidjan-react/me/dashboard/')) return json({ success: true, data: ACTIVITY });
    if (path.endsWith('/communities/abidjan-react/gamification/points/me/')) {
      return json({ success: true, data: { community_slug: 'abidjan-react', total_points: 320, level: 3, rank_title: 'Praticien', rank: 1, total_ranked_members: 12, points_to_next_rank: 80, transactions_count: 9, breakdown_by_action: [{ action: 'post_created', action_label: 'Publication', points: 200, count: 20 }] } });
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

describe('Public community page', () => {
  it('shows the community of the api to a visitor, who signs in to join', async () => {
    stubCommunityApi();
    renderAppAt('/communities/abidjan-react');
    expect(await screen.findByRole('heading', { level: 1, name: 'Abidjan React' }, SLOW)).toBeTruthy();
    expect(screen.getByText(/Meetup chaque mois à Cocody/)).toBeTruthy();
    expect(screen.getByText('Restez bienveillants')).toBeTruthy();
    // Twice: in the hero on phones (the side panel comes after the whole page) and in the side panel
    const joins = screen.getAllByRole('link', { name: 'Rejoindre la communauté' });
    expect(joins).toHaveLength(2);
    joins.forEach((link) => expect(link.getAttribute('href')).toBe(`/auth/login?next=${encodeURIComponent('/communities/abidjan-react')}`));
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

  it('reads the plans from the detail of the community when it carries them', async () => {
    signIn();
    const calls = stubCommunityApi({ pricing: 'paid', plansInDetail: true });
    renderAppAt('/communities/abidjan-react');
    const plans = await screen.findByRole('list', { name: "Formules d'adhésion" }, SLOW);
    expect(within(plans).getByText('5 000 FCFA')).toBeTruthy();
    expect(calls.some((c) => c.url.pathname.endsWith('/billing/plans/'))).toBe(false);
    // The entry price instead of a plain "Payante": the badge by the name, the "Accès" figure
    expect(screen.getAllByText('5 000 FCFA / mois').length).toBeGreaterThan(0);
    expect(screen.queryByText('Accès payant')).toBeNull();
  });

  it('shows a member their activity in the community, a tab hidden to visitors', async () => {
    signIn();
    const calls = stubCommunityApi({ membership: { is_member: true, role: 'member', status: 'active' } });
    renderAppAt('/communities/abidjan-react?tab=activity');
    const figures = await screen.findByRole('group', { name: 'Mes indicateurs' }, SLOW);
    expect(within(figures).getByText('Événements suivis').parentElement?.textContent).toMatch(/3/);
    expect(within(figures).getByText('Formations en cours').parentElement?.textContent).toMatch(/1 terminée · 88 % en moyenne/);
    // In this community: the links stay in it, the community is not repeated
    const courses = screen.getByRole('region', { name: 'Mes formations' });
    expect(within(courses).getByRole('link', { name: 'React 19 en pratique' }).getAttribute('href')).toBe('/communities/abidjan-react/courses/react-19');
    expect(within(courses).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('60');
    expect(within(screen.getByRole('region', { name: 'Mes hackathons' })).getByText('Primé')).toBeTruthy();
    expect(calls.some((c) => c.url.pathname.endsWith('/communities/abidjan-react/me/dashboard/'))).toBe(true);
    // My points here: the rank, the gap to the next one, where they come from
    const mine = screen.getByRole('group', { name: 'Mes points ici' });
    await waitFor(() => expect(mine.textContent).toMatch(/1er sur 12/), SLOW);
    expect(mine.textContent).toMatch(/80 pts/);
    expect(within(screen.getByRole('region', { name: 'D’où viennent mes points' })).getByText(/Publication/)).toBeTruthy();
    cleanup();

    // A visitor: no such tab, the url falls back to "À propos"
    act(() => {
      store.dispatch(onLogout());
    });
    stubCommunityApi();
    renderAppAt('/communities/abidjan-react?tab=activity');
    const nav = await screen.findByRole('navigation', { name: 'Sections de la communauté' }, SLOW);
    expect(within(nav).queryByRole('link', { name: 'Mon activité' })).toBeNull();
    expect(within(nav).getByRole('link', { name: 'À propos' }).getAttribute('aria-current')).toBe('page');
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

    const calls = stubCommunityApi();
    renderAppAt('/communities/abidjan-react?tab=leaderboard');
    const ranking = await screen.findByRole('list', { name: 'Classement' }, SLOW);
    expect(within(ranking).getByText('820 pts')).toBeTruthy();
    // Rolling windows of the api
    fireEvent.click(within(screen.getByRole('group', { name: 'Période' })).getByRole('button', { name: '7 derniers jours' }));
    await waitFor(() => expect(calls.some((c) => c.url.pathname.endsWith('/leaderboard/') && c.url.searchParams.get('period') === 'weekly')).toBe(true), SLOW);
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

  it('shows the emoji reactions of a post, and reacts with one of them', async () => {
    signIn();
    const calls = stubCommunityApi({ membership: { is_member: true, role: 'member', status: 'active' }, summary: { like: 10, '🎉': 2 } });
    renderAppAt('/communities/abidjan-react');
    const feed = await screen.findByRole('list', { name: 'Publications' }, SLOW);
    // The like button counts the likes only, each other emoji has its chip
    expect(within(feed).getByRole('button', { name: 'J’aime' }).textContent).toContain('10');
    fireEvent.click(within(feed).getByRole('button', { name: '🎉 : 2, réagir aussi' }));
    expect(await within(feed).findByRole('button', { name: '🎉 : 3, retirer ma réaction' }, SLOW)).toBeTruthy();
    expect(calls.find((c) => c.url.pathname.endsWith('/posts/p1/react/'))?.body).toEqual({ reaction_type: '🎉' });
    expect(within(feed).getByRole('button', { name: 'Ajouter une réaction' })).toBeTruthy();
  });

  it('shows the images of a post in a grid and a viewer, and downloads its documents', async () => {
    signIn();
    const media = (id: string, type: string, filename: string, order: number) => ({
      id, type, provider: 'UPLOADTHING', url: `https://utfs.io/f/${id}`, playback_url: null, thumbnail_url: null, filename,
      mime_type: '', size: 2048, duration: null, width: null, height: null, status: 'READY', order,
    });
    const calls = stubCommunityApi({
      membership: { is_member: true, role: 'member', status: 'active' },
      media: [media('m1', 'IMAGE', 'scene.png', 0), media('m2', 'IMAGE', 'public.png', 1), media('m3', 'DOCUMENT', 'slides.pdf', 2)],
    });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderAppAt('/communities/abidjan-react');
    const feed = await screen.findByRole('list', { name: 'Publications' }, SLOW);
    const images = within(feed).getByRole('list', { name: 'Images de la publication' });
    fireEvent.click(within(images).getByRole('button', { name: 'Agrandir l’image public.png' }));
    const viewer = await screen.findByRole('dialog', { name: 'public.png' }, SLOW);
    fireEvent.click(within(viewer).getByRole('button', { name: /Suivante/ }));
    expect(await screen.findByRole('dialog', { name: 'scene.png' }, SLOW)).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    fireEvent.click(await within(feed).findByRole('button', { name: 'Télécharger slides.pdf' }, SLOW));
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://utfs.io/f/m3', '_blank', 'noopener'), SLOW);
    expect(calls.some((c) => c.url.pathname.endsWith('/media/assets/m3/download/'))).toBe(true);
  });

  it('plays a ready video on demand, and tells when one is still being processed', async () => {
    signIn();
    const video = (id: string, status: string, extra: Record<string, unknown> = {}) => ({
      id, type: 'VIDEO', provider: 'MUX', url: null, playback_url: status === 'READY' ? `https://stream.mux.com/${id}.m3u8` : null, thumbnail_url: `https://image.mux.com/${id}/thumbnail.webp`,
      filename: `${id}.mp4`, mime_type: 'video/mp4', size: 1000, duration: 102, width: 1920, height: 1080, status, order: 0, ...extra,
    });
    stubCommunityApi({ membership: { is_member: true, role: 'member', status: 'active' }, media: [video('demo', 'READY'), video('live', 'PROCESSING')] });
    renderAppAt('/communities/abidjan-react');
    const feed = await screen.findByRole('list', { name: 'Publications' }, SLOW);
    const videos = within(feed).getByRole('list', { name: 'Vidéos de la publication' });
    expect(within(videos).getByText('Vidéo en cours de traitement')).toBeTruthy();
    // Nothing loaded before the click: the poster, the duration and a play button
    expect(within(videos).queryByLabelText('Vidéo demo.mp4')).toBeNull();
    const play = within(videos).getByRole('button', { name: 'Lire la vidéo demo.mp4' });
    expect(play.textContent).toContain('1:42');
    fireEvent.click(play);
    expect(await within(videos).findByLabelText('Vidéo demo.mp4', {}, SLOW)).toBeTruthy();
  });

  it('plays a ready video from its file when Mux has no stream yet, and tells about files being prepared', async () => {
    signIn();
    stubCommunityApi({
      membership: { is_member: true, role: 'member', status: 'active' },
      media: [
        { id: 'v1', type: 'VIDEO', provider: 'MUX', url: 'https://utfs.io/f/demo.mp4', playback_url: null, thumbnail_url: null, filename: 'demo.mp4', mime_type: 'video/mp4', size: 1, duration: 12, width: null, height: null, status: 'READY', order: 0 },
        { id: 'i1', type: 'IMAGE', provider: 'UPLOADTHING', url: null, playback_url: null, thumbnail_url: null, filename: 'scene.png', mime_type: 'image/png', size: 1, duration: null, width: null, height: null, status: 'PROCESSING', order: 1 },
      ],
    });
    renderAppAt('/communities/abidjan-react');
    const feed = await screen.findByRole('list', { name: 'Publications' }, SLOW);
    // The text of the post shows meanwhile
    expect(within(feed).getByText(/Server Components/)).toBeTruthy();
    expect(within(feed).getByText('1 fichier en préparation : il apparaîtra ici dès qu’il est prêt.')).toBeTruthy();
    fireEvent.click(within(feed).getByRole('button', { name: 'Lire la vidéo demo.mp4' }));
    const player = (await within(feed).findByLabelText('Vidéo demo.mp4', {}, SLOW)) as HTMLVideoElement;
    await waitFor(() => expect(player.getAttribute('src') ?? player.src).toContain('https://utfs.io/f/demo.mp4'), SLOW);
  });

  it('comments a post right in the feed, without leaving it', async () => {
    signIn();
    const calls = stubCommunityApi({ membership: { is_member: true, role: 'member', status: 'active' } });
    const { where } = renderAppAt('/communities/abidjan-react');
    const feed = await screen.findByRole('list', { name: 'Publications' }, SLOW);
    fireEvent.click(within(feed).getByRole('button', { name: /3 commentaires/ }));
    const thread = await within(feed).findByRole('list', { name: 'Commentaires' }, SLOW);
    expect(within(thread).getAllByRole('article')).toHaveLength(3);
    fireEvent.click(within(feed).getByRole('button', { name: /Voir 2 commentaires de plus/ }));
    expect(within(thread).getAllByRole('article')).toHaveLength(5);

    fireEvent.change(within(feed).getByLabelText('Votre commentaire'), { target: { value: 'Très utile, merci !' } });
    fireEvent.click(within(feed).getByRole('button', { name: /Publier/ }));
    // Shown at once, the feed stays where it is
    expect(await within(feed).findByText('Très utile, merci !', {}, SLOW)).toBeTruthy();
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.url.pathname.endsWith('/posts/p1/comments/'))?.body).toEqual({ content: 'Très utile, merci !' }), SLOW);
    expect(where()).toBe('/communities/abidjan-react');
  });

  it('says when the comments cannot be loaded, with a retry', async () => {
    signIn();
    stubCommunityApi({ membership: { is_member: true, role: 'member', status: 'active' }, commentsFail: true });
    renderAppAt('/communities/abidjan-react');
    const feed = await screen.findByRole('list', { name: 'Publications' }, SLOW);
    fireEvent.click(within(feed).getByRole('button', { name: /3 commentaires/ }));
    expect((await within(feed).findByRole('alert', {}, SLOW)).textContent).toBe('Les commentaires sont indisponibles.');
    expect(within(feed).getByRole('button', { name: /Réessayer/ })).toBeTruthy();
  });

  it('saves a post, filters the saved ones and sorts by popularity', async () => {
    signIn();
    const calls = stubCommunityApi({ membership: { is_member: true, role: 'member', status: 'active' } });
    renderAppAt('/communities/abidjan-react');
    const feed = await screen.findByRole('list', { name: 'Publications' }, SLOW);
    fireEvent.click(within(feed).getByRole('button', { name: 'Enregistrer la publication' }));
    await waitFor(() => expect(within(feed).getByRole('button', { name: 'Retirer des publications enregistrées' }).getAttribute('aria-pressed')).toBe('true'), SLOW);

    const feedCalls = () => calls.filter((c) => c.url.pathname.endsWith('/feed/'));
    fireEvent.change(screen.getByLabelText('Trier les publications'), { target: { value: 'popular' } });
    await waitFor(() => expect(feedCalls().some((c) => c.url.searchParams.get('sort') === 'popular')).toBe(true), SLOW);
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrées' }));
    await waitFor(() => expect(feedCalls().some((c) => c.url.searchParams.get('bookmarked') === 'true')).toBe(true), SLOW);
  });

  it('turns the notifications of the community off with the bell', async () => {
    signIn();
    const calls = stubCommunityApi({ membership: { is_member: true, role: 'member', status: 'active' }, notificationsOn: true });
    renderAppAt('/communities/abidjan-react');
    fireEvent.click(await screen.findByRole('button', { name: 'Couper les notifications de cette communauté' }, SLOW));
    await waitFor(() => expect(calls.find((c) => c.url.pathname.endsWith('/notifications/toggle/'))?.body).toEqual({ notifications_enabled: false }), SLOW);
    expect(await screen.findByRole('button', { name: 'Activer les notifications de cette communauté' }, SLOW)).toBeTruthy();
  });

  it('opens the directory to a member: searched and sorted by the api', async () => {
    signIn();
    const calls = stubCommunityApi({ membership: { is_member: true, role: 'member', status: 'active' } });
    renderAppAt('/communities/abidjan-react?tab=members');
    const list = await screen.findByRole('list', { name: 'Membres' }, SLOW);
    expect(within(list).getByText('Awa Diop')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Équipe' }));
    expect(within(list).queryByText('Kofi Diop')).toBeNull();

    const memberCalls = () => calls.filter((c) => c.url.pathname.endsWith('/members/'));
    expect(memberCalls()[0].url.searchParams.get('ordering')).toBe('reputation');
    fireEvent.change(screen.getByLabelText('Trier les membres'), { target: { value: '-joined_at' } });
    await waitFor(() => expect(memberCalls().some((c) => c.url.searchParams.get('ordering') === '-joined_at')).toBe(true), SLOW);
    fireEvent.change(screen.getByLabelText('Rechercher un membre'), { target: { value: 'kofi' } });
    await waitFor(() => expect(memberCalls().some((c) => c.url.searchParams.get('search') === 'kofi')).toBe(true), SLOW);
  });

  it('shows the summary of the week to a member only', async () => {
    signIn();
    stubCommunityApi({ membership: { is_member: true, role: 'member', status: 'active' } });
    renderAppAt('/communities/abidjan-react');
    const digest = await screen.findByRole('region', { name: 'Résumé de la semaine' }, SLOW);
    expect(within(digest).getByText('La semaine de la communauté')).toBeTruthy();
    // Only a manager writes it again, from their space
    expect(within(digest).queryByRole('button', { name: /Réécrire/ })).toBeNull();
  });

  it('suggests members to meet to a member, who can ignore them', async () => {
    signIn();
    const calls = stubCommunityApi({ membership: { is_member: true, role: 'member', status: 'active' } });
    renderAppAt('/communities/abidjan-react?tab=members');
    const list = await screen.findByRole('list', { name: 'Membres à rencontrer' }, SLOW);
    expect(within(list).getByRole('link', { name: 'Fatou Sow' }).getAttribute('href')).toBe('/profiles/fatou');
    expect(within(list).getByText('Compétences partagées : React')).toBeTruthy();
    fireEvent.click(within(list).getByRole('button', { name: 'Ignorer Fatou Sow' }));
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Membres à rencontrer' })).toBeNull(), SLOW);
    expect(calls.find((c) => c.url.pathname.endsWith('/ai/peer-matches/pm1/respond/'))?.body).toEqual({ action: 'decline' });
  });

  it('calls no AI for a visitor', async () => {
    const calls = stubCommunityApi();
    renderAppAt('/communities/abidjan-react?tab=members');
    await screen.findByRole('heading', { name: 'Membres actifs' }, SLOW);
    expect(calls.some((c) => c.url.pathname.includes('/ai/'))).toBe(false);
  });

  it('filters the members online through the api, and shows who is', async () => {
    signIn();
    const calls = stubCommunityApi({ membership: { is_member: true, role: 'member', status: 'active' } });
    renderAppAt('/communities/abidjan-react?tab=members');
    const list = await screen.findByRole('list', { name: 'Membres' }, SLOW);
    expect(within(list).getAllByText('· En ligne')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'En ligne' }));
    await waitFor(() => expect(calls.some((c) => c.url.pathname.endsWith('/members/') && c.url.searchParams.get('online') === 'true')).toBe(true), SLOW);
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Membres' })).queryByText('Awa Diop')).toBeNull(), SLOW);
    expect(within(screen.getByRole('list', { name: 'Membres' })).getByText('Kofi Diop')).toBeTruthy();
  });

  it('keeps the online filter for the members', async () => {
    stubCommunityApi();
    renderAppAt('/communities/abidjan-react?tab=members');
    await screen.findByRole('heading', { name: 'Membres actifs' }, SLOW);
    expect(screen.getByRole('button', { name: 'En ligne' })).toHaveProperty('disabled', true);
  });

  it('searches by meaning with the AI, on purpose, for a member', async () => {
    signIn();
    const calls = stubCommunityApi({ membership: { is_member: true, role: 'member', status: 'active' } });
    renderAppAt('/communities/abidjan-react');
    await screen.findByRole('list', { name: 'Publications' }, SLOW);
    fireEvent.change(screen.getByPlaceholderText('Rechercher une discussion…'), { target: { value: 'éviter les re-rendus' } });
    // Not at each letter: on a click
    expect(calls.some((c) => c.url.pathname.endsWith('/ai/semantic-search/'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /Chercher « éviter les re-rendus » avec l’IA/ }));
    const results = await screen.findByRole('list', { name: 'Résultats de l’IA' }, SLOW);
    expect(calls.find((c) => c.url.pathname.endsWith('/ai/semantic-search/'))?.body).toEqual({ query: 'éviter les re-rendus', content_types: ['post', 'lesson'], limit: 8 });
    expect(within(results).getByRole('link', { name: 'Mémoïser un composant' }).getAttribute('href')).toBe('/communities/abidjan-react/posts/p1');
    expect(within(results).getByRole('link', { name: 'Les hooks en pratique' }).getAttribute('href')).toBe('/communities/abidjan-react/courses/react-19?lesson=l1');
    expect(within(results).getByText('Leçon')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer les résultats de l’IA' }));
    expect(screen.queryByRole('list', { name: 'Résultats de l’IA' })).toBeNull();
  });

  it('offers no AI search to a visitor', async () => {
    const calls = stubCommunityApi();
    renderAppAt('/communities/abidjan-react');
    await screen.findByRole('heading', { level: 1, name: 'Abidjan React' }, SLOW);
    expect(screen.queryByRole('button', { name: /avec l’IA/ })).toBeNull();
    expect(calls.some((c) => c.url.pathname.includes('/ai/semantic-search/'))).toBe(false);
  });

  it('opens the conversation with a member from the directory', async () => {
    signIn();
    const calls = stubCommunityApi({ membership: { is_member: true, role: 'member', status: 'active' } });
    const { where } = renderAppAt('/communities/abidjan-react?tab=members');
    const list = await screen.findByRole('list', { name: 'Membres' }, SLOW);
    const kofi = within(list).getByText('Kofi Diop').closest('li') as HTMLElement;
    fireEvent.click(within(kofi).getByRole('button', { name: /Écrire/ }));
    await waitFor(() => expect(where()).toBe('/messages/conv-kofi'), SLOW);
    expect(calls.find((c) => c.method === 'POST' && c.url.pathname.endsWith('/conversations/'))?.body).toMatchObject({ conversation_type: 'direct', recipient_id: 'm2' });
  });

  it('says when the members cannot be loaded, and loads them again', async () => {
    signIn();
    stubCommunityApi({ membership: { is_member: true, role: 'member', status: 'active' }, membersFail: true });
    renderAppAt('/communities/abidjan-react?tab=members');
    const alert = await screen.findByRole('alert', {}, SLOW);
    expect(alert.textContent).toMatch(/Impossible de charger les membres/);
    expect(screen.queryByText('Les membres apparaîtront ici')).toBeNull();
    fireEvent.click(within(alert).getByRole('button', { name: /Réessayer/ }));
    expect(await screen.findByRole('list', { name: 'Membres' }, SLOW)).toBeTruthy();
  });

  it('speaks English: tabs, access, plans and the feed', async () => {
    await act(() => i18n.changeLanguage('en'));
    try {
      signIn();
      stubCommunityApi({ pricing: 'paid', plansInDetail: true });
      renderAppAt('/communities/abidjan-react');
      expect(await screen.findByRole('heading', { level: 1, name: 'Abidjan React' }, SLOW)).toBeTruthy();
      const tabs = screen.getByRole('navigation', { name: 'Community sections' });
      expect(within(tabs).getByRole('link', { name: 'Leaderboard' })).toBeTruthy();
      const plans = await screen.findByRole('list', { name: 'Membership plans' }, SLOW);
      expect(within(plans).getByText('5,000 FCFA')).toBeTruthy();
      expect(within(plans).getByText('/ month')).toBeTruthy();
      expect(within(plans).getByRole('button', { name: /Subscribe — Mensuel/ })).toBeTruthy();
    } finally {
      await act(() => i18n.changeLanguage('fr'));
    }
  });
});
