import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW, stubApi } from '@/test-utils';
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
    expect(new URL(calls[calls.length - 1].url).searchParams.get('limit')).toBe('50');
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

  it('explains how to earn points when nobody has any', async () => {
    stubApi({ '/communities/python-africa-core/leaderboard/': { body: { success: true, data: [] } } });
    renderAppAt('/c/python-africa-core/leaderboard');
    expect(await screen.findByText("Personne n'a encore marqué de points", {}, SLOW)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Exporter/ })).toHaveProperty('disabled', true);
    expect(screen.getByText('Comment gagner des points')).toBeTruthy();
  });
});
