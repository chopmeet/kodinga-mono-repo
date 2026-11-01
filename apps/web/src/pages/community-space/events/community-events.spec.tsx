import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { CommunityEvent } from '@/utils/api/event/event.type';

vi.setConfig({ testTimeout: 15_000 });

const event = (id: string, title: string, status: CommunityEvent['status'], days: number): CommunityEvent => {
  const start = new Date(Date.now() + days * 86_400_000);
  return {
    id,
    community: { id: 'c', name: 'Dakar DevOps', slug: 'dakar-devops', avatar_url: '' },
    host: { id: 'u1', username: 'moussa', first_name: 'Moussa', last_name: 'Diallo', full_name: 'Moussa Diallo', avatar_url: '' },
    title,
    slug: id,
    description: 'Retour terrain Kubernetes.',
    cover_image_url: '',
    event_type: 'workshop',
    format: 'in_person',
    status,
    start_time: start.toISOString(),
    end_time: new Date(start.getTime() + 2 * 3_600_000).toISOString(),
    timezone: 'Africa/Dakar',
    venue_name: 'Jokkolabs',
    location_address: '',
    location_city: 'Dakar',
    location_country: 'Sénégal',
    attendees_count: 12,
    max_attendees: 40,
    is_full: false,
    is_upcoming: days > 0,
    is_in_progress: status === 'live',
    is_recorded: true,
    is_public: true,
    duration_minutes: 120,
    user_rsvp_status: null,
    replay_video_asset: null,
    created_at: start.toISOString(),
  };
};

type Call = { method: string; url: URL; body: Record<string, unknown> | null };

/** Fake events api of dakar-devops: list (status / upcoming filters), detail, CRUD, status, attendees */
function stubEventsApi() {
  let events = [event('e1', 'Atelier Kubernetes', 'scheduled', 3), event('e2', 'Meetup DevOps', 'completed', -10)];
  const checkedIn = new Set<string>();
  const calls: Call[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ method: request.method, url, body });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    const path = url.pathname;
    const id = path.match(/events\/([^/]+)\//)?.[1];

    if (path.endsWith('/check-in/')) {
      checkedIn.add(String(body?.user_id));
      return json({ success: true, data: { id: 'a3', status: 'attending', checked_in_at: '2026-10-12T18:00:00Z' } });
    }
    if (path.endsWith('/attendees/')) {
      const attendees = [
        { id: 'a1', event_id: id, status: 'attending', checked_in_at: '2026-10-02T18:05:00Z', created_at: '2026-10-01T10:00:00Z', user: { id: 'u2', username: 'awa', full_name: 'Awa Ndiaye' } },
        { id: 'a2', event_id: id, status: 'maybe', checked_in_at: null, created_at: '2026-10-01T11:00:00Z', user: { id: 'u3', username: 'kofi', full_name: 'Kofi Mensah' } },
        { id: 'a3', event_id: id, status: 'attending', checked_in_at: checkedIn.has('u4') ? '2026-10-12T18:00:00Z' : null, created_at: '2026-10-01T12:00:00Z', user: { id: 'u4', username: 'seynabou', full_name: 'Seynabou Fall' } },
      ];
      // ?all=true: the whole list, not paginated (like the api)
      if (url.searchParams.get('all') === 'true') return json({ success: true, data: attendees });
      return json({ success: true, pagination: { count: attendees.length }, results: attendees });
    }
    if (path.endsWith('/status/')) {
      events = events.map((e) => (e.id === id ? { ...e, status: body?.status } : e));
      return json({ success: true, data: events.find((e) => e.id === id) });
    }
    if (path.endsWith('/communities/dakar-devops/events/')) {
      if (request.method === 'POST') {
        const created = { ...event('e3', String(body?.title), 'scheduled', 5), ...body };
        events = [...events, created as CommunityEvent];
        return json({ success: true, data: created }, 201);
      }
      const p = url.searchParams;
      const found = events.filter(
        (e) => (!p.get('status') || e.status === p.get('status')) && (p.get('upcoming') !== 'true' || new Date(e.start_time) > new Date())
      );
      return json({ success: true, pagination: { count: found.length }, results: found });
    }
    if (id && request.method === 'DELETE') {
      events = events.filter((e) => e.id !== id);
      return json({ success: true });
    }
    if (id) return json({ success: true, data: events.find((e) => e.id === id) });
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
  });
  return calls;
}

