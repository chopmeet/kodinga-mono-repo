import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW, TEST_TOKEN } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { User } from '@/utils/api/user/user.type';

vi.setConfig({ testTimeout: 15_000 });

type Call = { method: string; url: URL; body: Record<string, unknown> | null };
const READY = { id: 'v1', status: 'ready', hls_url: 'https://stream.mux.com/abc.m3u8', playback_id: 'abc', poster_url: '' };

const event = (replay: unknown) => ({
  id: 'e1', community: { id: 'c1', name: 'Dakar DevOps', slug: 'dakar-devops', avatar_url: '' }, host: null, title: 'Atelier Kubernetes', slug: 'k8s',
  description: '', cover_image_url: '', event_type: 'workshop', format: 'livekit', status: 'completed',
  start_time: '2026-10-10T18:00:00Z', end_time: '2026-10-10T20:00:00Z', timezone: 'UTC', venue_name: '', location_address: '', location_city: '', location_country: '',
  attendees_count: 8, max_attendees: null, is_full: false, is_upcoming: false, is_in_progress: false, is_recorded: true, is_public: true, duration_minutes: 120,
  user_rsvp_status: null, replay_video_asset: replay, created_at: '',
});

function stubApi({ replay = null as unknown } = {}) {
  const calls: Call[] = [];
  let current = replay;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ method: request.method, url, body });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    const path = url.pathname;
    if (path.endsWith('/media/videos/upload-url/')) return json({ success: true, data: { video_asset_id: 'v-new', upload_id: 'u1', upload_url: 'https://storage.mux.com/upload/u1', status: 'waiting' } }, 201);
    if (path.endsWith('/events/e1/replay/')) {
      current = { id: 'v-new', status: 'preparing', hls_url: '' };
      return json({ success: true, data: event(current) });
    }
    if (path.endsWith('/events/e1/attendees/')) return json({ success: true, data: [] });
    if (path.endsWith('/events/e1/')) return json({ success: true, data: event(current) });
    if (path.endsWith('/events/')) {
      const past = url.searchParams.get('status') === 'completed';
      return json({ success: true, pagination: { count: past ? 1 : 0 }, results: past ? [event(current)] : [] });
    }
    if (path.endsWith('/communities/abidjan-react/')) {
      return json({ success: true, data: { id: 'c2', name: 'Abidjan React', slug: 'abidjan-react', privacy_type: 'public', pricing_type: 'free', members_count: 4, owner: { id: 'o', username: 'o' }, user_membership: { is_member: true, role: 'member', status: 'active' } } });
    }
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
  });
  return calls;
}

/** The PUT to Mux goes through XMLHttpRequest (for its progress): a stand-in that succeeds */
class FakeXhr {
  static sent: { method: string; url: string; body: unknown }[] = [];
  upload: { onprogress?: (e: { lengthComputable: boolean; loaded: number; total: number }) => void } = {};
  onload?: () => void;
  onerror?: () => void;
  status = 200;
  private method = '';
  private url = '';
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  send(body: unknown) {
    FakeXhr.sent.push({ method: this.method, url: this.url, body });
    setTimeout(() => {
      this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
      setTimeout(() => this.onload?.(), 50);
    }, 20);
  }
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  FakeXhr.sent = [];
  act(() => {
    store.dispatch(onLogout());
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Replay of an event', () => {
  it('sends the video of the replay to Mux, attaches it and says it is being prepared', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    const calls = stubApi();
    renderAppAt('/c/dakar-devops/events/e1');
    const input = await screen.findByLabelText('Fichier du replay', {}, SLOW);
    fireEvent.change(input, { target: { files: [new File(['%PDF'], 'notes.pdf', { type: 'application/pdf' })] } });
    expect((await screen.findByRole('alert', {}, SLOW)).textContent).toMatch(/Format non pris en charge/);

    fireEvent.change(screen.getByLabelText('Fichier du replay'), { target: { files: [new File(['video'], 'live.mp4', { type: 'video/mp4' })] } });
    await waitFor(() => expect(calls.find((c) => c.url.pathname.endsWith('/media/videos/upload-url/'))?.body).toMatchObject({ title: 'Atelier Kubernetes (replay)' }), SLOW);
    await waitFor(() => expect(FakeXhr.sent[0]).toMatchObject({ method: 'PUT', url: 'https://storage.mux.com/upload/u1' }), SLOW);
    await waitFor(() => expect(calls.find((c) => c.url.pathname.endsWith('/events/e1/replay/'))?.body).toEqual({ video_asset_id: 'v-new' }), SLOW);
    expect(await screen.findByText(/Le replay est en cours de préparation/, {}, SLOW)).toBeTruthy();
  });

  it('adds the replay from the link of a video file, not of a platform', async () => {
    const calls = stubApi();
    renderAppAt('/c/dakar-devops/events/e1');
    fireEvent.click(await screen.findByRole('button', { name: /Lien vidéo/ }, SLOW));
    const link = screen.getByLabelText('Lien de la vidéo du replay');
    fireEvent.change(link, { target: { value: 'https://youtu.be/abc123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect((await screen.findByRole('alert', {}, SLOW)).textContent).toMatch(/pas YouTube/);
    expect(calls.some((c) => c.url.pathname.endsWith('/events/e1/replay/'))).toBe(false);

    fireEvent.change(link, { target: { value: 'https://cdn.example.com/live.mp4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(() => expect(calls.find((c) => c.url.pathname.endsWith('/events/e1/replay/'))?.body).toEqual({ video_url: 'https://cdn.example.com/live.mp4' }), SLOW);
    await waitFor(() => expect(screen.queryByLabelText('Lien de la vidéo du replay')).toBeNull(), SLOW);
  });

  it('plays a ready replay in the space', async () => {
    stubApi({ replay: READY });
    renderAppAt('/c/dakar-devops/events/e1');
    expect(await screen.findByLabelText('Replay : Atelier Kubernetes', {}, SLOW)).toBeTruthy();
    // The owner can replace it
    expect(screen.getByText('Remplacer la vidéo')).toBeTruthy();
  });

  it('lists the past events with their replay on the community page', async () => {
    act(() => {
      store.dispatch(onSetUserToken({ user: { id: 'u1', username: 'fatou' } as User, token: TEST_TOKEN, refresh: 'r' }));
    });
    stubApi({ replay: READY });
    renderAppAt('/communities/abidjan-react?tab=events');
    expect(await screen.findByText('Aucun événement à venir', {}, SLOW)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Passés et replays' }));
    const list = await screen.findByRole('list', { name: 'Événements passés' }, SLOW);
    fireEvent.click(within(list).getByRole('button', { name: /Voir le replay/ }));
    expect(await within(list).findByLabelText('Replay : Atelier Kubernetes', {}, SLOW)).toBeTruthy();
  });
});
