import { fireEvent, screen, within } from '@testing-library/react';

import { getCommunityPosts } from '@/data/admin-community-details.data';
import { getMyCommunity } from '@/data/community-space.data';
import { renderAppAt, SLOW } from '@/test-utils';

const postsOf = (slug: string) => getCommunityPosts(getMyCommunity(slug)!.community);

// Full app tree + Radix dialogs/menus: slow when the whole suite runs in parallel
vi.setConfig({ testTimeout: 15_000 });

describe('Community space: posts', () => {
  it('shows only the locked posts from the dashboard link', async () => {
    const locked = postsOf('frontend-francophone').filter((p) => p.is_locked);
    renderAppAt('/c/frontend-francophone/posts?filter=locked');
    const table = await screen.findByRole('table', {}, SLOW);
    expect(within(table).getAllByRole('row')).toHaveLength(locked.length + 1);
    expect(within(table).getByText(locked[0].title)).toBeTruthy();
  });

  it('filters on the post type', async () => {
    const questions = postsOf('frontend-francophone').filter((p) => p.type === 'question');
    renderAppAt('/c/frontend-francophone/posts');
    fireEvent.change(await screen.findByLabelText('Filtrer par type', {}, SLOW), { target: { value: 'question' } });
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(questions.length + 1);
  });

  it('deletes a post after confirmation (moderator)', async () => {
    const [post] = postsOf('python-africa-core');
    renderAppAt('/c/python-africa-core/posts');
    const trigger = await screen.findByRole('button', { name: `Actions pour ${post.title}` }, SLOW);
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(within(await screen.findByRole('menu', {}, SLOW)).getByRole('menuitem', { name: 'Supprimer' }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }));
    expect(await screen.findByText('Publication supprimée.', {}, SLOW)).toBeTruthy();
    expect(within(screen.getByRole('table')).queryByText(post.title)).toBeNull();
  });
});
