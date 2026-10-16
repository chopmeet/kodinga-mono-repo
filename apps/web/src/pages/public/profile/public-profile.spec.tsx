import { act, cleanup, screen } from '@testing-library/react';

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

  it('says when a profile does not exist or is private', async () => {
    stubApi({ 'profiles/nobody/': { status: 404, body: { success: false, code: 'not_found', message: 'Profil introuvable.' } } });
    renderAppAt('/profiles/nobody');
    expect(await screen.findByRole('heading', { name: 'Profil introuvable' }, SLOW)).toBeTruthy();
  });
});
