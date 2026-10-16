import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import store from '@/redux/store';
import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import { renderAppAt, SLOW, stubApi } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { User } from '@/utils/api/user/user.type';

// Full app tree + network stubs: slow when the whole suite runs in parallel
vi.setConfig({ testTimeout: 20_000 });

const awa = { id: 'u1', first_name: 'Awa', last_name: 'Ndiaye', full_name: 'Awa Ndiaye', email: 'awa@example.com' } as User;

const categories = [
  { id: 'cat-web', name: 'Web Development', slug: 'web-development', description: '', icon_url: '', order: 1, created_at: '' },
  { id: 'cat-cloud', name: 'Cloud & DevOps', slug: 'cloud-devops', description: '', icon_url: '', order: 5, created_at: '' },
];

/** What the api answers for the new community (CommunityDetailSerializer) */
const created = {
  id: 'c1',
  name: 'Dakar Cloud Builders',
  slug: 'dakar-cloud-builders',
  tagline: 'Les ingénieurs cloud de Dakar.',
  description: '',
  avatar_url: '',
  banner_url: '',
  brand_color: '#16A34A',
  category: categories[1],
  owner: awa,
  privacy_type: 'private',
  pricing_type: 'free',
  is_verified: false,
  is_featured: false,
  members_count: 1,
  posts_count: 0,
  courses_count: 0,
  events_count: 0,
  created_at: '2026-10-11T10:00:00Z',
  user_membership: { is_member: true, role: 'owner', status: 'active' },
};

const ok = (data: unknown, status = 200) => ({ status, body: { success: true, data } });

const continueButton = () => screen.getByRole('button', { name: /Continuer/ });

async function fillCommunitySteps() {
  await screen.findByRole('heading', { name: 'Comment s’appelle votre communauté ?' }, SLOW);
  fireEvent.change(screen.getByLabelText(/^Nom de la communauté/), { target: { value: 'Dakar Cloud Builders' } });
  fireEvent.click(continueButton());

  await screen.findByRole('heading', { name: 'De quoi va-t-on parler ?' }, SLOW);
  fireEvent.click(await screen.findByRole('button', { name: 'Cloud & DevOps' }, SLOW));
  fireEvent.change(screen.getByLabelText(/^Accroche/), { target: { value: 'Les ingénieurs cloud de Dakar.' } });
  fireEvent.click(continueButton());

  await screen.findByRole('heading', { name: 'Qui peut la rejoindre ?' }, SLOW);
  fireEvent.click(screen.getByRole('radio', { name: /^Privée/ }));
  fireEvent.click(continueButton());

  await screen.findByRole('heading', { name: 'Donnez-lui une identité' }, SLOW);
  fireEvent.click(screen.getByRole('button', { name: 'Couleur #16A34A' }));
}

// Never reach a real api: every test answers the categories, and the cache is reset after each one
beforeEach(() => {
  stubApi({ 'communities/categories/': ok(categories) });
});

