import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { getMyCommunity } from '@/data/community-space.data';
import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { must, renderAppAt, SLOW, TEST_TOKEN } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { User } from '@/utils/api/user/user.type';

vi.setConfig({ testTimeout: 15_000 });

type Call = { method: string; url: URL; body: Record<string, unknown> | null };
const COMMUNITY_ID = must(getMyCommunity('dakar-devops')).community.id;
const owner = { id: 'u9', username: 'awa', first_name: 'Awa', last_name: 'Ndiaye', avatar_url: '', headline: '' };
const project = (slug: string, extra: Record<string, unknown> = {}) => ({
  id: slug, title: 'Tontine Plus', slug, tagline: 'La tontine en ligne', description: '', cover_image_url: '', demo_url: 'https://tontine.example.com', repository_url: '',
  status: 'published', upvotes_count: 3, views_count: 9, is_featured: false, is_upvoted: false, owner, technologies: [], community_id: COMMUNITY_ID, created_at: '2026-10-01T10:00:00Z', updated_at: '',
  demo_images: [], ...extra,
});

/** Projects (raw DRF answers) and the image storage of the api (upload-url, storage, confirm) */
function stubApi({ refuseDemo = false } = {}) {
  const calls: Call[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    // The upload to the storage calls fetch(url, options), the api a Request
    const request = input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(request.url);
    // A multipart body holding a File never resolves in jsdom: not read
    const multipart = request.headers.get('Content-Type')?.startsWith('multipart/form-data');
    const text = request.method === 'GET' || multipart ? '' : await request.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ method: request.method, url, body });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    const path = url.pathname;
    if (path.endsWith('/media/upload-url/')) return json({ success: true, data: { upload_url: 'https://storage.example.com/upload', fields: {}, file_key: 'k1' } });
    if (url.host === 'storage.example.com') return json([{ url: 'https://cdn.example.com/capture-1.png' }]);
    if (path.endsWith('/media/confirm-upload/')) return json({ success: true, data: { file_url: 'https://cdn.example.com/capture-1.png' } });
    if (path.endsWith('/projects/') && request.method === 'POST') {
      if (refuseDemo) return json({ demo_images: { 1: ['Enter a valid URL.'] } }, 400);
      return json(project('mobile-money', { title: body?.title, demo_images: body?.demo_images, owner: { ...owner, id: 'me' } }), 201);
    }
    if (path.endsWith('/projects/')) {
      return json([project('tontine-plus', { cover_image_url: 'https://cdn.example.com/cover.png', demo_images: ['https://cdn.example.com/a.png', 'https://cdn.example.com/b.png', 'https://cdn.example.com/c.png'] })]);
    }
    if (path.endsWith('/projects/tontine-plus/')) {
      return json(project('tontine-plus', { demo_images: ['https://cdn.example.com/a.png', 'https://cdn.example.com/b.png', 'https://cdn.example.com/c.png'] }));
    }
    if (path.endsWith('/comments/')) return json([]);
    if (path.endsWith('/communities/abidjan-react/')) {
      return json({ success: true, data: { id: 'c1', name: 'Abidjan React', slug: 'abidjan-react', privacy_type: 'public', pricing_type: 'free', members_count: 4, owner, user_membership: { is_member: false, role: null, status: null } } });
    }
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
  });
  return calls;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(onLogout());
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

async function openForm() {
  renderAppAt('/c/dakar-devops/projects');
  fireEvent.click(await screen.findByRole('button', { name: /Partager un projet/ }, SLOW));
  const dialog = await screen.findByRole('dialog', {}, SLOW);
  fireEvent.change(within(dialog).getByLabelText(/^Nom du projet/), { target: { value: 'Mobile Money SDK' } });
  fireEvent.change(within(dialog).getByLabelText(/^Dépôt de code/), { target: { value: 'https://github.com/fatou/momo-sdk' } });
  return dialog;
}

