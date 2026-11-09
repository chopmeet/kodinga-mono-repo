import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';

vi.setConfig({ testTimeout: 15_000 });

const hackathon = (id: string, title: string, community: string) => ({
  id,
  community: { id: `c-${community}`, name: community, slug: community.toLowerCase().replace(/\s+/g, '-') },
  organizer: null,
  title,
  slug: title.toLowerCase().replace(/\s+/g, '-'),
  tagline: '',
  cover_image_url: '',
  format: 'online',
  venue_city: '',
  venue_country: '',
  theme: '',
  main_language: 'fr',
  registration_start: '2026-11-01T00:00:00Z',
  registration_end: '2099-01-01T00:00:00Z',
  start_time: '2026-12-05T09:00:00Z',
  submission_deadline: '2026-12-07T18:00:00Z',
  judging_end: '2026-12-10T18:00:00Z',
  results_announced_at: null,
  timezone: 'Africa/Dakar',
  status: 'registration_open',
  is_registration_open: true,
  is_submission_open: false,
  results_published: false,
  prizes_count: 2,
  participants_count: 14,
  created_at: '2026-10-25T10:00:00Z',
});

const all = [hackathon('h1', 'Hack the Sahel', 'Dakar Data'), hackathon('h2', 'Fintech Sprint', 'Lagos Devs')];

function stub() {
  const urls: URL[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL((input as Request).url);
    urls.push(url);
    const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    if (url.pathname.endsWith('/hackathons/')) {
      const q = (url.searchParams.get('search') ?? '').toLowerCase();
      const results = all.filter((h) => h.title.toLowerCase().includes(q));
      return json({ success: true, pagination: { count: results.length, page_size: 10 }, results });
    }
    return json({ success: true, data: [], results: [], pagination: { count: 0 } });
  });
  return urls;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Public hackathons page', () => {
  it('lists the hackathons of every community, with the community that runs them', async () => {
    stub();
    renderAppAt('/hackathons');
    expect(await screen.findByRole('heading', { level: 1, name: 'Hackathons & défis' }, SLOW)).toBeTruthy();
    const list = await screen.findByRole('list', { name: 'Hackathons' }, SLOW);
    expect(within(list).getByRole('link', { name: 'Hack the Sahel' }).getAttribute('href')).toBe('/communities/dakar-data/hackathons/hack-the-sahel');
    expect(within(list).getByRole('link', { name: /Lagos Devs/ }).getAttribute('href')).toBe('/communities/lagos-devs');
    expect(screen.getByText('2 hackathons')).toBeTruthy();
  });

  it('sends the search and the filters to the api', async () => {
    const urls = stub();
    renderAppAt('/hackathons');
    await screen.findByText('Hack the Sahel', {}, SLOW);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher un hackathon' }), { target: { value: 'fintech' } });
    await waitFor(() => expect(screen.queryByText('Hack the Sahel')).toBeNull(), SLOW);
    expect(screen.getByText('Fintech Sprint')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'En cours' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hybride' }));
    await waitFor(() => {
      const last = urls.filter((u) => u.pathname.endsWith('/hackathons/')).at(-1);
      expect(last?.searchParams.get('status')).toBe('in_progress');
      expect(last?.searchParams.get('format')).toBe('hybrid');
      expect(last?.searchParams.get('search')).toBe('fintech');
    }, SLOW);
  });
});
