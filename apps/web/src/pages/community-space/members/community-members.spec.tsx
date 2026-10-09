import { fireEvent, screen, within } from '@testing-library/react';

import { getCommunityMembers } from '@/data/admin-community-details.data';
import { getMyCommunity } from '@/data/community-space.data';
import { must, renderAppAt, SLOW } from '@/test-utils';

const membersOf = (slug: string) => getCommunityMembers(must(getMyCommunity(slug)).community);

const openMenu = async (label: string) => {
  const trigger = await screen.findByRole('button', { name: label }, SLOW);
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
  return screen.findByRole('menu', {}, SLOW);
};

// Full app tree + Radix dialogs/menus: slow when the whole suite runs in parallel
vi.setConfig({ testTimeout: 15_000 });

describe('Community space: members', () => {
  it('opens on the join requests from the dashboard link', async () => {
    const pending = membersOf('python-africa-core').filter((m) => m.status === 'pending');
    expect(pending.length).toBeGreaterThan(0);
    renderAppAt('/c/python-africa-core/members?status=pending');
    const table = await screen.findByRole('table', {}, SLOW);
    expect(within(table).getAllByRole('row')).toHaveLength(pending.length + 1);
    expect(screen.getByRole('button', { name: /En attente/, pressed: true })).toBeTruthy();
  });

  it('approves a join request in one click', async () => {
    const [first] = membersOf('python-africa-core').filter((m) => m.status === 'pending');
    const { where } = renderAppAt('/c/python-africa-core/members?status=pending');
    fireEvent.click(await screen.findByRole('button', { name: `Approuver ${first.name}` }, SLOW));
    expect(await screen.findByText(`${first.name} a rejoint la communauté.`, {}, SLOW)).toBeTruthy();
    expect(screen.queryByRole('button', { name: `Approuver ${first.name}` })).toBeNull();
    expect(where()).toBe('/c/python-africa-core/members?status=pending');
  });

  it('gives a moderator no action on the owner and the admins', async () => {
    const members = membersOf('python-africa-core');
    renderAppAt('/c/python-africa-core/members');
    await screen.findByRole('table', {}, SLOW);
    for (const m of members.filter((x) => x.role === 'owner' || x.role === 'admin')) {
      expect(screen.queryByRole('button', { name: `Actions pour ${m.name}` })).toBeNull();
    }
    const moderator = must(members.find((x) => x.role === 'moderator'));
    const menu = await openMenu(`Actions pour ${moderator.name}`);
    expect(within(menu).queryByRole('menuitem', { name: /Nommer/ })).toBeNull();
    expect(within(menu).getByRole('menuitem', { name: 'Suspendre' })).toBeTruthy();
  });

  it('asks a reason before banning (owner)', async () => {
    const target = must(membersOf('dakar-devops').find((m) => m.role === 'admin'));
    renderAppAt('/c/dakar-devops/members');
    const menu = await openMenu(`Actions pour ${target.name}`);
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Bannir' }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bannir' }));
    expect(await within(dialog).findByText('Indiquez le motif (5 caractères minimum)', {}, SLOW)).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText(/Motif/), { target: { value: 'Spam répété dans le fil' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bannir' }));
    expect(await screen.findByText(`${target.name} a été banni.`, {}, SLOW)).toBeTruthy();
  });
});
