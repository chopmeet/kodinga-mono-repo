import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { adminCategories, adminCommunities } from '@/data/admin-communities.data';
import { onSetSearchQuery } from '@/redux/slice/Search.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW, stubDirectory } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';

// Full app tree + network stubs: slow when the whole suite runs in parallel
vi.setConfig({ testTimeout: 15_000 });

const cards = () => screen.getAllByRole('article');

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(onSetSearchQuery(''));
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Home directory', () => {
  it('shows the first 9 communities of the api and loads the next page on demand', async () => {
    const urls = stubDirectory(adminCommunities, adminCategories);
    renderAppAt('/');
    expect(await screen.findByText(`${adminCommunities.length} RÉSULTATS`, {}, SLOW)).toBeTruthy();
    expect(cards()).toHaveLength(9);

    fireEvent.click(screen.getByRole('button', { name: /Afficher plus de communautés/ }));
    await waitFor(() => expect(cards()).toHaveLength(18), SLOW);
    expect(urls.some((u) => u.searchParams.get('page') === '2')).toBe(true);
  });

  it('filters on one line: category pills, the others in "Plus…", access in "Filtre"', async () => {
    const urls = stubDirectory(adminCommunities, adminCategories);
    renderAppAt('/');
    const strip = await screen.findByRole('group', { name: 'Filtrer les communautés' }, SLOW);

    // Visible pill
    fireEvent.click(await within(strip).findByRole('button', { name: 'Cloud & DevOps' }, SLOW));
    const cloud = adminCommunities.filter((c) => c.category?.slug === 'cloud-devops');
    await waitFor(() => expect(cards()).toHaveLength(cloud.length), SLOW);
    expect(urls.at(-1)?.searchParams.get('category')).toBe('cloud-devops');

    // A category beyond the visible pills, from "Plus…"
    const more = within(strip).getByRole('button', { name: /Plus…/ });
    more.focus();
    fireEvent.keyDown(more, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Carrière' }, SLOW));
    await waitFor(() => expect(urls.at(-1)?.searchParams.get('category')).toBe('carriere'), SLOW);
    expect(within(strip).getByRole('button', { name: /Carrière/ })).toBeTruthy();

    // Access adds up with the category
    const filter = screen.getByRole('button', { name: 'Filtre' });
    filter.focus();
    fireEvent.keyDown(filter, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Gratuites' }, SLOW));
    await waitFor(() => expect(urls.at(-1)?.searchParams.get('pricing')).toBe('free'), SLOW);
    expect(urls.at(-1)?.searchParams.get('category')).toBe('carriere');
  });

  it('searches by keyword from a hero stack', async () => {
    const urls = stubDirectory(adminCommunities, adminCategories);
    renderAppAt('/');
    await screen.findByText(`${adminCommunities.length} RÉSULTATS`, {}, SLOW);
    fireEvent.click(screen.getByRole('button', { name: /Rust/ }));
    expect((screen.getByRole('searchbox', { name: /rechercher une communauté/i }) as HTMLInputElement).value).toBe('rust');
    await waitFor(() => expect(urls.at(-1)?.searchParams.get('q')).toBe('rust'), SLOW);
  });

  it('offers to retry when the api cannot be reached', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ success: false, code: 'error', message: 'Service indisponible.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
    );
    renderAppAt('/');
    expect(await screen.findByText('Service indisponible.', {}, SLOW)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('ranks the communities that gather the most members in "Le pouls des communautés"', async () => {
    const urls = stubDirectory(adminCommunities, adminCategories);
    renderAppAt('/');
    const ranking = await screen.findByRole('list', { name: 'Communautés les plus suivies' }, SLOW);
    expect(urls.some((u) => u.searchParams.get('page_size') === '30')).toBe(true);

    // Top 4 of the communities read, by members (publications break a tie), each linked to its page
    const expected = [...adminCommunities.slice(0, 30)]
      .sort((a, b) => b.members_count - a.members_count || b.posts_count - a.posts_count)
      .slice(0, 4);
    const links = within(ranking).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(expected.map((c) => `/communities/${c.slug}`));
    expect(within(links[0]).getByText(expected[0].name)).toBeTruthy();
  });
});
