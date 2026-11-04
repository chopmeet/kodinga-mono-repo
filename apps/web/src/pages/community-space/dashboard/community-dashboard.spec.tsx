import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';

vi.setConfig({ testTimeout: 15_000 });

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const user = (id: string, first_name: string, last_name: string) => ({ id, username: first_name.toLowerCase(), first_name, last_name, email: `${id}@x.com` });

const MEMBERS = [daysAgo(3), daysAgo(10), daysAgo(45), daysAgo(200)].map((joined_at, i) => ({
  id: `m${i}`,
  user: user(`u${i}`, 'Membre', `${i}`),
  role: 'member',
  status: 'active',
  custom_title: '',
  joined_at,
  reputation_score: 10,
  created_at: joined_at,
}));

const post = (id: string, title: string, created_at: string, reactions_count: number) => ({
  id,
  community_id: 'c',
  author: user('u9', 'Awa', 'Ndiaye'),
  title,
  content: 'Contenu',
  post_type: 'discussion',
  is_pinned: false,
  is_locked: false,
  is_resolved: false,
  views_count: 10,
  reactions_count,
  comments_count: 2,
  created_at,
});

const POSTS = [post('p1', 'Retour sur le meetup', daysAgo(2), 4), post('p2', 'Kubernetes en prod', daysAgo(12), 18), post('p3', 'Vieux sujet', daysAgo(90), 30)];

const DIGEST = {
  id: 'd1',
  week_identifier: '2026-W45',
  headline: 'Une semaine dense',
  summary_markdown: 'Beaucoup de **questions** cette semaine.',
  top_debates: [{ id: 'p1', title: 'Retour sur le meetup', author: 'awa', comments_count: 4, post_type: 'discussion' }],
  highlighted_project: { id: 'x', title: 'Wari Pay', slug: 'wari-pay', owner: 'awa', tagline: '' },
  upcoming_events: [],
  kpis_snapshot: { new_members: 2, posts_created: 1, comments_posted: 5 },
  created_at: daysAgo(1),
};

const risk = (id: string, first_name: string, risk_level: string, suggested_nudge: string) => ({
  id,
  member_id: `m-${id}`,
  user_id: `u-${id}`,
  username: first_name.toLowerCase(),
  first_name,
  last_name: 'Sow',
  avatar_url: null,
  risk_level,
  risk_score: 60,
  signals: { days_inactive: 21, total_recent_interactions: 0, activity_trend: 'declining' },
  suggested_nudge,
  status: 'open',
  nudge_sent_at: null,
});
const CHURN = [risk('r1', 'Fatou', 'high', 'Bonjour Fatou, tout va bien ?'), risk('r2', 'Kofi', 'low', '')];

