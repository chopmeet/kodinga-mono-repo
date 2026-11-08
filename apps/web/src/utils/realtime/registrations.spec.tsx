import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  push(type: string, data: unknown) {
    act(() => this.onmessage?.({ data: JSON.stringify({ v: 1, type, data }) }));
  }
  drop() {
    this.readyState = 3;
    act(() => this.onclose?.({ code: 1006 }));
  }
}
const socket = () => FakeWebSocket.instances.at(-1) as FakeWebSocket;

const at = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const event = (attendees_count: number) => ({
  id: 'e1', slug: 'atelier', title: 'Atelier React 19', community: { id: 'c1', name: 'Abidjan React', slug: 'abidjan-react', avatar_url: '' }, host: null, description: '',
  cover_image_url: '', event_type: 'workshop', format: 'external', status: 'scheduled', timezone: 'UTC', is_public: true, venue_name: '', location_address: '', location_city: '',
  location_country: '', attendees_count, max_attendees: 30, is_full: false, is_upcoming: true, is_in_progress: false, is_recorded: false, duration_minutes: 60,
  replay_video_asset: null, start_time: at(2), end_time: at(2), created_at: at(-1), user_rsvp_status: null,
});

function stubApi() {
  const urls: URL[] = [];
  let attendees = 3;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL((input as Request).url);
    urls.push(url);
    const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
    const path = url.pathname;
    if (path.endsWith('/auth/ws-ticket/')) return json({ ticket: 't', expires_in: 30 });
    if (path.endsWith('/communities/abidjan-react/')) {
      return json({ success: true, data: { id: 'c1', name: 'Abidjan React', slug: 'abidjan-react', privacy_type: 'public', pricing_type: 'free', members_count: 40, owner: { id: 'o', username: 'o' }, user_membership: { is_member: true, role: 'member', status: 'active' } } });
    }
    if (path.endsWith('/communities/abidjan-react/events/')) return json({ success: true, pagination: { count: 1 }, results: [event(attendees)] });
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
  });
  return { urls, setAttendees: (n: number) => (attendees = n) };
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

/** The events tab of abidjan-react, with the WebSocket open and the community followed */
async function openEventsTab() {
  const api = stubApi();
  render(
    <Provider store={store}>
      <SyncProbe />
    </Provider>,
  );
  renderAppAt('/communities/abidjan-react?tab=events');
  await screen.findByText('3 participants / 30', {}, SLOW);
  await waitFor(() => expect(socket()?.sent).toContainEqual({ action: 'subscribe_community', community_id: 'c1' }), SLOW);
  return api;
}

const registration = (attendees_count: number, community_id = 'c1') => ({ community_id, event_id: 'e1', event_slug: 'atelier', attendees_count, max_attendees: 30, is_full: false });

describe('Registration counters, live', () => {
  it('shows the registrations of the others without reloading, the total of the api as it is', async () => {
    await openEventsTab();
    socket().push('event.registration_updated', registration(4));
    expect(await screen.findByText('4 participants / 30', {}, SLOW)).toBeTruthy();
    // Received twice: still the total of the api, never 5
    socket().push('event.registration_updated', registration(4));
    expect(screen.getByText('4 participants / 30')).toBeTruthy();
    // Another community: not this counter
    socket().push('event.registration_updated', registration(9, 'c2'));
    expect(screen.queryByText('9 participants / 30')).toBeNull();
  });

  it('reads the counters again after a network cut, to catch what was missed', async () => {
    const { urls, setAttendees } = await openEventsTab();
    const before = urls.filter((u) => u.pathname.endsWith('/communities/abidjan-react/events/')).length;
    setAttendees(7);
    socket().drop();
    await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(1), { timeout: 4000 });
    expect(await screen.findByText('7 participants / 30', {}, { timeout: 6000 })).toBeTruthy();
    expect(urls.filter((u) => u.pathname.endsWith('/communities/abidjan-react/events/')).length).toBeGreaterThan(before);
  });

  it('keeps following the community for the feed when the events tab is left', async () => {
    await openEventsTab();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Sections de la communauté' })).getByRole('link', { name: 'Communauté' }));
    await screen.findByPlaceholderText('Rechercher une discussion…', {}, SLOW);
    // The last word on the community: still followed
    const last = socket().sent.filter((m) => m.community_id === 'c1').at(-1);
    expect(last).toEqual({ action: 'subscribe_community', community_id: 'c1' });
  });

  it('closes the topic of a community only when nobody follows it any more', async () => {
    stubApi();
    render(
      <Provider store={store}>
        <SyncProbe />
      </Provider>,
    );
    await waitFor(() => expect(socket()?.readyState).toBe(FakeWebSocket.OPEN), SLOW);
    realtimeClient.subscribeCommunity('c9');
    realtimeClient.subscribeCommunity('c9');
    const forC9 = () => socket().sent.filter((m) => m.community_id === 'c9');
    expect(forC9()).toEqual([{ action: 'subscribe_community', community_id: 'c9' }]);
    realtimeClient.unsubscribeCommunity('c9');
    expect(forC9()).toHaveLength(1);
    realtimeClient.unsubscribeCommunity('c9');
    expect(forC9().at(-1)).toEqual({ action: 'unsubscribe_community', community_id: 'c9' });
  });
});
