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
    // The api requires the slug: the address of the preview, built from the name
    expect(body.slug).toBe('dakar-cloud-builders');
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

  it('sets the price of a paid community at the access step, created with it by the api', async () => {
    act(() => {
      store.dispatch(onSetUserToken({ user: awa, token: 'access', refresh: 'refresh' }));
    });
    const proPlan = { id: 'pro-m', name: 'Pro mensuel', slug: 'kodinga-pro-monthly', description: '', price: '7000.00', currency: 'XOF', billing_interval: 'month', interval_count: 1, community_id: null, community_name: null, features: [], is_active: true, order: 1 };
    const calls = stubApi({
      'communities/categories/': ok(categories),
      'billing/plans/': ok([proPlan]),
      'communities/dakar-cloud-builders/': ok({ ...created, pricing_type: 'paid' }),
      'communities/': ok({ ...created, pricing_type: 'paid' }, 201),
    });
    renderAppAt('/create-community');
    await screen.findByRole('heading', { name: 'Comment s’appelle votre communauté ?' }, SLOW);
    fireEvent.change(screen.getByLabelText(/^Nom de la communauté/), { target: { value: 'Dakar Cloud Builders' } });
    fireEvent.click(continueButton());
    await screen.findByRole('heading', { name: 'De quoi va-t-on parler ?' }, SLOW);
    fireEvent.click(await screen.findByRole('button', { name: 'Cloud & DevOps' }, SLOW));
    fireEvent.click(continueButton());

    await screen.findByRole('heading', { name: 'Qui peut la rejoindre ?' }, SLOW);
    // The Pro price comes from the api (set by the superadmin)
    expect(await screen.findByText(/Réservé aux membres Kodinga Pro \(7\s000 FCFA \/ mois\)/, {}, SLOW)).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /^Payante/ }));
    fireEvent.change(screen.getByLabelText(/^Prix \(FCFA\)/), { target: { value: '300' } });
    fireEvent.click(continueButton());
    expect(await screen.findByText(/Prix minimum : 500 FCFA/, {}, SLOW)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^Prix \(FCFA\)/), { target: { value: '7500' } });
    fireEvent.change(screen.getByLabelText('Facturation'), { target: { value: 'year' } });
    fireEvent.change(screen.getByLabelText(/^Nom de la formule/), { target: { value: 'Pass annuel' } });
    fireEvent.click(continueButton());

    await screen.findByRole('heading', { name: 'Donnez-lui une identité' }, SLOW);
    fireEvent.click(screen.getByRole('button', { name: /Créer ma communauté/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && new URL(c.url).pathname.endsWith('/communities/'))).toBe(true), SLOW);
    expect(calls.find((c) => c.method === 'POST' && new URL(c.url).pathname.endsWith('/communities/'))?.body).toMatchObject({
      pricing_type: 'paid',
      membership_price: 7500,
      membership_interval: 'year',
      membership_plan_name: 'Pass annuel',
    });
  });

  it('adds a logo and a banner by link, shown in the preview and sent to the api', async () => {
    act(() => {
      store.dispatch(onSetUserToken({ user: awa, token: 'access', refresh: 'refresh' }));
    });
    const calls = stubApi({
      'communities/categories/': ok(categories),
      'communities/dakar-cloud-builders/': ok(created),
      'communities/': ok(created, 201),
    });
    renderAppAt('/create-community');
    await fillCommunitySteps();
    // File by default: switch both images to a link
    for (const group of screen.getAllByRole('radiogroup', { name: /Logo|Image de bannière/ })) {
      fireEvent.click(within(group).getByRole('radio', { name: /Lien/ }));
    }
    fireEvent.change(screen.getByLabelText(/^Lien : logo/), { target: { value: 'pas-un-lien' } });
    fireEvent.click(screen.getByRole('button', { name: /Créer ma communauté/ }));
    expect(await screen.findByText('Lien invalide : collez une adresse https://…', {}, SLOW)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/^Lien : logo/), { target: { value: 'https://cdn.example.com/logo.png' } });
    fireEvent.change(screen.getByLabelText(/^Lien : image de bannière/), { target: { value: 'https://cdn.example.com/banner.jpg' } });
    const preview = screen.getByRole('figure', { name: 'Aperçu de la communauté' });
    expect(Array.from(preview.querySelectorAll('img')).map((img) => img.getAttribute('src'))).toEqual([
      'https://cdn.example.com/banner.jpg',
      'https://cdn.example.com/logo.png',
    ]);

    fireEvent.click(screen.getByRole('button', { name: /Créer ma communauté/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && new URL(c.url).pathname.endsWith('/communities/'))).toBe(true), SLOW);
    expect(calls.find((c) => c.method === 'POST' && new URL(c.url).pathname.endsWith('/communities/'))?.body).toMatchObject({
      avatar_url: 'https://cdn.example.com/logo.png',
      banner_url: 'https://cdn.example.com/banner.jpg',
    });
  });

  it('uploads a chosen logo file before creating the community', async () => {
    act(() => {
      store.dispatch(onSetUserToken({ user: awa, token: 'access', refresh: 'refresh' }));
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:logo');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const calls: { method: string; url: string; body: unknown }[] = [];
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    // Api calls go through Request objects; the storage upload is a plain fetch(url, { body: FormData })
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      const method = typeof input === 'string' ? (init?.method ?? 'GET') : (input as Request).method;
      const text = typeof input === 'string' || method === 'GET' ? '' : await (input as Request).text();
      calls.push({ method, url, body: typeof input === 'string' ? init?.body : text ? JSON.parse(text) : null });
      const path = new URL(url).pathname;
      if (path.endsWith('communities/categories/')) return json({ success: true, data: categories });
      if (path.endsWith('media/upload-url/')) {
        return json({ success: true, data: { asset_id: 'a1', file_key: 'kodinga/avatar/k1_logo.png', upload_url: 'https://storage.example.com/upload', fields: { key: 'kodinga/avatar/k1_logo.png' }, max_file_size: 5242880 } }, 201);
      }
      if (url === 'https://storage.example.com/upload') return json({ url: 'https://utfs.io/f/k1' });
      if (path.endsWith('media/confirm-upload/')) return json({ success: true, data: { id: 'a1', file_url: 'https://utfs.io/f/k1' } });
      if (path.endsWith('/communities/') && method === 'POST') return json({ success: true, data: created }, 201);
      return json({ success: true, data: created });
    });
    renderAppAt('/create-community');
    await fillCommunitySteps();

    const input = screen.getByLabelText('Choisir le fichier : Logo (facultatif)');
    fireEvent.change(input, { target: { files: [new File(['%PDF'], 'logo.pdf', { type: 'application/pdf' })] } });
    expect(await screen.findByText('Format non accepté : JPG, PNG, WEBP, GIF.', {}, SLOW)).toBeTruthy();
    fireEvent.change(input, { target: { files: [new File(['png'], 'logo.png', { type: 'image/png' })] } });
    expect(await screen.findByText('logo.png', {}, SLOW)).toBeTruthy();
    expect(screen.getByRole('figure', { name: 'Aperçu de la communauté' }).querySelector('img')?.getAttribute('src')).toBe('blob:logo');

    fireEvent.click(screen.getByRole('button', { name: /Créer ma communauté/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && new URL(c.url).pathname.endsWith('/communities/'))).toBe(true), SLOW);
    expect(calls.find((c) => c.url.endsWith('media/upload-url/'))?.body).toEqual({ file_name: 'logo.png', file_size: 3, mime_type: 'image/png', purpose: 'avatar' });
    expect(calls.find((c) => c.url.endsWith('media/confirm-upload/'))?.body).toEqual({ file_key: 'kodinga/avatar/k1_logo.png', file_url: 'https://utfs.io/f/k1', file_size: 3 });
    expect(calls.find((c) => c.method === 'POST' && new URL(c.url).pathname.endsWith('/communities/'))?.body).toMatchObject({ avatar_url: 'https://utfs.io/f/k1' });
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
