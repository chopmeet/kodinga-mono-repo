import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW, TEST_TOKEN } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { User } from '@/utils/api/user/user.type';
import { liveServerUrl } from '@/utils/http';

// No WebRTC in jsdom: the LiveKit room and its components are stand-ins
const connection = vi.hoisted(() => ({ calls: [] as { serverUrl: string; token: string; isHost: boolean }[] }));
vi.mock('./form/useRoomConnection', () => ({
  useRoomConnection: (options: { serverUrl: string; token: string; isHost: boolean }) => {
    connection.calls.push(options);
    return {};
  },
}));
vi.mock('@livekit/components-react', () => ({
  RoomContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
  Chat: () => <div>Chat du live</div>,
  ControlBar: ({ controls }: { controls: Record<string, boolean> }) => <div data-testid="controls">{Object.keys(controls).filter((k) => controls[k]).join(',')}</div>,
  FocusLayout: () => null,
  GridLayout: () => null,
  ParticipantTile: () => null,
  RoomAudioRenderer: () => null,
  isTrackReference: () => false,
  useParticipants: () => [{}, {}],
  useTracks: () => [],
}));
vi.mock('@livekit/components-styles', () => ({}));

vi.setConfig({ testTimeout: 15_000 });

type Call = { method: string; url: URL; body: Record<string, unknown> | null };

function stubLiveApi({ status = 'scheduled', isHost = true } = {}) {
  const calls: Call[] = [];
  let current = status;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ method: request.method, url, body });
    const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
    const path = url.pathname;
    if (path.endsWith('/join-live/')) return json({ success: true, data: { room_name: 'kodinga_room', token: 'lk-token', server_url: 'wss://live.kodinga.com', is_host: isHost } });
    if (path.endsWith('/status/')) {
      current = body?.status;
      return json({ success: true, data: {} });
    }
    if (path.endsWith('/events/e1/')) {
      return json({
        success: true,
        data: {
          id: 'e1', community: { id: 'c1', name: 'Abidjan React', slug: 'abidjan-react', avatar_url: '' }, host: { id: 'h', username: 'awa', full_name: 'Awa Ndiaye' },
          title: 'Live coding : React 19', slug: 'live', description: '', cover_image_url: '', event_type: 'live_stream', format: 'livekit', status: current,
          start_time: '2026-11-02T18:00:00Z', end_time: '2026-11-02T19:00:00Z', timezone: 'UTC', venue_name: '', location_address: '', location_city: '', location_country: '',
          attendees_count: 3, max_attendees: null, is_full: false, is_upcoming: true, is_in_progress: false, is_recorded: false, is_public: true, duration_minutes: 60,
          user_rsvp_status: 'attending', replay_video_asset: null, created_at: '',
        },
      });
    }
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
  });
  return calls;
}

