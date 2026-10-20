import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { User } from '@/utils/api/user/user.type';
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

function stubNotificationsApi() {
  const calls: Call[] = [];
  const items = [
    notification('n1', 'Candidature acceptée', '/communities/abidjan-react/hackathons/devfest'),
    notification('n2', 'Invitation d’équipe', '/communities/abidjan-react/hackathons/devfest/teams'),
    notification('n3', 'Nouveau vote reçu', '/projects/wari-pay', true),
  ];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    calls.push({ method: request.method, url });
    const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const path = url.pathname;
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

  it('has no bell for a visitor', async () => {
    stubNotificationsApi();
    renderAppAt('/notifications');
    expect(await screen.findByRole('heading', { name: 'Vos notifications' }, SLOW)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Notifications/ })).toBeNull();
  });
});
