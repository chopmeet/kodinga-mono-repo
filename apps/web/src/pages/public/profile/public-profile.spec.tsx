import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';

import store from '@/redux/store';
import { renderAppAt, SLOW, stubApi } from '@/test-utils';
import { UserApi } from '@/utils/api/user/user.api';

vi.setConfig({ testTimeout: 15_000 });

const profile = {
  id: 'p1',
  user: { id: 'u1', username: 'ousmane-sidi-diallo', full_name: 'Ousmane Sidi Diallo', date_joined: '2025-12-07T10:00:00Z' },
  display_name: 'Ousmane Sidi Diallo',
  headline: 'Développeur full-stack à Dakar',
  bio: '',
  avatar_url: '',
  banner_url: '',
  location: 'Dakar',
  skills: [],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(UserApi.util.resetApiState());
  });
});

describe('Public profile', () => {
  it('shows the identity of the profile from the api', async () => {
    // Other calls of the page (e.g. categories) get a neutral answer
    stubApi({ 'profiles/ousmane-sidi-diallo/': { body: { success: true, data: profile } } });
    renderAppAt('/profiles/ousmane-sidi-diallo');
    expect(await screen.findByRole('heading', { level: 1, name: 'Ousmane Sidi Diallo' }, SLOW)).toBeTruthy();
    expect(screen.getByText('@ousmane-sidi-diallo')).toBeTruthy();
    expect(screen.getByText('Développeur full-stack à Dakar')).toBeTruthy();
    expect(screen.getByText('Inscrit le 7 décembre 2025')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Activité' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Partager le profil/ })).toBeTruthy();
  });

  it('shows the availability, the links, the skills, the career and the portfolio', async () => {
    stubApi({
      'profiles/ousmane-sidi-diallo/': {
        body: {
          success: true,
          data: {
            ...profile,
            bio: 'Je construis des apps de paiement mobile.',
            availability_status: 'available',
            open_to_freelance: true,
            open_to_remote: true,
            years_of_experience: 5,
            github_username: 'ousmane',
            linkedin_url: 'https://linkedin.com/in/ousmane',
            website_url: 'ftp://ousmane.dev',
            skills: [
              { id: 's1', technology: { id: 't1', name: 'Django' }, level: 'advanced', years_of_experience: 4, is_highlighted: false },
              { id: 's2', technology: { id: 't2', name: 'React' }, level: 'expert', years_of_experience: 5, is_highlighted: true },
            ],
            experiences: [
              { id: 'x1', title: 'Stagiaire', company_name: 'Orange', company_url: '', location: 'Dakar', employment_type: 'internship', is_remote: false, start_date: '2019-01-01', end_date: '2019-06-01', is_current: false, description: '', technologies: [] },
              { id: 'x2', title: 'Lead backend', company_name: 'Wave', company_url: 'https://wave.com', location: '', employment_type: 'full_time', is_remote: true, start_date: '2022-03-01', end_date: null, is_current: true, description: '', technologies: [{ id: 't1', name: 'Django' }] },
            ],
            educations: [{ id: 'e1', institution: 'ESP Dakar', degree: 'Master', field_of_study: 'Génie logiciel', start_date: '2016-09-01', end_date: '2018-07-01', is_current: false, description: '' }],
            portfolio_projects: [
              { id: 'p1', title: 'Tontine Plus', description: 'Une tontine en ligne.', project_url: 'https://tontine.example.com', repo_url: '', thumbnail_url: '', is_featured: true, order: 0, technologies: [] },
            ],
          },
        },
      },
    });
    renderAppAt('/profiles/ousmane-sidi-diallo');
    await screen.findByRole('heading', { level: 1, name: 'Ousmane Sidi Diallo' }, SLOW);

    expect(screen.getByText('Disponible')).toBeTruthy();
    expect(screen.getByText('Freelance')).toBeTruthy();
    expect(screen.getByText('5 ans d’expérience')).toBeTruthy();
    const links = screen.getByRole('list', { name: 'Liens' });
    expect(within(links).getByRole('link', { name: /GitHub/ }).getAttribute('href')).toBe('https://github.com/ousmane');
    // A link that is not a web page is never rendered
    expect(within(links).queryByRole('link', { name: /Site web/ })).toBeNull();

    // À propos: the bio, the highlighted skills first
    expect(screen.getByText('Je construis des apps de paiement mobile.')).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'Compétences' })).getAllByRole('listitem')[0].textContent).toMatch(/React/);

    fireEvent.click(screen.getByRole('tab', { name: /Parcours/ }));
    const experiences = within(screen.getByRole('list', { name: 'Expériences' })).getAllByRole('listitem');
    expect(experiences[0].textContent).toMatch(/Lead backend/);
    expect(experiences[0].textContent).toMatch(/aujourd’hui/);
    expect(within(experiences[0]).getByRole('link', { name: 'Wave' }).getAttribute('href')).toBe('https://wave.com');
    expect(screen.getByRole('list', { name: 'Formations' }).textContent).toMatch(/Master/);

    fireEvent.click(screen.getByRole('tab', { name: /Portfolio/ }));
    const portfolio = screen.getByRole('list', { name: 'Portfolio' });
    expect(within(portfolio).getByText('Tontine Plus')).toBeTruthy();
    expect(within(portfolio).getByRole('link', { name: /Démo/ }).getAttribute('href')).toBe('https://tontine.example.com');
  });

  it('shows the figures, the communities and the contributions of the profile', async () => {
    const contributions = {
      posts_count: 12, projects_count: 3, badges_count: 2, reputation_points: 1240,
      recent_posts: [{ id: 'p1', title: 'Retour sur React 19', post_type: 'discussion', created_at: '2026-10-30T10:00:00Z', reactions_count: 4, comments_count: 2, community_slug: 'abidjan-react', community_name: 'Abidjan React' }],
      recent_projects: [{ id: 'pr1', title: 'Wari Pay', slug: 'wari-pay', cover_image_url: '', upvotes_count: 7, is_featured: false }],
    };
    const communities = [{ id: 'c1', name: 'Abidjan React', slug: 'abidjan-react', avatar_url: '', role: 'moderator', members_count: 240 }];
    stubApi({ 'profiles/ousmane-sidi-diallo/': { body: { success: true, data: { ...profile, contributions, communities } } } });
    renderAppAt('/profiles/ousmane-sidi-diallo');
    await screen.findByRole('heading', { level: 1, name: 'Ousmane Sidi Diallo' }, SLOW);
    expect(screen.getByText('Publications').parentElement?.textContent).toContain('12');
    expect(screen.getByText('Points').parentElement?.textContent).toMatch(/1,2|1\s240/);

    fireEvent.click(screen.getByRole('tab', { name: /Communautés/ }));
    const list = screen.getByRole('list', { name: 'Communautés de Ousmane Sidi Diallo' });
    expect(within(list).getByRole('link', { name: /Abidjan React/ }).getAttribute('href')).toBe('/communities/abidjan-react');
    expect(within(list).getByText(/Modérateur · 240 membres/)).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /Contributions/ }));
    expect(screen.getByRole('link', { name: 'Retour sur React 19' }).getAttribute('href')).toBe('/communities/abidjan-react/posts/p1');
    expect(screen.getByRole('region', { name: 'Dernières publications' }).textContent).toContain('Abidjan React · ');
    expect(screen.getByRole('link', { name: 'Wari Pay' }).getAttribute('href')).toBe('/projects/wari-pay');
    expect(screen.getByText('2 badges obtenus')).toBeTruthy();
  });

  it('says when a section is still empty', async () => {
    stubApi({ 'profiles/ousmane-sidi-diallo/': { body: { success: true, data: profile } } });
    renderAppAt('/profiles/ousmane-sidi-diallo');
    await screen.findByRole('heading', { level: 1, name: 'Ousmane Sidi Diallo' }, SLOW);
    expect(screen.getByText('Ousmane Sidi Diallo n’a pas encore rempli sa présentation.')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Parcours/ }));
    expect(screen.getByText('Ousmane Sidi Diallo n’a pas encore renseigné son parcours.')).toBeTruthy();
  });

  it('says when a profile does not exist or is private', async () => {
    stubApi({ 'profiles/nobody/': { status: 404, body: { success: false, code: 'not_found', message: 'Profil introuvable.' } } });
    renderAppAt('/profiles/nobody');
    expect(await screen.findByRole('heading', { name: 'Profil introuvable' }, SLOW)).toBeTruthy();
  });
});
