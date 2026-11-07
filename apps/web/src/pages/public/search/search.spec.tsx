import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';

vi.setConfig({ testTimeout: 15_000 });

const community = { id: 'c1', name: 'Abidjan React', slug: 'abidjan-react', description: '', avatar_url: '', banner_url: '', members_count: 1240, pricing_type: 'free' };
const course = { id: 'k1', title: 'React 19 de A à Z', slug: 'react-19', description: '', thumbnail_url: '', level: 'beginner', lessons_count: 12, duration_seconds: 0, students_count: 30, community_slug: 'abidjan-react', community_name: 'Abidjan React' };
const event = { id: 'e1', title: 'Atelier React', slug: 'atelier', description: '', cover_image_url: '', event_type: 'workshop', format: 'online', status: 'live', start_time: '2026-11-20T18:00:00Z', end_time: '2026-11-20T20:00:00Z', timezone: 'Africa/Abidjan', attendees_count: 12, community_slug: 'abidjan-react', community_name: 'Abidjan React' };
const developer = { id: 'd1', username: 'awa', full_name: 'Awa Diop', avatar_url: '', headline: 'Développeuse React', bio: '' };
const post = { id: 'p1', title: '', content: 'Contenu réservé', post_type: 'discussion', author_username: 'kofi', community_slug: 'abidjan-react', reactions_count: 0, comments_count: 3, created_at: '2026-11-01T10:00:00Z' };

function stubDiscovery() {
  const urls: URL[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL((input as Request).url);
    urls.push(url);
    const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
    if (url.pathname.endsWith('/discovery/trending/')) return json({ success: true, data: { communities: [community], courses: [], events: [] } });
    if (url.pathname.endsWith('/discovery/search/')) {
      const q = url.searchParams.get('q');
      if (q === 'zzz') return json({ success: true, data: { communities: [], courses: [], events: [], developers: [], posts: [] } });
      const many = (x: object, n: number) => Array.from({ length: n }, (_, i) => ({ ...x, id: `${(x as { id: string }).id}-${i}` }));
      return json({ success: true, data: { communities: many(community, 5), courses: [course], events: [event], developers: [developer], posts: [post] } });
    }
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
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

describe('Global search', () => {
  it('opens from the header, and shows the trends with no words', async () => {
    stubDiscovery();
    const { where } = renderAppAt('/notifications');
    fireEvent.click(await screen.findByRole('link', { name: 'Rechercher sur Kodinga' }, SLOW));
    await waitFor(() => expect(where()).toBe('/search'), SLOW);
    const popular = await screen.findByRole('region', { name: 'Communautés populaires' }, SLOW);
    expect(within(popular).getByRole('link', { name: /Abidjan React/ }).getAttribute('href')).toBe('/communities/abidjan-react');
  });

  it('searches every kind of content, each linking to its page', async () => {
    const urls = stubDiscovery();
    renderAppAt('/search?q=react');
    const courses = await screen.findByRole('region', { name: 'Formations' }, SLOW);
    expect(within(courses).getByRole('link', { name: /React 19 de A à Z/ }).getAttribute('href')).toBe('/communities/abidjan-react/courses/react-19');
    expect(within(screen.getByRole('region', { name: 'Événements' })).getByText(/En direct/)).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Développeurs' })).getByRole('link', { name: /Awa Diop/ }).getAttribute('href')).toBe('/profiles/awa');
    // A post: its title (or its author), never its content
    const posts = screen.getByRole('region', { name: 'Discussions' });
    expect(within(posts).getByRole('link', { name: /Discussion de @kofi/ }).getAttribute('href')).toBe('/communities/abidjan-react/posts/p1');
    expect(screen.queryByText('Contenu réservé')).toBeNull();
    expect(urls.find((u) => u.pathname.endsWith('/discovery/search/'))?.searchParams.get('limit')).toBe('5');

    // "Voir plus": the communities alone, more of them
    fireEvent.click(within(screen.getByRole('region', { name: 'Communautés' })).getByRole('button', { name: 'Voir plus' }));
    await waitFor(() => expect(urls.some((u) => u.searchParams.get('type') === 'community' && u.searchParams.get('limit') === '30')).toBe(true), SLOW);
    expect(screen.getByRole('button', { name: 'Communautés' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('puts the words typed in the url, and says when nothing matches', async () => {
    stubDiscovery();
    const { where } = renderAppAt('/search');
    fireEvent.change(await screen.findByPlaceholderText('Une communauté, une formation, un développeur…', {}, SLOW), { target: { value: 'zzz' } });
    await waitFor(() => expect(where()).toBe('/search?q=zzz'), SLOW);
    expect(await screen.findByText('Aucun résultat pour « zzz ».', {}, SLOW)).toBeTruthy();
  });
});
