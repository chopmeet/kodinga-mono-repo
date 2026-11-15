import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW, TEST_TOKEN } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { User } from '@/utils/api/user/user.type';

vi.setConfig({ testTimeout: 15_000 });

const person = { id: 'u1', username: 'recruiter', first_name: 'Fatou', last_name: 'Diop', avatar_url: '' };
const tech = { id: 't1', name: 'React', slug: 'react', icon_url: '' };

const mockOffer = {
  id: 'opp-1',
  title: 'Tech Développeur Fullstack',
  slug: 'tech-developpeur-fullstack',
  company_name: 'Dakar AI Labs',
  company_logo_url: '',
  company_website: 'https://dakar-ai.example.com',
  opportunity_type: 'full_time',
  workplace_type: 'hybrid',
  location: 'Dakar, Sénégal',
  salary_min: '800000',
  salary_max: '1200000',
  currency: 'XOF',
  experience_level: 'mid',
  status: 'open',
  views_count: 42,
  applications_count: 5,
  expires_at: null,
  has_applied: false,
  poster: person,
  description: 'Nous recrutons un développeur Fullstack pour nos solutions IA.',
  requirements: 'Maîtrise de Python, Django, React et TypeScript.',
  technologies: [tech],
  created_at: '2026-10-25T10:00:00Z',
};

function stubOpportunityApi(envelopedApplications = true) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL((input as Request).url);
    const path = url.pathname;
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

    if (path.endsWith('/opportunities/tech-developpeur-fullstack/')) {
      return json({ success: true, data: mockOffer });
    }

    if (path.endsWith('/opportunities/my-applications/')) {
      const apps = [
        {
          id: 'app-1',
          opportunity: mockOffer,
          applicant: person,
          resume_url: 'https://example.com/cv.pdf',
          cover_letter: 'Motivation letter',
          portfolio_url: 'https://github.com/my-profile',
          status: 'pending',
          created_at: '2026-10-26T12:00:00Z',
          updated_at: '2026-10-26T12:00:00Z',
        },
      ];
      return json(envelopedApplications ? { success: true, data: apps } : apps);
    }

    return json({ success: true, data: null });
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(onLogout());
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Opportunity detail page', () => {
  it('renders opportunity detail with enveloped applications when signed in', async () => {
    act(() => {
      store.dispatch(
        onSetUserToken({
          user: { id: 'u2', username: 'candidate_dev', first_name: 'Moussa', last_name: 'Diallo' } as User,
          token: TEST_TOKEN,
          refresh: 'ref-token',
        }),
      );
    });

    stubOpportunityApi(true);

    renderAppAt('/opportunities/tech-developpeur-fullstack?from=dakar-ai');

    // Heading of the offer
    expect(await screen.findByRole('heading', { level: 1, name: 'Tech Développeur Fullstack' }, SLOW)).toBeTruthy();
    // Company name
    expect(screen.getByText('Dakar AI Labs')).toBeTruthy();
    // Back link with community query param (?from=dakar-ai)
    expect(screen.getByText(/Retour à la communauté/i)).toBeTruthy();
    // Shows candidate already applied status without crashing
    expect(await screen.findByText(/Candidature envoyée/i, {}, SLOW)).toBeTruthy();
  });

  it('renders correctly for visitor when not signed in', async () => {
    stubOpportunityApi(true);

    renderAppAt('/opportunities/tech-developpeur-fullstack?from=dakar-ai');

    expect(await screen.findByRole('heading', { level: 1, name: 'Tech Développeur Fullstack' }, SLOW)).toBeTruthy();
    expect(screen.getByText(/Connectez-vous pour postuler/i)).toBeTruthy();
  });
});
