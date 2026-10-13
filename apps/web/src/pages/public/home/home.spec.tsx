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

  it('filters with the api categories and the quick filters', async () => {
    const urls = stubDirectory(adminCommunities, adminCategories);
    renderAppAt('/');
    const strip = await screen.findByRole('group', { name: 'Filtrer les communautés' }, SLOW);

    fireEvent.click(await within(strip).findByRole('button', { name: 'Cloud & DevOps' }, SLOW));
    const cloud = adminCommunities.filter((c) => c.category?.slug === 'cloud-devops');
    await waitFor(() => expect(cards()).toHaveLength(cloud.length), SLOW);
    expect(urls.at(-1)?.searchParams.get('category')).toBe('cloud-devops');

    fireEvent.click(within(strip).getByRole('button', { name: /Gratuites/ }));
    await waitFor(() => expect(urls.at(-1)?.searchParams.get('pricing')).toBe('free'), SLOW);
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
});
