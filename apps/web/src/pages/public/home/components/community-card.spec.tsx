import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { CommunityListItem } from '@/utils/api/community/community.type';
import { CommunityCard } from './community-card';

const mockCommunity: CommunityListItem = {
  id: 'c1',
  name: 'Kodinga Devs',
  slug: 'kodinga-devs',
  tagline: 'Communauté des développeurs',
  avatar_url: '',
  banner_url: '',
  brand_color: null,
  category: { id: 'cat1', name: 'Tech', slug: 'tech', description: '', icon_url: '', order: 1, created_at: '' },
  owner: { id: 'u1', username: 'alex', full_name: 'Alex' } as any,
  privacy_type: 'public',
  pricing_type: 'free',
  is_verified: true,
  is_featured: false,
  members_count: 120,
  posts_count: 50,
  courses_count: 5,
  events_count: 10,
  created_at: '',
  is_member: true,
};

describe('CommunityCard component', () => {
  it('renders standard community card without active live', () => {
    render(
      <MemoryRouter>
        <CommunityCard community={mockCommunity} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Kodinga Devs')).toBeTruthy();
    expect(screen.getByText('Ouvrir')).toBeTruthy();
    expect(screen.queryByText(/Rejoindre le direct/)).toBeNull();
  });

  it('renders live beacon badge and direct join button when active live is present', () => {
    const liveCommunity: CommunityListItem = {
      ...mockCommunity,
      active_live: {
        id: 'ev-live-1',
        title: 'Masterclass TypeScript',
        slug: 'masterclass-ts',
        is_public: true,
        attendees_count: 15,
      },
    };

    render(
      <MemoryRouter>
        <CommunityCard community={liveCommunity} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Live/)).toBeTruthy();
    const joinBtn = screen.getByRole('link', { name: /Rejoindre le direct/ });
    expect(joinBtn).toBeTruthy();
    expect(joinBtn.getAttribute('href')).toBe('/communities/kodinga-devs/events/ev-live-1/live');
  });

  it('renders private badge indicator when active live is private', () => {
    const privateLiveCommunity: CommunityListItem = {
      ...mockCommunity,
      active_live: {
        id: 'ev-private-1',
        title: 'Session privée',
        slug: 'session-privee',
        is_public: false,
        attendees_count: 4,
      },
    };

    render(
      <MemoryRouter>
        <CommunityCard community={privateLiveCommunity} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Live 🔒/)).toBeTruthy();
    const joinBtn = screen.getByRole('link', { name: /Rejoindre le direct/ });
    expect(joinBtn.getAttribute('href')).toBe('/communities/kodinga-devs/events/ev-private-1/live');
  });
});
