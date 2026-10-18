import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { PostPoll } from '@/utils/api/community/community.type';
import type { User } from '@/utils/api/user/user.type';

vi.setConfig({ testTimeout: 15_000 });

const AWA = { id: 'u-awa', username: 'awa', first_name: 'Awa', last_name: 'Ndiaye' };

const poll = (votes: Record<string, number>, mine: string[]): PostPoll => {
  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  return {
    id: 'poll1',
    question: 'Quel framework pour 2027 ?',
    is_multiple_choice: false,
    expires_at: '2026-12-01T10:00:00Z',
    total_votes: total,
    is_expired: false,
    user_has_voted: mine.length > 0,
    user_voted_option_ids: mine,
    options: ['React', 'Vue', 'Svelte'].map((text, order) => ({ id: `o${order}`, text, order, votes_count: votes[`o${order}`] ?? 0, percentage: total ? ((votes[`o${order}`] ?? 0) / total) * 100 : 0 })),
  };
};

/** A poll post of abidjan-react; votes replace the previous one like the api */
function stubPollApi() {
  const votes: Record<string, number> = { o0: 3, o1: 1, o2: 0 };
  let mine: string[] = [];
  const calls: { url: URL; body: Record<string, unknown> | null }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ url, body });
    const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
    const path = url.pathname;
    if (path.endsWith('/communities/abidjan-react/')) {
      return json({ success: true, data: { id: 'c-ar', name: 'Abidjan React', slug: 'abidjan-react', privacy_type: 'public', pricing_type: 'free', members_count: 40, owner: AWA, user_membership: { is_member: true, role: 'member', status: 'active' } } });
    }
    if (path.endsWith('/posts/p1/vote/')) {
      mine.forEach((id) => (votes[id] -= 1));
      mine = body?.option_ids as string[];
      mine.forEach((id) => (votes[id] += 1));
      return json({ success: true, data: poll(votes, mine) });
    }
    if (path.endsWith('/posts/p1/comments/')) return json({ success: true, data: [] });
    if (path.endsWith('/posts/p1/')) {
      return json({ success: true, data: { id: 'p1', community_id: 'c-ar', author: AWA, title: 'Quel framework pour 2027 ?', content: 'On prépare les ateliers.', post_type: 'poll', reactions_count: 0, comments_count: 0, user_reactions: [], created_at: '2026-10-17T10:00:00Z', poll: poll(votes, mine) } });
    }
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
  });
  return calls;
}

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '');

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(onLogout());
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Poll vote', () => {
  it('lets a member vote, see the results, then change the vote', async () => {
    act(() => {
      store.dispatch(onSetUserToken({ user: AWA as unknown as User, token: `${b64({ alg: 'HS256' })}.${b64({ exp: 4102444800 })}.sig`, refresh: 'r' }));
    });
    const calls = stubPollApi();
    renderAppAt('/communities/abidjan-react/posts/p1');
    const section = await screen.findByRole('region', { name: 'Sondage : Quel framework pour 2027 ?' }, SLOW);
    fireEvent.click(within(section).getByRole('radio', { name: 'Vue' }));
    fireEvent.click(within(section).getByRole('button', { name: 'Voter' }));
    await waitFor(() => expect(calls.find((c) => c.url.pathname.endsWith('/posts/p1/vote/'))?.body).toEqual({ option_ids: ['o1'] }), SLOW);

    // Results: 5 votes, Vue (2) is the user's choice
    const results = await within(section).findByRole('list', { name: 'Résultats du sondage' }, SLOW);
    expect(within(results).getByLabelText('Votre choix').closest('li')?.textContent).toContain('Vue');
    expect(within(section).getByText('5 votes')).toBeTruthy();

    fireEvent.click(within(section).getByRole('button', { name: 'Modifier mon vote' }));
    fireEvent.click(within(section).getByRole('radio', { name: 'Svelte' }));
    fireEvent.click(within(section).getByRole('button', { name: 'Enregistrer mon vote' }));
    await waitFor(() => expect(calls.filter((c) => c.url.pathname.endsWith('/posts/p1/vote/')).at(-1)?.body).toEqual({ option_ids: ['o2'] }), SLOW);
    expect((await within(section).findByLabelText('Votre choix', {}, SLOW)).closest('li')?.textContent).toContain('Svelte');
  });
});