/** Members (status / page), feed and upcoming events of dakar-devops */
function stubDashboardApi() {
  const calls: URL[] = [];
  let nudged = false;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL((input as Request).url);
    calls.push(url);
    const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
    const p = url.searchParams;
    if (url.pathname.endsWith('/members/')) {
      const status = p.get('status');
      const found = status === 'pending' ? [{ ...MEMBERS[0], id: 'm-p', status: 'pending' }, { ...MEMBERS[1], id: 'm-q', status: 'pending' }] : MEMBERS;
      return json({ success: true, pagination: { count: found.length }, results: found.slice(0, Number(p.get('page_size') ?? 20)) });
    }
    if (url.pathname.endsWith('/ai/weekly-digest/')) return json(DIGEST);
    if (url.pathname.endsWith('/ai/weekly-digest/trigger/')) return json({ ...DIGEST, headline: 'Une semaine réécrite' });
    if (url.pathname.endsWith('/ai/churn-dashboard/')) return json({ community: 'dakar-devops', total_at_risk: 3, members: CHURN.map((m) => ({ ...m, nudge_sent_at: nudged && m.id === 'r1' ? daysAgo(0) : null })) });
    if (url.pathname.endsWith('/ai/churn-risks/r1/send-nudge/')) {
      nudged = true;
      return json({ message: 'ok', churn_risk: CHURN[0] });
    }
    if (url.pathname.endsWith('/feed/')) return json({ success: true, pagination: { count: 57 }, results: POSTS });
    if (url.pathname.endsWith('/revenue/')) {
      const month = new Date().toISOString().slice(0, 7);
      return json({ success: true, data: { monthly_revenue: [{ month, gross: '20000.00', fees: '2000.00', net: '18000.00', payments_count: 2 }] } });
    }
    if (url.pathname.endsWith('/events/')) {
      const event = { id: 'e1', title: 'Atelier Terraform', start_time: daysAgo(-5), end_time: daysAgo(-5), status: 'scheduled' };
      return json({ success: true, pagination: { count: 1 }, results: [event] });
    }
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

describe('Community space: dashboard', () => {
  it('shows the figures of the community from the api', async () => {
    const calls = stubDashboardApi();
    renderAppAt('/c/dakar-devops/dashboard');
    const figures = await screen.findByRole('region', { name: 'Indicateurs de la communauté' }, SLOW);
    // 4 active members, 2 joined in the last 30 days, 2 posts in 30 days, 2 requests, 1 event
    await waitFor(() => expect(within(figures).getByText('Membres actifs').parentElement?.textContent).toContain('4'), SLOW);
    expect(within(figures).getByText('Nouveaux membres (30 j)').parentElement?.textContent).toContain('2');
    expect(within(figures).getByText('Publications (30 j)').parentElement?.textContent).toContain('2');
    expect(within(figures).getByText("Demandes d'adhésion").parentElement?.textContent).toContain('2');
    expect(within(figures).getByText('Événements à venir').parentElement?.textContent).toContain('1');
    expect(calls.some((u) => u.pathname.endsWith('/feed/') && u.searchParams.get('page_size') === '100')).toBe(true);
  });

  it('shows the net revenue of the month to the owner of a paid community', async () => {
    const calls = stubDashboardApi();
    renderAppAt('/c/lagos-ai-data/dashboard');
    const figures = await screen.findByRole('region', { name: 'Indicateurs de la communauté' }, SLOW);
    await waitFor(() => expect(within(figures).getByText('Revenus nets ce mois-ci').parentElement?.textContent).toMatch(/18\s000 FCFA/), SLOW);
    expect(calls.some((u) => u.pathname.endsWith('/billing/communities/lagos-ai-data/revenue/'))).toBe(true);
  });

  it('lists what to handle and the most popular posts', async () => {
    stubDashboardApi();
    renderAppAt('/c/dakar-devops/dashboard');
    expect(await screen.findByRole('link', { name: /2 demandes d'adhésion à traiter/ }, SLOW)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Atelier Terraform/ }).getAttribute('href')).toBe('/c/dakar-devops/events/e1');
    const top = await screen.findByRole('list', { name: 'Publications les plus populaires' }, SLOW);
    expect(within(top).getAllByRole('listitem').map((li) => li.textContent?.includes('Vieux sujet'))[0]).toBe(true);
  });

  it('shows the summary of the week and lets a manager write it again', async () => {
    const calls = stubDashboardApi();
    renderAppAt('/c/dakar-devops/dashboard');
    const digest = await screen.findByRole('region', { name: 'Résumé de la semaine' }, SLOW);
    expect(within(digest).getByText('Une semaine dense')).toBeTruthy();
    expect(within(digest).getByText('questions').tagName).toBe('STRONG');
    expect(within(digest).getByText(/2 nouveaux membres · 1 publication · 5 commentaires/)).toBeTruthy();
    expect(within(digest).getByRole('link', { name: 'Retour sur le meetup' }).getAttribute('href')).toBe('/communities/dakar-devops/posts/p1');
    expect(within(digest).getByRole('link', { name: 'Wari Pay' }).getAttribute('href')).toBe('/projects/wari-pay');
    fireEvent.click(within(digest).getByRole('button', { name: /Réécrire le résumé/ }));
    await waitFor(() => expect(calls.some((u) => u.pathname.endsWith('/ai/weekly-digest/trigger/'))).toBe(true), SLOW);
  });

  it('keeps the summary of the week without the rewrite for a moderator', async () => {
    stubDashboardApi();
    renderAppAt('/c/python-africa-core/dashboard');
    const digest = await screen.findByRole('region', { name: 'Résumé de la semaine' }, SLOW);
    expect(within(digest).queryByRole('button', { name: /Réécrire/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Analyser les membres/ })).toBeNull();
  });

  it('analyzes the members only on demand, leaves out the low risks, records a nudge', async () => {
    const calls = stubDashboardApi();
    renderAppAt('/c/dakar-devops/dashboard');
    const analyze = await screen.findByRole('button', { name: /Analyser les membres/ }, SLOW);
    const churnCalls = () => calls.filter((u) => u.pathname.endsWith('/ai/churn-dashboard/'));
    expect(churnCalls()).toHaveLength(0);

    fireEvent.click(analyze);
    const list = await screen.findByRole('list', { name: 'Membres à relancer' }, SLOW);
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getByText(/Risque élevé/)).toBeTruthy();
    expect(within(list).getByText('Inactif depuis 21 j · aucune activité sur 14 j · activité en baisse')).toBeTruthy();
    expect(within(list).getByText('Bonjour Fatou, tout va bien ?')).toBeTruthy();
    expect(within(list).queryByText('Kofi Sow')).toBeNull();

    fireEvent.click(within(list).getByRole('button', { name: 'Noter Fatou Sow comme relancé' }));
    await waitFor(() => expect(calls.some((u) => u.pathname.endsWith('/ai/churn-risks/r1/send-nudge/'))).toBe(true), SLOW);
    expect(await within(list).findByText(/Relancé le/, {}, SLOW)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Analyser de nouveau/ }));
    await waitFor(() => expect(churnCalls().some((u) => u.searchParams.get('refresh') === 'true')).toBe(true), SLOW);
  });
});
