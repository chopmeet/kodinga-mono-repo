import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import i18n from '@/utils/i18n';

vi.setConfig({ testTimeout: 15_000 });

const offer = (id: string, title: string, opportunity_type: string, workplace_type: string) => ({
  id,
  title,
  slug: title.toLowerCase().replace(/\s+/g, '-'),
  company_name: 'Wave',
  company_logo_url: '',
  company_website: '',
  opportunity_type,
  workplace_type,
  location: 'Dakar',
  salary_min: null,
  salary_max: null,
  currency: 'XOF',
  experience_level: 'all',
  status: 'open',
  views_count: 0,
  applications_count: 0,
  expires_at: null,
  has_applied: false,
  poster: { id: 'u1', username: 'awa', first_name: 'Awa', last_name: 'Ndiaye', avatar_url: '' },
  technologies: [],
  created_at: '2026-10-20T10:00:00Z',
});

const offers = [
  offer('o1', 'Développeur React', 'full_time', 'remote'),
  offer('o2', 'Stage data', 'internship', 'onsite'),
  offer('o3', 'Audit Solidity', 'bounty', 'remote'),
];

function stub() {
  const urls: URL[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL((input as Request).url);
    urls.push(url);
    const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    if (url.pathname.endsWith('/opportunities/')) {
      const q = (url.searchParams.get('search') ?? '').toLowerCase();
      // Like the api: type and workplace are ignored
      return json({ success: true, data: offers.filter((o) => o.title.toLowerCase().includes(q)) });
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

describe('Public opportunities page', () => {
  it('lists the open offers of the platform, linked to their page', async () => {
    const urls = stub();
    renderAppAt('/opportunities');
    expect(await screen.findByRole('heading', { level: 1, name: 'Offres & missions' }, SLOW)).toBeTruthy();
    const list = await screen.findByRole('list', { name: 'Opportunités' }, SLOW);
    expect(within(list).getByRole('link', { name: 'Développeur React' }).getAttribute('href')).toBe('/opportunities/développeur-react');
    expect(screen.getByText('3 offres')).toBeTruthy();
    // The global list: no community filter
    expect(urls.find((u) => u.pathname.endsWith('/opportunities/'))?.searchParams.has('community')).toBe(false);
  });

  it('filters by type and workplace on the page, and searches through the api', async () => {
    const urls = stub();
    renderAppAt('/opportunities');
    await screen.findByText('Développeur React', {}, SLOW);

    fireEvent.click(screen.getByRole('button', { name: 'Télétravail' }));
    expect(screen.queryByText('Stage data')).toBeNull();
    expect(screen.getByText('2 offres')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Bounties' }));
    expect(screen.queryByText('Développeur React')).toBeNull();
    expect(screen.getByText('Audit Solidity')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Toutes' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher une offre' }), { target: { value: 'react' } });
    await waitFor(() => expect(screen.queryByText('Audit Solidity')).toBeNull(), SLOW);
    expect(urls.some((u) => u.searchParams.get('search') === 'react')).toBe(true);
  });

  it('speaks English: titles, filters, counts and the labels of the offers', async () => {
    await act(() => i18n.changeLanguage('en'));
    stub();
    renderAppAt('/opportunities');
    expect(await screen.findByRole('heading', { level: 1, name: 'Jobs & gigs' }, SLOW)).toBeTruthy();
    const list = await screen.findByRole('list', { name: 'Opportunities' }, SLOW);
    expect(screen.getByText('3 offers')).toBeTruthy();
    expect(within(list).getByText('Internship')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remote' }));
    expect(screen.getByText('2 offers')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Bounties' }));
    expect(screen.getByText('1 offer')).toBeTruthy();
    await act(() => i18n.changeLanguage('fr'));
  });
});
