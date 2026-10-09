import { fireEvent, render, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';

import { getCommunityMembers } from '@/data/admin-community-details.data';
import { adminCommunities } from '@/data/admin-communities.data';
import store from '@/redux/store';
import { must } from '@/test-utils';
import CommunityDetails from './community-details';
import CommunityMembersTab from './tabs/members';
import CommunityPaymentsTab from './tabs/payments';
import CommunityPostsTab from './tabs/posts';
import CommunitySettingsTab from './tabs/settings';

const renderAt = (path: string) =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/communities/:slug" element={<CommunityDetails />}>
            <Route index element={<Navigate to="members" replace />} />
            <Route path="members" element={<CommunityMembersTab />} />
            <Route path="posts" element={<CommunityPostsTab />} />
            <Route path="payments" element={<CommunityPaymentsTab />} />
            <Route path="settings" element={<CommunitySettingsTab />} />
          </Route>
          <Route path="/admin/communities" element={<p>Liste</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );

const paid = must(adminCommunities.find((c) => c.pricing_type === 'paid'));
const free = must(adminCommunities.find((c) => c.pricing_type === 'free'));

describe('Admin community details (mock data)', () => {
  it('shows the header, the stats and the members tab by default', async () => {
    const { findByRole, getByText, getAllByRole } = renderAt(`/admin/communities/${free.slug}`);
    expect(await findByRole('heading', { level: 1, name: new RegExp(free.name.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&')) })).toBeTruthy();
    expect(getByText('Membres', { selector: 'p' })).toBeTruthy();
    // owner row first, with no moderation menu
    expect(getAllByRole('row')[1].textContent).toContain('Propriétaire');
  });

  it('suspends a member from the actions menu', async () => {
    const target = must(getCommunityMembers(free).find((m) => m.role === 'member' && m.status === 'active'));
    const { findByRole, findByText } = renderAt(`/admin/communities/${free.slug}/members`);
    const button = await findByRole('button', { name: `Actions pour ${target.name}` });
    fireEvent.pointerDown(button, { button: 0, ctrlKey: false });
    fireEvent.click(await findByRole('menuitem', { name: 'Suspendre' }));
    const row = (await findByText(target.name)).closest('tr') as HTMLElement;
    expect(within(row).getByText('Suspendu')).toBeTruthy();
  });

  it('lists payments of a paid community, and explains why a free one has none', async () => {
    const { findByText, unmount } = renderAt(`/admin/communities/${paid.slug}/payments`);
    expect(await findByText('Encaissé (45 j)')).toBeTruthy();
    unmount();
    const freeView = renderAt(`/admin/communities/${free.slug}/payments`);
    expect(await freeView.findByText('Communauté gratuite : aucun paiement à afficher.')).toBeTruthy();
  });

  it('switches tab through the tab links', async () => {
    const { findByRole, findByText } = renderAt(`/admin/communities/${free.slug}/members`);
    fireEvent.click(await findByRole('button', { name: 'Règles & paramètres' }));
    expect(await findByText('Règles de la communauté')).toBeTruthy();
  });

  it('handles an unknown community', async () => {
    const { findByText } = renderAt('/admin/communities/nope');
    expect(await findByText('Cette communauté est introuvable ou a été archivée.')).toBeTruthy();
  });
});
