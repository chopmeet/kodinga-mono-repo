import { fireEvent, render, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';

import { adminCommunities } from '@/data/admin-communities.data';
import store from '@/redux/store';
import AdminCommunities from './admin-communities';

const renderPage = () =>
  render(
    <Provider store={store}>
      <MemoryRouter>
        <AdminCommunities />
      </MemoryRouter>
    </Provider>
  );

const rowNames = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('tbody tr')).map((tr) => tr.querySelector('p')?.textContent?.trim());

describe('AdminCommunities (mock data)', () => {
  it('lists the first page and the total, featured communities first', async () => {
    const { findByText, getByText, container } = renderPage();
    const first = adminCommunities[0];
    expect(await findByText(first.name)).toBeTruthy();
    expect(getByText(`${adminCommunities.length} communautés dans l'annuaire`)).toBeTruthy();
    expect(rowNames(container)).toHaveLength(10);
    expect(first.is_featured).toBe(true);
  });

  it('searches without accents or case, after the debounce', async () => {
    const { findByText, getByRole, container } = renderPage();
    await findByText(adminCommunities[0].name);
    fireEvent.change(getByRole('searchbox', { name: /rechercher une communauté/i }), { target: { value: 'LAGOS' } });
    await waitFor(() => expect(rowNames(container)).toEqual(['Lagos AI & Data Engineers']), { timeout: 2000 });
  });

  it('shows an empty message when nothing matches', async () => {
    const { findByText, getByRole } = renderPage();
    await findByText(adminCommunities[0].name);
    fireEvent.change(getByRole('searchbox', { name: /rechercher une communauté/i }), { target: { value: 'zzz-introuvable' } });
    expect(await findByText('Aucune communauté ne correspond à ces filtres.', {}, { timeout: 2000 })).toBeTruthy();
  });

  it('removes a community from the list once archived', async () => {
    const target = adminCommunities[0];
    const { findByText, findByRole, getByRole, getByText, queryByText } = renderPage();
    await findByText(target.name);

    fireEvent.pointerDown(getByRole('button', { name: `Actions pour ${target.name}` }), { button: 0, ctrlKey: false });
    fireEvent.click(await findByRole('menuitem', { name: /archiver/i }));
    const dialog = await findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /archiver/i }));

    await waitFor(() => expect(queryByText(target.name)).toBeNull(), { timeout: 2000 });
    expect(getByText(`${adminCommunities.length - 1} communautés dans l'annuaire`)).toBeTruthy();
  });
});
