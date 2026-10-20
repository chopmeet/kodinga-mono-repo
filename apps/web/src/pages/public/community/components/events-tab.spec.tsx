import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { User } from '@/utils/api/user/user.type';
import { eventIcs } from '../form/UseEventRsvp';

vi.setConfig({ testTimeout: 15_000 });

const URL_PATH = '/communities/abidjan-react?tab=events';
const at = (days: number, hours = 0) => new Date(Date.now() + days * 86_400_000 + hours * 3_600_000).toISOString();

type Call = { method: string; url: URL; body: Record<string, unknown> | null };

const baseEvent = {
  community: { id: 'c1', name: 'Abidjan React', slug: 'abidjan-react', avatar_url: '' },
  host: null,
  description: 'On code ensemble.',
  cover_image_url: '',
  event_type: 'workshop',
  status: 'scheduled',
  timezone: 'UTC',
  venue_name: '',
  location_address: '',
  location_city: '',
  location_country: '',
  attendees_count: 3,
  max_attendees: 30,
  is_full: false,
  is_upcoming: true,
  is_in_progress: false,
  is_recorded: false,
  duration_minutes: 120,
  replay_video_asset: null,
  created_at: at(-3),
};

/** Two upcoming events: an online workshop for members, a public meetup already full */
function stubEventsApi({ member = true, rsvpAnswer = 'ok' as 'ok' | 'slow' | 'refused' } = {}) {
  const calls: Call[] = [];
  const rsvp: Record<string, string | null> = { e1: null, e2: null };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ method: request.method, url, body });
    const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const path = url.pathname;
    const events = () => [
      { ...baseEvent, id: 'e1', slug: 'atelier-react', title: 'Atelier React 19', format: 'external', is_public: false, start_time: at(2), end_time: at(2, 2), user_rsvp_status: rsvp.e1 },
      { ...baseEvent, id: 'e2', slug: 'meetup', title: 'Meetup Plateau', format: 'in_person', is_public: true, is_full: true, start_time: at(5), end_time: at(5, 3), user_rsvp_status: rsvp.e2 },
    ];

    if (path.endsWith('/communities/abidjan-react/')) {
      return json({
        success: true,
        data: {
          id: 'c1', name: 'Abidjan React', slug: 'abidjan-react', privacy_type: 'public', pricing_type: 'free', members_count: 40, owner: { id: 'o', username: 'o' },
          user_membership: member ? { is_member: true, role: 'member', status: 'active' } : { is_member: false, role: null, status: null },
        },
      });
    }
    const id = path.match(/events\/([^/]+)\/rsvp\/$/)?.[1];
    if (id) {
      if (rsvpAnswer === 'refused') return new Response(JSON.stringify({ success: false, code: 'validation_error', message: 'Cet événement est complet.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      if (rsvpAnswer === 'slow') await new Promise((r) => setTimeout(r, 1500));
      rsvp[id] = request.method === 'DELETE' ? null : (body?.status as string);
      return json({ success: true, data: {} });
    }
    const detail = path.match(/events\/([^/]+)\/$/)?.[1];
    if (detail && detail !== 'events') return json({ success: true, data: { ...events().find((e) => e.id === detail), location_url: 'https://meet.example.com/atelier' } });
    if (path.endsWith('/communities/abidjan-react/events/')) return json({ success: true, pagination: { count: 2 }, results: events() });
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
  });
  return calls;
}

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '');
const signIn = () =>
  act(() => {
    store.dispatch(onSetUserToken({ user: { id: 'u1', username: 'fatou' } as User, token: `${b64({ alg: 'HS256' })}.${b64({ exp: 4102444800 })}.sig`, refresh: 'r' }));
  });
