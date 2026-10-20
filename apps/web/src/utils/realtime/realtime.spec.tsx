import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW, TEST_TOKEN } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { User } from '@/utils/api/user/user.type';
import { realtimeClient } from './realtime-client';
import { useRealtimeSync } from './use-realtime';

vi.setConfig({ testTimeout: 15_000 });

/** A WebSocket of the realtime api, driven by the test */
class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  sent: Record<string, unknown>[] = [];
  onopen?: () => void;
  onmessage?: (e: { data: string }) => void;
  onclose?: (e: { code: number }) => void;
  onerror?: () => void;
  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
    setTimeout(() => {
      this.readyState = FakeWebSocket.OPEN;
      this.onopen?.();
    }, 0);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000 });
  }
  /** A server event */
  push(type: string, data: unknown) {
    act(() => this.onmessage?.({ data: JSON.stringify({ v: 1, type, data }) }));
  }
  /** A network cut */
  drop() {
    this.readyState = 3;
    act(() => this.onclose?.({ code: 1006 }));
  }
}
const socket = () => FakeWebSocket.instances.at(-1) as FakeWebSocket;

type Call = { method: string; url: URL };

function stubApi() {
  const calls: Call[] = [];
  let unread = 0;
  let tickets = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    calls.push({ method: request.method, url });
    const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
    const path = url.pathname;
    if (path.endsWith('/auth/ws-ticket/')) return json({ ticket: `t${++tickets}`, expires_in: 30 });
    if (path.endsWith('/notifications/unread-count/')) return json({ success: true, data: { unread_count: unread } });
    if (path.endsWith('/conversations/')) {
      return json([{ id: 'conv-kofi', conversation_type: 'direct', title: '', participants: [{ user: { id: 'u-kofi', username: 'kofi', first_name: 'Kofi', last_name: 'Mensah', avatar_url: '' } }, { user: { id: 'u1', username: 'fatou', first_name: 'Fatou', last_name: 'Sow', avatar_url: '' } }], last_message: null, unread_count: 0, updated_at: '2026-10-20T10:00:00Z' }]);
    }
    if (path.endsWith('/conversations/conv-kofi/messages/')) return json([]);
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
  });
  return { calls, setUnread: (n: number) => (unread = n) };
}

function SyncProbe() {
  useRealtimeSync();
  return null;
}

beforeEach(() => {
  vi.stubGlobal('WebSocket', FakeWebSocket);
  act(() => {
    store.dispatch(onSetUserToken({ user: { id: 'u1', username: 'fatou' } as User, token: TEST_TOKEN, refresh: 'r' }));
  });
});

afterEach(() => {
  cleanup();
  realtimeClient.disconnect();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  FakeWebSocket.instances = [];
  act(() => {
    store.dispatch(onLogout());
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Realtime', () => {
  it('connects with a ticket of the api, subscribes, and comes back after a cut with a new ticket', async () => {
    const { calls } = stubApi();
    render(
      <Provider store={store}>
        <SyncProbe />
      </Provider>,
    );
    await waitFor(() => expect(socket()?.readyState).toBe(FakeWebSocket.OPEN), SLOW);
    expect(socket().url).toMatch(/\/ws\/\?ticket=t1$/);
    expect(calls.find((c) => c.url.pathname.endsWith('/auth/ws-ticket/'))?.method).toBe('POST');

    realtimeClient.subscribeCommunity('c1');
    expect(socket().sent).toContainEqual({ action: 'subscribe_community', community_id: 'c1' });

    // A network cut: a new ticket, a new socket after the backoff, the subscriptions sent again
    const before = calls.length;
    socket().drop();
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2), { timeout: 4000 });
    await waitFor(() => expect(socket().readyState).toBe(FakeWebSocket.OPEN), SLOW);
    expect(socket().url).toMatch(/ticket=t2$/);
    expect(socket().sent).toContainEqual({ action: 'subscribe_community', community_id: 'c1' });
    expect(calls.slice(before).some((c) => c.url.pathname.endsWith('/auth/ws-ticket/'))).toBe(true);
  });

  it('updates the bell as soon as a notification is pushed, without polling', async () => {
    const api = stubApi();
    render(
      <Provider store={store}>
        <SyncProbe />
      </Provider>,
    );
    await waitFor(() => expect(socket()?.readyState).toBe(FakeWebSocket.OPEN), SLOW);
    renderAppAt('/notifications');
    expect(await screen.findByRole('button', { name: 'Notifications' }, SLOW)).toBeTruthy();
    api.setUnread(1);
    socket().push('notification.created', { id: 'n1', title: 'Candidature acceptée' });
    expect(await screen.findByRole('button', { name: 'Notifications (1 non lue)' }, SLOW)).toBeTruthy();
  });

  it('shows who is typing in a conversation, and sends its own typing signal', async () => {
    stubApi();
    render(
      <Provider store={store}>
        <SyncProbe />
      </Provider>,
    );
    await waitFor(() => expect(socket()?.readyState).toBe(FakeWebSocket.OPEN), SLOW);
    renderAppAt('/messages/conv-kofi');
    const input = await screen.findByLabelText('Votre message', {}, SLOW);
    await waitFor(() => expect(socket().sent).toContainEqual({ action: 'subscribe_conversation', conversation_id: 'conv-kofi' }), SLOW);

    socket().push('typing.started', { conversation_id: 'conv-kofi', user: { id: 'u-kofi', username: 'kofi' } });
    expect(await screen.findByText('kofi est en train d’écrire…', {}, SLOW)).toBeTruthy();
    socket().push('typing.stopped', { conversation_id: 'conv-kofi', user: { id: 'u-kofi', username: 'kofi' } });
    await waitFor(() => expect(screen.queryByText(/en train d’écrire/)).toBeNull(), SLOW);
    // Its own signal, echoed by the api, is not shown
    socket().push('typing.started', { conversation_id: 'conv-kofi', user: { id: 'u1', username: 'fatou' } });
    expect(screen.queryByText(/en train d’écrire/)).toBeNull();

    fireEvent.change(input, { target: { value: 'Salut' } });
    fireEvent.change(input, { target: { value: 'Salut Kofi' } });
    const typing = socket().sent.filter((m) => m.action === 'typing');
    // Throttled: one signal for the two keystrokes
    expect(typing).toEqual([{ action: 'typing', conversation_id: 'conv-kofi', is_typing: true }]);
    fireEvent.blur(input);
    expect(socket().sent.at(-1)).toEqual({ action: 'typing', conversation_id: 'conv-kofi', is_typing: false });
  });
});
