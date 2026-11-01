import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { must, renderAppAt, SLOW, stubApi } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { LeaderboardEntry } from '@/utils/api/gamification/gamification.type';
import type { User } from '@/utils/api/user/user.type';

vi.setConfig({ testTimeout: 15_000 });

const entry = (rank: number, id: string, name: string, points: number, level = 3, rank_title = 'Praticien'): LeaderboardEntry => ({
  rank,
  user: { id, username: name.split(' ')[0].toLowerCase(), name, avatar_url: '' },
  points,
  level,
  rank_title,
});

const rule = (action: string, label: string, points: number, is_active = true) => ({
  id: action, action, label, description: '', points, default_points: points, is_active, allow_multiple_per_reference: false, updated_at: '2026-10-01T00:00:00Z',
});
const RULES = [rule('course_completed', 'Formation achevée', 50), rule('post_created', 'Publication créée', 5), rule('comment_created', 'Commentaire posté', 2, false)];

const RANKING = [
  entry(1, 'u1', 'Awa Ndiaye', 820, 5, 'Expert'),
  entry(2, 'u2', 'Kofi Mensah', 410, 4, 'Artisan du code'),
  entry(3, 'u3', 'Fatou Sow', 160),
  entry(4, 'u4', 'Yao Kouassi', 40, 1, 'Initié'),
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(onLogout());
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Community space: leaderboard', () => {
  it('shows the podium, the ranking and highlights the signed-in member', async () => {
    act(() => {
      store.dispatch(onSetUserToken({ user: { id: 'u3', username: 'fatou' } as unknown as User, token: 'access', refresh: 'r' }));
    });
    const calls = stubApi({ '/communities/dakar-devops/leaderboard/': { body: { success: true, data: RANKING } } });
    renderAppAt('/c/dakar-devops/leaderboard');

    const podium = await screen.findByRole('list', { name: 'Podium' }, SLOW);
    expect(within(podium).getByText('Awa Ndiaye')).toBeTruthy();
    expect(within(podium).getByText('820 pts')).toBeTruthy();
    expect(within(podium).queryByText('Yao Kouassi')).toBeNull();
    expect(screen.getByText('1 430')).toBeTruthy();

    const ranking = screen.getByRole('list', { name: 'Classement des membres' });
    expect(within(ranking).getAllByRole('listitem')).toHaveLength(4);
    expect(within(ranking).getByText('Vous')).toBeTruthy();
    expect(new URL(must(calls.find((c) => c.url.includes('/leaderboard/'))).url).searchParams.get('limit')).toBe('50');
  });

  it('searches a member and asks the api for another top', async () => {
    const calls = stubApi({ '/communities/dakar-devops/leaderboard/': { body: { success: true, data: RANKING } } });
    renderAppAt('/c/dakar-devops/leaderboard');
    const ranking = await screen.findByRole('list', { name: 'Classement des membres' }, SLOW);

    fireEvent.change(screen.getByLabelText('Rechercher un membre'), { target: { value: 'kofi' } });
    await waitFor(() => expect(within(ranking).getAllByRole('listitem')).toHaveLength(1), SLOW);

    fireEvent.change(screen.getByLabelText('Nombre de membres affichés'), { target: { value: '100' } });
    await waitFor(() => expect(calls.some((c) => new URL(c.url).searchParams.get('limit') === '100')).toBe(true), SLOW);
  });

  it('ranks over the last 30 or 7 days, with a way back when nobody scored', async () => {
    const calls = stubApi({ '/communities/dakar-devops/leaderboard/': { body: { success: true, data: RANKING } } });
    renderAppAt('/c/dakar-devops/leaderboard');
    const periods = await screen.findByRole('group', { name: 'Période' }, SLOW);
    fireEvent.click(within(periods).getByRole('button', { name: '30 derniers jours' }));
    await waitFor(() => expect(calls.some((c) => new URL(c.url).searchParams.get('period') === 'monthly')).toBe(true), SLOW);
    expect(within(periods).getByRole('button', { name: '30 derniers jours' }).getAttribute('aria-pressed')).toBe('true');

    // Nobody scored this week: said so, with a button back to all time
    vi.restoreAllMocks();
    stubApi({ '/communities/dakar-devops/leaderboard/': { body: { success: true, data: [] } } });
    fireEvent.click(within(periods).getByRole('button', { name: '7 derniers jours' }));
    expect(await screen.findByText('Aucun point marqué sur les 7 derniers jours', {}, SLOW)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Voir le classement depuis le début' }));
    await waitFor(() => expect(screen.queryByText('Aucun point marqué sur les 7 derniers jours')).toBeNull(), SLOW);
  });

  it('lets the owner set the points of each action, adjust a member and read the journal', async () => {
    const calls = stubApi({
      '/communities/dakar-devops/leaderboard/': { body: { success: true, data: RANKING } },
      '/communities/dakar-devops/gamification/rules/': { body: { success: true, data: RULES } },
      '/communities/dakar-devops/gamification/transactions/': {
        body: { success: true, data: [{ id: 't1', user: { id: 'u2', username: 'kofi', name: 'Kofi Mensah', avatar_url: '', headline: '' }, community_id: 'c', community_name: '', community_slug: 'dakar-devops', action: 'manual_adjustment', action_label: 'Ajustement manuel', points: -20, source: 'manual_adjustment', source_label: 'Manuel', awarded_by: { id: 'o', username: 'o', name: 'Awa', avatar_url: '', headline: '' }, description: 'Spam', created_at: '2026-10-30T10:00:00Z' }] },
      },
      '/communities/dakar-devops/members/': { body: { success: true, pagination: { count: 1 }, results: [{ id: 'm2', user: { id: 'u2', username: 'kofi', first_name: 'Kofi', last_name: 'Mensah' }, role: 'member', status: 'active', custom_title: '', joined_at: '', reputation_score: 0, created_at: '' }] } },
      '/communities/dakar-devops/gamification/points/adjust/': { body: { success: true, data: {} } },
    });
    renderAppAt('/c/dakar-devops/leaderboard');
    // The rules of the api, active ones only
    const rules = await screen.findByRole('list', { name: 'Barème des points' }, SLOW);
    await waitFor(() => expect(within(rules).getAllByRole('listitem')).toHaveLength(2), SLOW);
    expect(within(rules).queryByText('Commentaire posté')).toBeNull();
    expect(within(await screen.findByRole('table', { name: 'Journal des points' }, SLOW)).getByText(/Spam · par Awa/)).toBeTruthy();

    // Only the changed rules are sent
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText('Points : Publication créée'), { target: { value: '8' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le barème' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ rules: [{ action: 'post_created', points: 8, is_active: true }] }), SLOW);

    // A member found by name, a negative number, a reason
    fireEvent.click(screen.getByRole('button', { name: /Ajuster des points/ }));
    const adjust = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.click(within(adjust).getByRole('button', { name: 'Ajuster' }));
    expect(await within(adjust).findByText('Choisissez le membre concerné', {}, SLOW)).toBeTruthy();
    fireEvent.change(within(adjust).getByLabelText(/^Membre/), { target: { value: 'kofi' } });
    fireEvent.click(await within(adjust).findByRole('button', { name: /Kofi Mensah/ }, SLOW));
    fireEvent.change(within(adjust).getByLabelText(/^Points/), { target: { value: '-20' } });
    fireEvent.change(within(adjust).getByLabelText(/^Motif/), { target: { value: 'Spam répété' } });
    fireEvent.click(within(adjust).getByRole('button', { name: 'Ajuster' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.url.endsWith('/points/adjust/'))?.body).toEqual({ user_id: 'u2', points: -20, reason: 'Spam répété' }), SLOW);
  });

  it('shows the rules to a moderator, without the tools of the owner', async () => {
    stubApi({
      '/communities/python-africa-core/leaderboard/': { body: { success: true, data: RANKING } },
      '/communities/python-africa-core/gamification/rules/': { body: { success: true, data: RULES } },
    });
    renderAppAt('/c/python-africa-core/leaderboard');
    await screen.findByRole('list', { name: 'Barème des points' }, SLOW);
    expect(screen.queryByRole('button', { name: /Ajuster des points/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull();
    expect(screen.queryByRole('table', { name: 'Journal des points' })).toBeNull();
  });

  it('explains how to earn points when nobody has any', async () => {
    stubApi({ '/communities/python-africa-core/leaderboard/': { body: { success: true, data: [] } } });
    renderAppAt('/c/python-africa-core/leaderboard');
    expect(await screen.findByText("Personne n'a encore marqué de points", {}, SLOW)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Exporter/ })).toHaveProperty('disabled', true);
    expect(screen.getByText('Comment gagner des points')).toBeTruthy();
  });
});
