import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { User } from '@/utils/api/user/user.type';
import i18n from '@/utils/i18n';
import { contentKind } from './components/notification-item';
import { notificationHref } from './form/UseNotifications';

vi.setConfig({ testTimeout: 15_000 });

type Call = { method: string; url: URL };

const notification = (id: string, title: string, action_url: string, is_read = false) => ({
  id,
  notification_type: 'system',
  title,
  body: `Détail de ${title}`,
  action_url,
  target_type: '',
  target_id: '',
  is_read,
  read_at: null,
  actor: null,
  created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
});

/** reviews: the user owns "Abidjan React", where Kofi asked to join */
function stubNotificationsApi({ reviews = false, notified = false } = {}) {
  const calls: Call[] = [];
  let pending = reviews ? [{ id: 'm9', user: { id: 'u9', username: 'kofi', first_name: 'Kofi', last_name: 'Mensah' }, role: 'member', status: 'pending', custom_title: '', joined_at: '', reputation_score: 0, created_at: '2026-10-30T10:00:00Z' }] : [];
  const items = [
    notification('n1', 'Candidature acceptée', '/communities/abidjan-react/hackathons/devfest'),
    notification('n2', 'Invitation d’équipe', '/communities/abidjan-react/hackathons/devfest/teams'),
    notification('n3', 'Nouveau vote reçu', '/projects/wari-pay', true),
    ...(notified ? [{ ...notification('n4', 'Nouvelle demande d’adhésion : Abidjan React', '/communities/abidjan-react/members?status=pending'), notification_type: 'join_request', target_type: 'community_member', target_id: 'm9' }] : []),
  ];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    calls.push({ method: request.method, url });
    const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const path = url.pathname;
    const community = { id: 'c1', name: 'Abidjan React', slug: 'abidjan-react', members_count: 12, privacy_type: 'private', pricing_type: 'free' };
    if (reviews && path.endsWith('/communities/my/')) return json({ success: true, pagination: { count: 1 }, results: [community] });
    if (reviews && path.endsWith('/communities/abidjan-react/')) return json({ success: true, data: { ...community, user_membership: { is_member: true, role: 'owner', status: 'active' } } });
    if (path.endsWith('/communities/abidjan-react/members/') && url.searchParams.get('status') === 'pending') {
      return json({ success: true, pagination: { count: pending.length }, results: pending });
    }
    if (path.endsWith('/communities/abidjan-react/members/m9/') && request.method === 'PUT') {
      calls.push({ method: 'PUT', url });
      pending = [];
      return json({ success: true, data: { id: 'm9', status: 'active' } });
    }
    if (path.endsWith('/notifications/unread-count/')) return json({ success: true, data: { unread_count: items.filter((n) => !n.is_read).length } });
    if (path.endsWith('/notifications/read-all/')) {
      items.forEach((n) => (n.is_read = true));
      return json({ success: true, data: null });
    }
    const read = path.match(/notifications\/([^/]+)\/read\/$/)?.[1];
    if (read) {
      items.forEach((n) => n.id === read && (n.is_read = true));
      return json({ success: true, data: null });
    }
    const removed = path.match(/notifications\/([^/]+)\/$/)?.[1];
    if (removed && request.method === 'DELETE') {
      items.splice(items.findIndex((n) => n.id === removed), 1);
      return json({ success: true, data: null });
    }
    if (path.endsWith('/notifications/')) {
      const found = url.searchParams.get('unread') === 'true' ? items.filter((n) => !n.is_read) : items;
      return json({ success: true, pagination: { count: found.length }, results: found });
    }
    // Pages reached from a notification: not what is tested here
    return new Response(JSON.stringify({ success: false, code: 'not_found', message: 'Introuvable' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
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

describe('contentKind', () => {
  it('names the content of a notification from its target, else from its link', () => {
    // A new hackathon comes as an "invitation" with target_type "hackathon"
    expect(contentKind({ target_type: 'hackathon', action_url: '/communities/a/hackathons/devfest' })).toBe('hackathon');
    expect(contentKind({ target_type: 'hackathon_team', action_url: '/communities/a/hackathons/devfest/teams' })).toBe('hackathon');
    expect(contentKind({ target_type: '', action_url: '/communities/a/courses/react-19' })).toBe('course');
    expect(contentKind({ target_type: '', action_url: '/projects/wari-pay' })).toBe('project');
    expect(contentKind({ target_type: '', action_url: '/opportunities/dev-react' })).toBe('opportunity');
    expect(contentKind({ target_type: '', action_url: '/c/a/events/e1' })).toBe('event');
    expect(contentKind({ target_type: 'user', action_url: '/messages/c1' })).toBeNull();
  });
});

describe('notificationHref', () => {
  it('sends the links of the api to the pages of the app', () => {
    expect(notificationHref('/communities/a/hackathons/h')).toBe('/communities/a/hackathons/h');
    expect(notificationHref('/communities/a/hackathons/h/teams')).toBe('/communities/a/hackathons/h?tab=space');
    expect(notificationHref('/communities/a/hackathons/h/results')).toBe('/communities/a/hackathons/h?tab=results');
    expect(notificationHref('/communities/a/hackathons/h/judging')).toBe('/c/a/hackathons/h?tab=projects');
    expect(notificationHref('/messages/42')).toBe('/messages/42');
    expect(notificationHref('/projects/wari-pay')).toBe('/projects/wari-pay');
    expect(notificationHref('/opportunities/dev-react')).toBe('/opportunities/dev-react');
    expect(notificationHref('/opportunities/dev-react/applications')).toBe('/opportunities/dev-react');
    // Named after the routes of the api
    expect(notificationHref('/communities/a/members?status=pending')).toBe('/c/a/members?status=pending');
    expect(notificationHref('/communities/a/members')).toBe('/c/a/members');
    expect(notificationHref('/communities/a/classroom/react-19')).toBe('/communities/a/courses/react-19');
    expect(notificationHref('/communities/a/opportunities/dev-react')).toBe('/opportunities/dev-react');
    expect(notificationHref('/communities/a/projects/wari-pay')).toBe('/projects/wari-pay');
    expect(notificationHref('/communities/a/events/atelier')).toBe('/communities/a?tab=events');
    expect(notificationHref('/communities/a/events/e1/live')).toBe('/communities/a/events/e1/live');
    expect(notificationHref('/communities/a')).toBe('/communities/a');
    expect(notificationHref('/invite/TOKEN')).toBe('/invite/TOKEN');
    // No page in the app (yet), or not a path of the app
    expect(notificationHref('/profile/badges')).toBeNull();
    expect(notificationHref('https://evil.example.com')).toBeNull();
    expect(notificationHref('//evil.example.com')).toBeNull();
  });
});

describe('Notifications', () => {
  it('shows the unread count on the bell, opens a notification and marks it read', async () => {
    signIn();
    const calls = stubNotificationsApi();
    const { where } = renderAppAt('/notifications');
    const bell = await screen.findByRole('button', { name: 'Notifications (2 non lues)' }, SLOW);
    act(() => bell.focus());
    fireEvent.keyDown(bell, { key: 'Enter' });
    const menu = await screen.findByRole('menu', {}, SLOW);
    fireEvent.click(await within(menu).findByRole('menuitem', { name: /Invitation d’équipe/ }, SLOW));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.pathname.endsWith('/notifications/n2/read/'))).toBe(true), SLOW);
    // The team invitation opens the participant space of the hackathon
    await waitFor(() => expect(where()).toBe('/communities/abidjan-react/hackathons/devfest?tab=space'), SLOW);
    expect(await screen.findByRole('button', { name: 'Notifications (1 non lue)' }, SLOW)).toBeTruthy();
  });

  it('lists the notifications, filters the unread ones, marks all read and deletes one', async () => {
    signIn();
    const calls = stubNotificationsApi();
    renderAppAt('/notifications');
    const list = await screen.findByRole('list', { name: 'Notifications' }, SLOW);
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Non lues' }));
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Notifications' })).getAllByRole('listitem')).toHaveLength(2), SLOW);

    fireEvent.click(within(screen.getByRole('main')).getByRole('button', { name: /Tout marquer comme lu/ }));
    await waitFor(() => expect(calls.some((c) => c.url.pathname.endsWith('/notifications/read-all/'))).toBe(true), SLOW);
    expect(await screen.findByText('Aucune notification non lue', {}, SLOW)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Toutes' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer la notification : Nouveau vote reçu' }, SLOW));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.url.pathname.endsWith('/notifications/n3/'))).toBe(true), SLOW);
  });

  it('lists the join requests of the communities the user reviews, to accept them here', async () => {
    signIn();
    const calls = stubNotificationsApi({ reviews: true });
    renderAppAt('/notifications');
    const requests = await screen.findByRole('list', { name: 'Demandes d’adhésion' }, SLOW);
    expect(within(requests).getByText(/souhaite rejoindre/).textContent).toMatch(/Kofi Mensah souhaite rejoindre Abidjan React/);
    expect(within(requests).getByRole('link', { name: 'Abidjan React' }).getAttribute('href')).toBe('/c/abidjan-react/members?status=pending');
    fireEvent.click(within(requests).getByRole('button', { name: 'Accepter Kofi Mensah' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT' && c.url.pathname.endsWith('/members/m9/'))).toBe(true), SLOW);
    // Read again: nothing left to answer
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Demandes d’adhésion' })).toBeNull(), SLOW);
  });

  it('answers a join request on its notification, without showing it twice', async () => {
    signIn();
    const calls = stubNotificationsApi({ reviews: true, notified: true });
    renderAppAt('/notifications');
    const list = await screen.findByRole('list', { name: 'Notifications' }, SLOW);
    const accept = await within(list).findByRole('button', { name: 'Accepter Kofi Mensah' }, SLOW);
    expect(screen.queryByRole('list', { name: 'Demandes d’adhésion' })).toBeNull();
    fireEvent.click(accept);
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT' && c.url.pathname.endsWith('/members/m9/'))).toBe(true), SLOW);
    // Marked read, and the decision replaces the buttons
    await waitFor(() => expect(calls.some((c) => c.url.pathname.endsWith('/notifications/n4/read/'))).toBe(true), SLOW);
    expect(await within(list).findByText('Demande acceptée', {}, SLOW)).toBeTruthy();
    expect(within(list).queryByRole('button', { name: 'Accepter Kofi Mensah' })).toBeNull();
  });

  it('shows no join request to a user who reviews none', async () => {
    signIn();
    stubNotificationsApi();
    renderAppAt('/notifications');
    await screen.findByRole('list', { name: 'Notifications' }, SLOW);
    expect(screen.queryByRole('list', { name: 'Demandes d’adhésion' })).toBeNull();
  });

  it('says what content a notification is about', async () => {
    signIn();
    stubNotificationsApi();
    renderAppAt('/notifications');
    const list = await screen.findByRole('list', { name: 'Notifications' }, SLOW);
    const items = within(list).getAllByRole('listitem');
    expect(items[0].textContent).toMatch(/^HackathonCandidature acceptée/);
    expect(items[2].textContent).toMatch(/^ProjetNouveau vote reçu/);
  });

  it('has no bell for a visitor', async () => {
    stubNotificationsApi();
    renderAppAt('/notifications');
    expect(await screen.findByRole('heading', { name: 'Vos notifications' }, SLOW)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Notifications/ })).toBeNull();
  });

  it('speaks English: title, filters, content kinds and actions', async () => {
    await act(() => i18n.changeLanguage('en'));
    try {
      signIn();
      stubNotificationsApi();
      renderAppAt('/notifications');
      const list = await screen.findByRole('list', { name: 'Notifications' }, SLOW);
      expect(within(list).getAllByRole('listitem')[2].textContent).toMatch(/^ProjectNouveau vote reçu/);
      expect(screen.getByRole('button', { name: 'Unread' })).toBeTruthy();
      expect(screen.getByText('2 unread')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Delete the notification: Nouveau vote reçu' })).toBeTruthy();
    } finally {
      await act(() => i18n.changeLanguage('fr'));
    }
  });
});