const signIn = () =>
  act(() => {
    store.dispatch(onSetUserToken({ user: { id: 'u1', username: 'awa' } as User, token: TEST_TOKEN, refresh: 'r' }));
  });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  connection.calls.length = 0;
  act(() => {
    store.dispatch(onLogout());
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Live room of an event', () => {
  it('lets the host enter the waiting room, publish, start and end the live', async () => {
    signIn();
    const calls = stubLiveApi({ status: 'scheduled', isHost: true });
    const { where } = renderAppAt('/communities/abidjan-react/events/e1/live');
    fireEvent.click(await screen.findByRole('button', { name: /Entrer dans la salle d’attente/ }, SLOW));
    await waitFor(() => expect(calls.some((c) => c.url.pathname.endsWith('/join-live/'))).toBe(true), SLOW);
    // The local server in dev (docker), the url of the api elsewhere (utils/http.ts)
    await waitFor(() => expect(connection.calls.at(-1)).toEqual({ serverUrl: liveServerUrl('wss://live.kodinga.com'), token: 'lk-token', isHost: true, onLeft: expect.any(Function) }), SLOW);
    expect(screen.getByText('Salle d’attente')).toBeTruthy();
    expect(screen.getByTestId('controls').textContent).toBe('camera,microphone,screenShare,leave');
    expect(screen.getByLabelText('2 dans la salle')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Démarrer le live/ }));
    await waitFor(() => expect(calls.find((c) => c.url.pathname.endsWith('/status/'))?.body).toEqual({ status: 'live' }), SLOW);
    fireEvent.click(await screen.findByRole('button', { name: /Terminer le live/ }, SLOW));
    await waitFor(() => expect(calls.filter((c) => c.url.pathname.endsWith('/status/')).at(-1)?.body).toEqual({ status: 'completed' }), SLOW);
    await waitFor(() => expect(where()).toBe('/communities/abidjan-react?tab=events'), SLOW);
  });

  it('lets a member watch, without camera nor host buttons', async () => {
    signIn();
    stubLiveApi({ status: 'live', isHost: false });
    renderAppAt('/communities/abidjan-react/events/e1/live');
    fireEvent.click(await screen.findByRole('button', { name: /Rejoindre le live/ }, SLOW));
    expect((await screen.findByTestId('controls', {}, SLOW)).textContent).toBe('leave');
    expect(screen.queryByRole('button', { name: /Démarrer le live|Terminer le live/ })).toBeNull();
  });

  it('says when the live is over, and asks a visitor to sign in', async () => {
    stubLiveApi({ status: 'completed' });
    renderAppAt('/communities/abidjan-react/events/e1/live');
    expect(await screen.findByText(/Ce live est terminé/, {}, SLOW)).toBeTruthy();
    // Back to the events of the community, a button readable on the dark room (not the white outline)
    const back = screen.getByRole('link', { name: 'Retour aux événements' });
    expect(back.getAttribute('href')).toBe('/communities/abidjan-react?tab=events');
    expect(back.className).toContain('text-white');
    expect(back.className).not.toContain('bg-white ');
    // The badge says it is over, nothing to invite to
    expect(screen.getByText('Live terminé')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Copier le lien du live/ })).toBeNull();
    cleanup();
    act(() => {
      store.dispatch(CommunityApi.util.resetApiState());
    });
    vi.restoreAllMocks();
    stubLiveApi({ status: 'live' });
    renderAppAt('/communities/abidjan-react/events/e1/live');
    expect((await screen.findByRole('link', { name: 'Se connecter pour rejoindre' }, SLOW)).getAttribute('href')).toContain('/auth/login');
  });

  it('displays a dedicated forbidden screen when a private live is not accessible to non-members', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL((input as Request).url);
      if (url.pathname.endsWith('/events/e1/')) {
        return new Response(JSON.stringify({ success: false, message: 'Vous devez être membre actif de cette communauté.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: true, data: [] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    });

    renderAppAt('/communities/abidjan-react/events/e1/live');
    expect(await screen.findByText('Ce direct est réservé aux membres de la communauté', {}, SLOW)).toBeTruthy();
    expect(screen.getByText(/L’organisateur a configuré ce live en mode privé/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Se connecter pour rejoindre' })).toBeTruthy();
  });

  it('displays privacy badge in lobby for private live sessions', async () => {
    signIn();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL((input as Request).url);
      if (url.pathname.endsWith('/events/e1/')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              id: 'e1',
              community: { id: 'c1', name: 'Abidjan React', slug: 'abidjan-react', avatar_url: '' },
              host: { id: 'h', username: 'awa', full_name: 'Awa Ndiaye' },
              title: 'Live privé : Code review',
              slug: 'live-prive',
              description: '',
              cover_image_url: '',
              event_type: 'live_stream',
              format: 'livekit',
              status: 'live',
              start_time: '2026-11-02T18:00:00Z',
              end_time: '2026-11-02T19:00:00Z',
              timezone: 'UTC',
              attendees_count: 5,
              max_attendees: null,
              is_full: false,
              is_upcoming: true,
              is_in_progress: true,
              is_recorded: false,
              is_public: false,
              duration_minutes: 60,
              user_rsvp_status: 'attending',
              replay_video_asset: null,
              created_at: '',
            },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ success: true, data: [] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    });

    renderAppAt('/communities/abidjan-react/events/e1/live');
    expect(await screen.findByText(/Réservé aux membres/, {}, SLOW)).toBeTruthy();
  });
});
