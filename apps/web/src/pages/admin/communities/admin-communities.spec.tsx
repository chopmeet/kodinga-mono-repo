import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';

import { Toaster } from '@kodinga-mono-repo/ui';
import { adminCategories, adminCommunities } from '@/data/admin-communities.data';
import store from '@/redux/store';
import { stubDirectory } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import AdminCommunities from './admin-communities';

// Network stubs + Radix menus: slow when the whole suite runs in parallel
vi.setConfig({ testTimeout: 15_000 });
const SLOW = { timeout: 3000 };

const renderPage = () =>
  render(
    <Provider store={store}>
      <MemoryRouter>
        <AdminCommunities />
        <Toaster />
      </MemoryRouter>
    </Provider>
  );

const rowNames = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('tbody tr')).map((tr) => tr.querySelector('p')?.textContent?.trim());

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('AdminCommunities', () => {
  it('lists the first page of the api and the total', async () => {
    const urls = stubDirectory(adminCommunities, adminCategories);
    const { findByText, getByText, container } = renderPage();
    expect(await findByText(adminCommunities[0].name, {}, SLOW)).toBeTruthy();
    expect(getByText(`${adminCommunities.length} communautés dans l'annuaire`)).toBeTruthy();
    expect(rowNames(container)).toHaveLength(10);
    const list = urls.find((u) => u.pathname.endsWith('/communities/'));
    expect(list?.searchParams.get('page_size')).toBe('10');
  });

  it('sends the search and the filters to the api, after the debounce', async () => {
    const urls = stubDirectory(adminCommunities, adminCategories);
    const { findByText, getByRole, container } = renderPage();
    await findByText(adminCommunities[0].name, {}, SLOW);
    fireEvent.change(getByRole('searchbox', { name: /rechercher une communauté/i }), { target: { value: 'LAGOS' } });
    await waitFor(() => expect(rowNames(container)).toEqual(['Lagos AI & Data Engineers']), SLOW);
    expect(urls.at(-1)?.searchParams.get('q')).toBe('LAGOS');
  });

  it('shows an empty message when nothing matches', async () => {
    stubDirectory(adminCommunities, adminCategories);
    const { findByText, getByRole } = renderPage();
    await findByText(adminCommunities[0].name, {}, SLOW);
    fireEvent.change(getByRole('searchbox', { name: /rechercher une communauté/i }), { target: { value: 'zzz-introuvable' } });
    expect(await findByText('Aucune communauté ne correspond à ces filtres.', {}, SLOW)).toBeTruthy();
  });

  it('archives a community through the api, then refreshes the list', async () => {
    const target = adminCommunities[0];
    const urls = stubDirectory(adminCommunities, adminCategories);
    const { findByText, findByRole, getByRole, queryByText } = renderPage();
    await findByText(target.name, {}, SLOW);

    const trigger = getByRole('button', { name: `Actions pour ${target.name}` });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(await findByRole('menuitem', { name: /archiver/i }, SLOW));
    const dialog = await findByRole('dialog', {}, SLOW);
    fireEvent.click(within(dialog).getByRole('button', { name: /archiver/i }));

    expect(await findByText(`« ${target.name} » a été archivée.`, {}, SLOW)).toBeTruthy();
    await waitFor(() => expect(queryByText(target.name)).toBeNull(), SLOW);
    expect(await findByText(`${adminCommunities.length - 1} communautés dans l'annuaire`, {}, SLOW)).toBeTruthy();
    expect(urls.some((u) => u.pathname.endsWith(`/communities/${target.slug}/`))).toBe(true);
  });

  it('offers to retry when the api cannot be reached', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ success: false, code: 'error', message: 'Service indisponible.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
    );
    const { findByText, getByRole } = renderPage();
    expect(await findByText('Service indisponible.', {}, SLOW)).toBeTruthy();
    expect(getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });
});
