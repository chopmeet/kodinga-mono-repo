import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import store from '@/redux/store';
import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import { renderAppAt, SLOW, stubApi } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { User } from '@/utils/api/user/user.type';
import i18n from '@/utils/i18n';

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

/** Kodinga Pro plans of the api (no community): prices set by the superadmin */
const proPlan = (id: string, price: string, billing_interval: string) => ({
  id, name: id, slug: id, description: '', price, currency: 'XOF', billing_interval, interval_count: 1,
  community_id: null, community_name: null, features: [], is_active: true, order: 1,
});
const proPlans = [proPlan('pro-m', '5000.00', 'month'), proPlan('pro-y', '50000.00', 'year'), proPlan('pro-l', '150000.00', 'one_time')];
const proSubscription = { id: 's-pro', community_id: null, is_active: true, status: 'active', plan: proPlans[0], current_period_end: '2026-12-11T00:00:00Z' };

/** The plan chooser, over the flow on arrival: start free */
async function startFree() {
  const chooser = await screen.findByRole('dialog', { name: 'Choisissez votre formule' }, SLOW);
  fireEvent.click(within(chooser).getByRole('button', { name: 'Commencer gratuitement' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), SLOW);
}

/** A draft saved in the tab, as the flow leaves it (e.g. before going to PayDunya) */
const saveDraft = (step: string, values: Record<string, unknown>) =>
  sessionStorage.setItem(
    'create_community_draft',
    JSON.stringify({
      step,
      slugEdited: false,
      planChosen: true,
      values: {
        name: 'Dakar Cloud Builders', slug: '', tagline: 'Les ingénieurs cloud de Dakar.', category_id: 'cat-cloud',
        privacy_type: 'private', pricing_type: 'paid', brand_color: '#16A34A', avatar_url: '', banner_url: '',
        membership_price: '5000', membership_interval: 'month', membership_plan_name: '', formula: 'pro', pro_plan_id: 'pro-m',
        ...values,
      },
    })
  );

async function fillCommunitySteps() {
  await startFree();
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
    await startFree();
    await screen.findByRole('heading', { name: 'Comment s’appelle votre communauté ?' }, SLOW);
    fireEvent.change(screen.getByLabelText(/^Nom de la communauté/), { target: { value: 'Abidjan Flutter Crew' } });
    const preview = screen.getByRole('figure', { name: 'Aperçu de la communauté' });
    expect(within(preview).getByText('Abidjan Flutter Crew')).toBeTruthy();
    expect(within(preview).getByText('abidjan-flutter-crew')).toBeTruthy();
    // The plan is not a step: name, topic, access, look, account
    expect(screen.getByText('Étape 1 sur 5')).toBeTruthy();
  });

  it('does not move on without a valid name', async () => {
    renderAppAt('/create-community');
    await startFree();
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
    // Name, topic, access, look: no account step
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
    // Already Pro: no plan step, the paid access is open
    const calls = stubApi({
      'communities/categories/': ok(categories),
      'billing/plans/': ok(proPlans),
      'billing/subscriptions/me/': ok([proSubscription]),
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
    expect(await screen.findByText('Membre Pro : vos membres paient leur adhésion.', {}, SLOW)).toBeTruthy();
    expect((screen.getByRole('radio', { name: /^Publique/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: /^Payante/ }));
    // A paid community is private: public is closed, the choice moves to private
    await waitFor(() => expect((screen.getByRole('radio', { name: /^Privée/ }) as HTMLInputElement).checked).toBe(true), SLOW);
    expect(screen.getByRole('radio', { name: /^Publique/ })).toHaveProperty('disabled', true);
    expect(screen.getByText('Indisponible : une communauté payante est forcément privée ou secrète.')).toBeTruthy();
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
      privacy_type: 'private',
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
    expect((screen.getByLabelText(/kodinga.app\/communities\//) as HTMLInputElement).value).toBe('dakar-cloud-builders');
  });

  it('keeps the draft when the page is reloaded', async () => {
    stubApi({ 'communities/categories/': ok(categories) });
    const first = renderAppAt('/create-community');
    await startFree();
    await screen.findByRole('heading', { name: 'Comment s’appelle votre communauté ?' }, SLOW);
    fireEvent.change(screen.getByLabelText(/^Nom de la communauté/), { target: { value: 'Lomé Product Builders' } });
    fireEvent.click(continueButton());
    await screen.findByRole('heading', { name: 'De quoi va-t-on parler ?' }, SLOW);
    first.unmount();

    renderAppAt('/create-community');
    expect(await screen.findByRole('heading', { name: 'De quoi va-t-on parler ?' }, SLOW)).toBeTruthy();
    expect(within(screen.getByRole('figure', { name: 'Aperçu de la communauté' })).getByText('Lomé Product Builders')).toBeTruthy();
  });

  it('locks the paid access on the free plan, and "Passer Pro" opens the plan chooser again', async () => {
    stubApi({ 'communities/categories/': ok(categories), 'billing/plans/': ok(proPlans) });
    renderAppAt('/create-community');
    await startFree();
    await screen.findByRole('heading', { name: 'Comment s’appelle votre communauté ?' }, SLOW);
    // The plan stays at hand on every step
    expect(screen.getByText('Formule :')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^Nom de la communauté/), { target: { value: 'Dakar Cloud Builders' } });
    fireEvent.click(continueButton());
    await screen.findByRole('heading', { name: 'De quoi va-t-on parler ?' }, SLOW);
    fireEvent.click(continueButton());

    await screen.findByRole('heading', { name: 'Qui peut la rejoindre ?' }, SLOW);
    expect(screen.getByRole('radio', { name: /^Payante/ })).toHaveProperty('disabled', true);
    expect(screen.getByText(/Les communautés payantes demandent Kodinga Pro\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Passer Pro' }));
    const chooser = await screen.findByRole('dialog', { name: 'Choisissez votre formule' }, SLOW);
    expect(within(chooser).getByRole('button', { name: /Continuer avec Pro/ })).toBeTruthy();
    // A plan was chosen already: the chooser can be closed again
    fireEvent.click(within(chooser).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), SLOW);
  });

  it('asks the account right after Pro, then pays the chosen period on PayDunya', async () => {
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, origin: 'http://localhost:4200', assign } });
    try {
      const calls = stubApi({
        'communities/categories/': ok(categories),
        'billing/plans/': ok(proPlans),
        'auth/register/': ok(awa, 201),
        'auth/login/': ok({ access: 'access', refresh: 'refresh', session_id: 's', user: awa }),
        'billing/subscriptions/me/': ok([]),
        'billing/checkout/': ok({ payment_id: 'pay-1', token: 't', checkout_url: 'https://paydunya.com/checkout/abc', amount: '50000.00', currency: 'XOF', plan_name: 'pro-y' }, 201),
      });
      renderAppAt('/create-community');
      const chooser = await screen.findByRole('dialog', { name: 'Choisissez votre formule' }, SLOW);
      // Prices of the api; the yearly saving is computed (12 × 5 000 − 50 000)
      const pro = within(chooser).getByRole('region', { name: 'Kodinga Pro' });
      await waitFor(() => expect(pro.textContent).toMatch(/5\s000 FCFA/), SLOW);
      fireEvent.click(within(pro).getByRole('radio', { name: /^Annuel/ }));
      expect(await within(pro).findByText(/Soit 10\s000 FCFA d’économie sur un an/, {}, SLOW)).toBeTruthy();
      expect(within(pro).getByRole('radio', { name: /^À vie/ })).toBeTruthy();
      fireEvent.click(within(pro).getByRole('button', { name: /Continuer avec Pro/ }));

      await screen.findByRole('heading', { name: 'Votre compte, avant le paiement' }, SLOW);
      fireEvent.change(screen.getByLabelText(/^Prénom/), { target: { value: 'Awa' } });
      fireEvent.change(screen.getByLabelText(/^Nom\b/), { target: { value: 'Ndiaye' } });
      fireEvent.change(screen.getByLabelText(/^Adresse email/), { target: { value: 'awa@example.com' } });
      fireEvent.change(screen.getByLabelText(/^Mot de passe/), { target: { value: 'kodinga2026' } });
      fireEvent.click(screen.getByRole('checkbox', { name: /J'accepte les conditions/ }));
      fireEvent.click(screen.getByRole('button', { name: /Payer et continuer/ }));

      await waitFor(() => expect(assign).toHaveBeenCalledWith('https://paydunya.com/checkout/abc'), SLOW);
      expect(calls.find((c) => c.method === 'POST' && c.url.endsWith('billing/checkout/'))?.body).toMatchObject({
        plan_id: 'pro-y',
        return_url: 'http://localhost:4200/create-community?payment=done',
        cancel_url: 'http://localhost:4200/create-community?payment=cancelled',
      });
      // Back from PayDunya, the flow resumes on the name step
      expect(JSON.parse(sessionStorage.getItem('create_community_draft') ?? '{}')).toMatchObject({ step: 'name', values: { formula: 'pro', pricing_type: 'paid' } });
      expect(calls.some((c) => c.method === 'POST' && new URL(c.url).pathname.endsWith('/communities/'))).toBe(false);
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });

  it('lets a signed-in user pay Pro straight from the plan chooser', async () => {
    act(() => {
      store.dispatch(onSetUserToken({ user: awa, token: 'access', refresh: 'refresh' }));
    });
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, origin: 'http://localhost:4200', assign } });
    try {
      const calls = stubApi({
        'communities/categories/': ok(categories),
        'billing/plans/': ok(proPlans),
        'billing/subscriptions/me/': ok([]),
        'billing/checkout/': ok({ payment_id: 'pay-2', token: 't', checkout_url: 'https://paydunya.com/checkout/def', amount: '5000.00', currency: 'XOF', plan_name: 'pro-m' }, 201),
      });
      renderAppAt('/create-community');
      const chooser = await screen.findByRole('dialog', { name: 'Choisissez votre formule' }, SLOW);
      const pro = within(chooser).getByRole('region', { name: 'Kodinga Pro' });
      await waitFor(() => expect(pro.textContent).toMatch(/5\s000 FCFA/), SLOW);
      fireEvent.click(within(pro).getByRole('button', { name: /Payer et continuer/ }));
      await waitFor(() => expect(assign).toHaveBeenCalledWith('https://paydunya.com/checkout/def'), SLOW);
      expect(calls.find((c) => c.method === 'POST' && c.url.endsWith('billing/checkout/'))?.body).toMatchObject({ plan_id: 'pro-m' });
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });

  it('resumes on the name step once Pro is paid, the paid access chosen', async () => {
    act(() => {
      store.dispatch(onSetUserToken({ user: awa, token: 'access', refresh: 'refresh' }));
    });
    saveDraft('name', {});
    sessionStorage.setItem('kodinga_pending_payment', JSON.stringify({ slug: 'kodinga-pro', paymentId: 'pay-1' }));
    stubApi({
      'communities/categories/': ok(categories),
      'billing/plans/': ok(proPlans),
      'billing/payments/pay-1/status/': ok({ payment_id: 'pay-1', status: 'PAID', is_paid: true, receipt_url: '', paid_at: '2026-11-11T10:00:00Z' }),
      'billing/subscriptions/me/': ok([proSubscription]),
    });
    renderAppAt('/create-community?payment=done');
    expect(await screen.findByText(/Paiement confirmé : vous êtes membre Pro/, {}, SLOW)).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Comment s’appelle votre communauté ?' }, SLOW)).toBeTruthy();
    // Pro now: no plan step any more
    await waitFor(() => expect(screen.getByText('Étape 1 sur 4')).toBeTruthy(), SLOW);
    fireEvent.click(continueButton());
    await screen.findByRole('heading', { name: 'De quoi va-t-on parler ?' }, SLOW);
    fireEvent.click(continueButton());
    await screen.findByRole('heading', { name: 'Qui peut la rejoindre ?' }, SLOW);
    expect((screen.getByRole('radio', { name: /^Payante/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('comes back to the plan step when the payment is cancelled', async () => {
    act(() => {
      store.dispatch(onSetUserToken({ user: awa, token: 'access', refresh: 'refresh' }));
    });
    saveDraft('name', {});
    stubApi({ 'communities/categories/': ok(categories), 'billing/plans/': ok(proPlans), 'billing/subscriptions/me/': ok([]) });
    renderAppAt('/create-community?payment=cancelled');
    const chooser = await screen.findByRole('dialog', { name: 'Choisissez votre formule' }, SLOW);
    expect(within(chooser).getByText(/Paiement annulé : vous n’avez pas été débité/)).toBeTruthy();
    expect(within(chooser).getByRole('button', { name: 'Commencer gratuitement' })).toBeTruthy();
  });

  it('offers to create it free when the Pro payment is not confirmed yet', async () => {
    act(() => {
      store.dispatch(onSetUserToken({ user: awa, token: 'access', refresh: 'refresh' }));
    });
    saveDraft('look', {});
    const calls = stubApi({
      'communities/categories/': ok(categories),
      'billing/plans/': ok(proPlans),
      'billing/subscriptions/me/': ok([]),
      'communities/dakar-cloud-builders/': ok(created),
      'communities/': ok(created, 201),
    });
    renderAppAt('/create-community');
    await screen.findByRole('heading', { name: 'Donnez-lui une identité' }, SLOW);
    fireEvent.click(screen.getByRole('button', { name: /Créer ma communauté/ }));
    expect(await screen.findByText(/Votre paiement Kodinga Pro n’est pas encore confirmé/, {}, SLOW)).toBeTruthy();
    const posted = () => calls.find((c) => c.method === 'POST' && new URL(c.url).pathname.endsWith('/communities/'));
    expect(posted()).toBeUndefined();

    fireEvent.click(screen.getByRole('button', { name: 'Créer en gratuite maintenant' }));
    await waitFor(() => expect(posted()).toBeTruthy(), SLOW);
    expect(posted()?.body).toMatchObject({ name: 'Dakar Cloud Builders', pricing_type: 'free' });
  });

  it('speaks English: steps, preview and the access choices', async () => {
    await act(() => i18n.changeLanguage('en'));
    try {
      renderAppAt('/create-community');
      const chooser = await screen.findByRole('dialog', { name: 'Choose your plan' }, SLOW);
      fireEvent.click(within(chooser).getByRole('button', { name: 'Start for free' }));
      await screen.findByRole('heading', { name: 'What is your community called?' }, SLOW);
      expect(screen.getByText('Step 1 of 5')).toBeTruthy();
      fireEvent.change(screen.getByLabelText(/^Community name/), { target: { value: 'Abidjan Flutter Crew' } });
      const preview = screen.getByRole('figure', { name: 'Community preview' });
      expect(within(preview).getByText('Free access')).toBeTruthy();
      expect(within(screen.getByRole('list', { name: 'Steps' })).getByText('Identity')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
      expect(await screen.findByRole('heading', { name: 'What will it be about?' }, SLOW)).toBeTruthy();
    } finally {
      await act(() => i18n.changeLanguage('fr'));
    }
  });
});