const openMenu = async (label: string) => {
  const trigger = await screen.findByRole('button', { name: label }, SLOW);
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
  return screen.findByRole('menu', {}, SLOW);
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Community space: events', () => {
  it('lists the upcoming events first, and the past ones on demand', async () => {
    const calls = stubEventsApi();
    renderAppAt('/c/dakar-devops/events');
    expect(await screen.findByRole('link', { name: 'Atelier Kubernetes' }, SLOW)).toBeTruthy();
    expect(screen.queryByText('Meetup DevOps')).toBeNull();
    expect(calls.find((c) => c.url.pathname.endsWith('/events/'))?.url.searchParams.get('upcoming')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Passés' }));
    expect(await screen.findByRole('link', { name: 'Meetup DevOps' }, SLOW)).toBeTruthy();
  });

  it('creates an online event: the link is required for an external format', async () => {
    const calls = stubEventsApi();
    renderAppAt('/c/dakar-devops/events');
    fireEvent.click(await screen.findByRole('button', { name: /Nouvel événement/ }, SLOW));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText(/^Titre/), { target: { value: 'Live CI/CD' } });
    fireEvent.change(within(dialog).getByLabelText('Format'), { target: { value: 'external' } });
    fireEvent.click(within(dialog).getByRole('button', { name: "Créer l'événement" }));
    expect(await within(dialog).findByText('Indiquez le lien de connexion', {}, SLOW)).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText(/Lien de connexion/), { target: { value: 'https://meet.google.com/abc' } });
    fireEvent.click(within(dialog).getByRole('button', { name: "Créer l'événement" }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true), SLOW);
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.body).toMatchObject({ title: 'Live CI/CD', format: 'external', location_url: 'https://meet.google.com/abc', venue_name: '' });
    expect(new Date(String(post?.body?.end_time)) > new Date(String(post?.body?.start_time))).toBe(true);
  });

  it('starts the live of a scheduled event', async () => {
    const calls = stubEventsApi();
    renderAppAt('/c/dakar-devops/events');
    const menu = await openMenu('Actions pour Atelier Kubernetes');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Démarrer le direct' }));
    await waitFor(() => expect(calls.some((c) => c.url.pathname.endsWith('/e1/status/'))).toBe(true), SLOW);
    expect(calls.find((c) => c.url.pathname.endsWith('/e1/status/'))?.body).toEqual({ status: 'live' });
  });

  it('lets a moderator see the events, not manage them', async () => {
    stubEventsApi();
    renderAppAt('/c/python-africa-core/events');
    await screen.findByRole('heading', { name: 'Événements' }, SLOW);
    expect(screen.queryByRole('button', { name: /Nouvel événement/ })).toBeNull();
  });

  it('shows the detail of an event with its attendees and the calendar link', async () => {
    stubEventsApi();
    renderAppAt('/c/dakar-devops/events/e1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Atelier Kubernetes' }, SLOW)).toBeTruthy();
    expect(await screen.findByText('Awa Ndiaye', {}, SLOW)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Ajouter à l'agenda/ }).getAttribute('href')).toMatch(/\/communities\/dakar-devops\/events\/e1\/calendar\.ics$/);
  });

  it('searches the attendees and filters them by answer or presence', async () => {
    stubEventsApi();
    renderAppAt('/c/dakar-devops/events/e1');
    expect(await screen.findByText('Kofi Mensah', {}, SLOW)).toBeTruthy();
    // Without accents nor case
    fireEvent.change(screen.getByLabelText('Rechercher un participant'), { target: { value: 'seynabou' } });
    await waitFor(() => expect(screen.queryByText('Awa Ndiaye')).toBeNull(), SLOW);
    expect(screen.getByText('Seynabou Fall')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Rechercher un participant'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Intéressés (1)' }));
    await waitFor(() => expect(screen.queryByText('Awa Ndiaye')).toBeNull(), SLOW);
    expect(screen.getByText('Kofi Mensah')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Présents (1)' }));
    expect(await screen.findByText('Awa Ndiaye', {}, SLOW)).toBeTruthy();
    expect(screen.queryByText('Kofi Mensah')).toBeNull();

    fireEvent.change(screen.getByLabelText('Rechercher un participant'), { target: { value: 'personne' } });
    expect(await screen.findByText('Aucun participant ne correspond à cette recherche.', {}, SLOW)).toBeTruthy();
  });

  it('confirms the presence of a participant once the event has started', async () => {
    const calls = stubEventsApi();
    // Not started yet: nothing to confirm
    renderAppAt('/c/dakar-devops/events/e1');
    expect(await screen.findByText('Seynabou Fall', {}, SLOW)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Marquer .* présent$/ })).toBeNull();
    cleanup();

    renderAppAt('/c/dakar-devops/events/e2');
    fireEvent.click(await screen.findByRole('button', { name: 'Marquer Seynabou Fall présent' }, SLOW));
    await waitFor(() => expect(calls.find((c) => c.url.pathname.endsWith('/events/e2/check-in/'))?.body).toEqual({ user_id: 'u4' }), SLOW);
    // Read again: present, no more button
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Marquer Seynabou Fall présent' })).toBeNull(), SLOW);
  });
});