describe('Projects: demo images', () => {
  it('uploads a screenshot, adds one by link, removes one and sends the list', async () => {
    const calls = stubApi();
    const dialog = await openForm();
    const files = dialog.querySelector('#project-demos-file') as HTMLInputElement;
    fireEvent.change(files, { target: { files: [new File(['png'], 'capture.png', { type: 'image/png' })] } });
    await waitFor(() => expect(within(dialog).getByAltText('Démo 1').getAttribute('src')).toBe('https://cdn.example.com/capture-1.png'), SLOW);
    expect(calls.find((c) => c.url.pathname.endsWith('/media/upload-url/'))?.body).toMatchObject({ file_name: 'capture.png', mime_type: 'image/png' });

    fireEvent.click(within(dialog).getByRole('button', { name: /Lien URL/ }));
    fireEvent.change(within(dialog).getByLabelText('Lien de l’image'), { target: { value: 'https://cdn.example.com/capture-2.png' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ajouter' }));
    fireEvent.click(within(dialog).getByRole('button', { name: /Lien URL/ }));
    fireEvent.change(within(dialog).getByLabelText('Lien de l’image'), { target: { value: 'https://cdn.example.com/capture-3.png' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ajouter' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer la capture 2' }));

    fireEvent.click(within(dialog).getByRole('button', { name: 'Partager le projet' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.url.pathname.endsWith('/projects/'))?.body).toMatchObject({
      community_id: COMMUNITY_ID,
      demo_images: ['https://cdn.example.com/capture-1.png', 'https://cdn.example.com/capture-3.png'],
    }), SLOW);
  });

  it('refuses a file that is not an image and shows the refusal of the api under the field', async () => {
    stubApi({ refuseDemo: true });
    const dialog = await openForm();
    fireEvent.change(dialog.querySelector('#project-demos-file') as HTMLInputElement, { target: { files: [new File(['%PDF'], 'notes.pdf', { type: 'application/pdf' })] } });
    expect((await within(dialog).findByRole('alert', {}, SLOW)).textContent).toMatch(/Format non accepté/);

    fireEvent.click(within(dialog).getByRole('button', { name: /Lien URL/ }));
    fireEvent.change(within(dialog).getByLabelText('Lien de l’image'), { target: { value: 'https://cdn.example.com/ok.png' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ajouter' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Partager le projet' }));
    // {"demo_images": {"1": ["Enter a valid URL."]}}, in French
    expect(await within(dialog).findByText('Lien invalide (https://…).', {}, SLOW)).toBeTruthy();
  });
});

describe('Projects: demo images on the public pages', () => {
  it('shows the number of screenshots on the cards and a viewer on the project page', async () => {
    act(() => {
      store.dispatch(onSetUserToken({ user: { id: 'u1', username: 'fatou' } as User, token: TEST_TOKEN, refresh: 'r' }));
    });
    stubApi();
    renderAppAt('/communities/abidjan-react?tab=projects');
    const list = await screen.findByRole('list', { name: 'Projets' }, SLOW);
    expect(within(list).getByText('Captures :').parentElement?.textContent).toMatch(/3/);
    cleanup();

    renderAppAt('/projects/tontine-plus');
    const gallery = await screen.findByRole('list', { name: 'Captures de Tontine Plus' }, SLOW);
    fireEvent.click(within(gallery).getByRole('button', { name: 'Agrandir la capture 2 sur 3' }));
    const viewer = await screen.findByRole('dialog', {}, SLOW);
    expect(within(viewer).getByRole('img').getAttribute('src')).toBe('https://cdn.example.com/b.png');
    fireEvent.click(within(viewer).getByRole('button', { name: 'Capture suivante' }));
    expect(within(viewer).getByRole('img').getAttribute('src')).toBe('https://cdn.example.com/c.png');
    fireEvent.keyDown(within(viewer).getByRole('img'), { key: 'ArrowRight' });
    // Back to the first one after the last
    expect(within(viewer).getByRole('img').getAttribute('src')).toBe('https://cdn.example.com/a.png');
    expect(within(viewer).getByText('1 / 3')).toBeTruthy();
  });
});
