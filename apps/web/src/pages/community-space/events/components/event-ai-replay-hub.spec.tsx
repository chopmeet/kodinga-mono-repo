import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { TEST_TOKEN } from '@/test-utils';
import type { CommunityEvent } from '@/utils/api/event/event.type';
import type { User } from '@/utils/api/user/user.type';
import { EventAIReplayHub } from './event-ai-replay-hub';

const mockEvent: CommunityEvent = {
  id: 'event-live-123',
  title: 'Atelier Architecture LiveKit & IA',
  slug: 'atelier-livekit-ia',
  description: 'Replay de la session live sur le streaming interactif.',
  community: { id: 'c-1', name: 'Dev Community', slug: 'dev-community', avatar_url: '' },
  host: {
    id: 'u-1',
    username: 'alice',
    first_name: 'Alice',
    last_name: 'Dev',
    full_name: 'Alice Dev',
    avatar_url: '',
  },
  cover_image_url: '',
  event_type: 'workshop',
  format: 'livekit',
  status: 'completed',
  start_time: '2026-10-26T18:00:00Z',
  end_time: '2026-10-26T19:00:00Z',
  timezone: 'UTC',
  venue_name: '',
  location_address: '',
  location_city: '',
  location_country: '',
  attendees_count: 15,
  max_attendees: null,
  is_full: false,
  is_upcoming: false,
  is_in_progress: false,
  is_recorded: true,
  is_public: true,
  duration_minutes: 60,
  user_rsvp_status: null,
  replay_video_asset: {
    id: 'v-1',
    title: 'Replay live',
    status: 'ready',
    hls_url: 'https://stream.mux.com/fake-playback.m3u8',
    playback_id: 'fake-playback',
  },
  has_transcription: true,
  has_summary: true,
  created_at: '2026-10-26T17:00:00Z',
};

describe('EventAIReplayHub component', () => {
  beforeEach(() => {
    store.dispatch(
      onSetUserToken({
        user: { id: 'u-test', username: 'tester', first_name: 'Test', last_name: 'User' } as User,
        token: TEST_TOKEN,
        refresh: 'r-token',
      })
    );

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      const url = new URL(request.url);
      const json = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });

      if (url.pathname.endsWith('/transcription/')) {
        return json({
          success: true,
          data: {
            status: 'ready',
            language: 'fr',
            duration_seconds: 3600,
            segments: [
              { id: 1, start: '00:01:10', end: '00:01:25', speaker: 'Alice', text: 'Bienvenue au live.' },
            ],
            summary: {
              overview: 'Revue générale du live et cas pratiques.',
              key_points: ['Points clés abordés en direct.'],
              action_items: ['Mettre en place la transcription asynchrone.'],
              decisions: ['Valider le pipeline Celery.'],
            },
          },
        });
      }

      return json({ success: true, data: null });
    });
  });

  function renderHub(event = mockEvent) {
    return render(
      <Provider store={store}>
        <EventAIReplayHub slug="dev-community" event={event} canManage={true} />
      </Provider>
    );
  }

  it('renders top toolbar with all 4 tabs', () => {
    renderHub();
    expect(screen.getByText('Espace Replay & Assistant IA')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Vidéo/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Transcription/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Résumé IA/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Chat with Docs/i })).toBeTruthy();
  });

  it('switches to transcription tab and shows search toolbar', () => {
    renderHub();
    const transcriptTabBtn = screen.getByRole('button', { name: /Transcription/i });
    act(() => {
      fireEvent.click(transcriptTabBtn);
    });

    expect(screen.getByPlaceholderText(/Rechercher dans la transcription/i)).toBeTruthy();
  });

  it('switches to executive summary tab', () => {
    renderHub();
    const summaryTabBtn = screen.getByRole('button', { name: /Résumé IA/i });
    act(() => {
      fireEvent.click(summaryTabBtn);
    });

    expect(screen.getByText(/Résumé Exécutif du Live/i)).toBeTruthy();
  });

  it('switches to Chat with Docs and renders input field and initial bot welcome', () => {
    renderHub();
    const chatTabBtn = screen.getByRole('button', { name: /Chat with Docs/i });
    act(() => {
      fireEvent.click(chatTabBtn);
    });

    expect(screen.getByPlaceholderText(/Posez une question sur ce qui s'est dit durant le live/i)).toBeTruthy();
    expect(screen.getByText(/Bonjour ! Je suis votre assistant pour le live/i)).toBeTruthy();
  });
});