afterEach(() => {
  // Unmount first: resetting the cache under a mounted page would refetch through the real fetch
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
  act(() => {
    store.dispatch(onLogout());
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Create a community', () => {
  it('builds the live preview while the visitor types', async () => {
    renderAppAt('/create-community');
    await screen.findByRole('heading', { name: 'Comment s’appelle votre communauté ?' }, SLOW);
    fireEvent.change(screen.getByLabelText(/^Nom de la communauté/), { target: { value: 'Abidjan Flutter Crew' } });
    const preview = screen.getByRole('figure', { name: 'Aperçu de la communauté' });
    expect(within(preview).getByText('Abidjan Flutter Crew')).toBeTruthy();
    expect(within(preview).getByText('abidjan-flutter-crew')).toBeTruthy();
    expect(screen.getByText('Étape 1 sur 5')).toBeTruthy();
  });

  it('does not move on without a valid name', async () => {
    renderAppAt('/create-community');
    await screen.findByRole('heading', { name: 'Comment s’appelle votre communauté ?' }, SLOW);
    // Like the design: "Continuer" stays off until the name has 3 characters
    expect((continueButton() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/^Nom de la communauté/), { target: { value: 'Ab' } });
    expect((continueButton() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/^Nom de la communauté/), { target: { value: 'Abc' } });
    expect((continueButton() as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText('Étape 1 sur 5')).toBeTruthy();
  });

  it('lets a visitor create their account and the community, then opens its space', async () => {
    const calls = stubApi({
      'communities/categories/': ok(categories),
      'auth/register/': ok(awa, 201),
      'auth/login/': ok({ access: 'access', refresh: 'refresh', session_id: 's', user: awa }),
      'communities/dakar-cloud-builders/': ok(created),
      'communities/': ok(created, 201),
    });
    const { where } = renderAppAt('/create-community');
    await fillCommunitySteps();
    fireEvent.click(continueButton());

    await screen.findByRole('heading', { name: 'Dernière étape : votre compte' }, SLOW);
    fireEvent.change(screen.getByLabelText(/^Prénom/), { target: { value: 'Awa' } });
    fireEvent.change(screen.getByLabelText(/^Nom\b/), { target: { value: 'Ndiaye' } });
    fireEvent.change(screen.getByLabelText(/^Adresse email/), { target: { value: 'Awa@Example.com' } });
    fireEvent.change(screen.getByLabelText(/^Mot de passe/), { target: { value: 'kodinga2026' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /J'accepte les conditions/ }));
    fireEvent.click(screen.getByRole('button', { name: /Créer ma communauté/ }));

    await waitFor(() => expect(where()).toBe('/c/dakar-cloud-builders/dashboard?welcome=1'), SLOW);
    expect(await screen.findByRole('heading', { name: 'Dakar Cloud Builders est en ligne !' }, SLOW)).toBeTruthy();

    const posted = (path: string) => calls.find((c) => c.method === 'POST' && new URL(c.url).pathname.endsWith(path));
    expect(posted('auth/register/')?.body).toMatchObject({ email: 'awa@example.com', username: 'awa_ndiaye', terms_accepted: true });
    expect(posted('auth/login/')?.body).toMatchObject({ email: 'awa@example.com', password: 'kodinga2026' });
    const body = posted('/communities/')?.body as Record<string, unknown>;
    expect(body).toMatchObject({
      name: 'Dakar Cloud Builders',
      tagline: 'Les ingénieurs cloud de Dakar.',
      category_id: 'cat-cloud',
      privacy_type: 'private',
      pricing_type: 'free',
      brand_color: '#16A34A',
      settings: { require_approval_to_join: true },
    });
    // The api builds the slug from the name
    expect(body.slug).toBeUndefined();
  });

  it('skips the account step for a signed-in user', async () => {
    act(() => {
      store.dispatch(onSetUserToken({ user: awa, token: 'access', refresh: 'refresh' }));
    });
    const calls = stubApi({
      'communities/categories/': ok(categories),
      'communities/dakar-cloud-builders/': ok(created),
      'communities/': ok(created, 201),
    });
    const { where } = renderAppAt('/create-community');
    expect(await screen.findByText('Étape 1 sur 4', {}, SLOW)).toBeTruthy();
    await fillCommunitySteps();
    fireEvent.click(screen.getByRole('button', { name: /Créer ma communauté/ }));
    await waitFor(() => expect(where()).toBe('/c/dakar-cloud-builders/dashboard?welcome=1'), SLOW);
    expect(calls.some((c) => c.url.includes('auth/'))).toBe(false);
  });

  it('goes back to the step of a field the api refused', async () => {
    act(() => {
      store.dispatch(onSetUserToken({ user: awa, token: 'access', refresh: 'refresh' }));
    });
    stubApi({
      'communities/categories/': ok(categories),
      'communities/': {
        status: 400,
        body: { success: false, code: 'validation_error', message: 'Invalid', details: { slug: ['Ce slug de communauté est déjà utilisé.'] } },
      },
    });
    renderAppAt('/create-community');
    await fillCommunitySteps();
    fireEvent.click(screen.getByRole('button', { name: /Créer ma communauté/ }));
    expect(await screen.findByRole('heading', { name: 'Comment s’appelle votre communauté ?' }, SLOW)).toBeTruthy();
    expect(screen.getByText('Ce slug de communauté est déjà utilisé.')).toBeTruthy();
    expect((screen.getByLabelText(/kodinga.com\/communities\//) as HTMLInputElement).value).toBe('dakar-cloud-builders');
  });

  it('keeps the draft when the page is reloaded', async () => {
    stubApi({ 'communities/categories/': ok(categories) });
    const first = renderAppAt('/create-community');
    await screen.findByRole('heading', { name: 'Comment s’appelle votre communauté ?' }, SLOW);
    fireEvent.change(screen.getByLabelText(/^Nom de la communauté/), { target: { value: 'Lomé Product Builders' } });
    fireEvent.click(continueButton());
    await screen.findByRole('heading', { name: 'De quoi va-t-on parler ?' }, SLOW);
    first.unmount();

    renderAppAt('/create-community');
    expect(await screen.findByRole('heading', { name: 'De quoi va-t-on parler ?' }, SLOW)).toBeTruthy();
    expect(within(screen.getByRole('figure', { name: 'Aperçu de la communauté' })).getByText('Lomé Product Builders')).toBeTruthy();
  });
});