const card = async (title: string) => (await screen.findByRole('heading', { name: title }, SLOW)).closest('li') as HTMLElement;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(onLogout());
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Community events: registration', () => {
  it('registers a member, gives the link of the session, then cancels', async () => {
    signIn();
    const calls = stubEventsApi();
    renderAppAt(URL_PATH);
    const workshop = await card('Atelier React 19');
    fireEvent.click(within(workshop).getByRole('button', { name: 'Je participe' }));
    await waitFor(() => expect(calls.find((c) => c.url.pathname.endsWith('/events/e1/rsvp/'))?.body).toEqual({ status: 'attending' }), SLOW);
    expect(await within(workshop).findByText('Inscrit', {}, SLOW)).toBeTruthy();
    expect((await within(workshop).findByRole('link', { name: /Lien de connexion/ }, SLOW)).getAttribute('href')).toBe('https://meet.example.com/atelier');
    expect(within(workshop).getByRole('button', { name: /Ajouter à mon agenda/ })).toBeTruthy();

    fireEvent.click(within(workshop).getByRole('button', { name: 'Annuler mon inscription' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.url.pathname.endsWith('/events/e1/rsvp/'))).toBe(true), SLOW);
    expect(await within(workshop).findByRole('button', { name: 'Je participe' }, SLOW)).toBeTruthy();
  });

  it('counts the registration at once, before the api answers', async () => {
    signIn();
    stubEventsApi({ rsvpAnswer: 'slow' });
    renderAppAt(URL_PATH);
    const workshop = await card('Atelier React 19');
    expect(workshop.textContent).toMatch(/3 participants/);
    fireEvent.click(within(workshop).getByRole('button', { name: 'Je participe' }));
    expect(workshop.textContent).toMatch(/4 participants/);
    expect(within(workshop).getByText('Inscrit')).toBeTruthy();
  });

  it('puts everything back when the api refuses', async () => {
    signIn();
    stubEventsApi({ rsvpAnswer: 'refused' });
    renderAppAt(URL_PATH);
    const workshop = await card('Atelier React 19');
    fireEvent.click(within(workshop).getByRole('button', { name: 'Je participe' }));
    expect(await screen.findByText('Cet événement est complet.', {}, SLOW)).toBeTruthy();
    expect(within(workshop).getByRole('button', { name: 'Je participe' })).toBeTruthy();
    expect(workshop.textContent).toMatch(/3 participants/);
  });

  it('lets one say "maybe" to a full event', async () => {
    signIn();
    const calls = stubEventsApi();
    renderAppAt(URL_PATH);
    const meetup = await card('Meetup Plateau');
    expect(within(meetup).getByText('Complet')).toBeTruthy();
    expect(within(meetup).queryByRole('button', { name: 'Je participe' })).toBeNull();
    fireEvent.click(within(meetup).getByRole('button', { name: /Intéressé/ }));
    await waitFor(() => expect(calls.find((c) => c.url.pathname.endsWith('/events/e2/rsvp/'))?.body).toEqual({ status: 'maybe' }), SLOW);
    expect(await within(meetup).findByRole('button', { name: 'Retirer' }, SLOW)).toBeTruthy();
  });

  it('keeps the members-only events for members, the public ones for everyone signed in', async () => {
    signIn();
    stubEventsApi({ member: false });
    renderAppAt(URL_PATH);
    expect(within(await card('Atelier React 19')).getByText('Réservé aux membres de la communauté.')).toBeTruthy();
    expect(within(await card('Meetup Plateau')).getByRole('button', { name: /Intéressé/ })).toBeTruthy();
  });

  it('asks a visitor to sign in', async () => {
    stubEventsApi({ member: false });
    renderAppAt(URL_PATH);
    expect(within(await card('Atelier React 19')).getByRole('link', { name: 'Se connecter pour s’inscrire' }).getAttribute('href')).toContain('/auth/login');
  });
});

describe('eventIcs', () => {
  it('writes a calendar file with escaped text', () => {
    const ics = eventIcs(
      { id: 'e1', slug: 'x', title: 'Atelier; React, 19', description: 'Ligne 1\nLigne 2', start_time: '2026-11-02T18:00:00Z', end_time: '2026-11-02T20:00:00Z', venue_name: 'Orange Fab', location_address: '', location_city: 'Abidjan', location_country: '' } as never,
      'https://kodinga.app/communities/a',
    );
    expect(ics).toContain('DTSTART:20261102T180000Z');
    expect(ics).toContain('DTEND:20261102T200000Z');
    expect(ics).toContain(String.raw`SUMMARY:Atelier\; React\, 19`);
    expect(ics).toContain(String.raw`DESCRIPTION:Ligne 1\nLigne 2\n\nhttps://kodinga.app/communities/a`);
    expect(ics).toContain(String.raw`LOCATION:Orange Fab\, Abidjan`);
  });
});
