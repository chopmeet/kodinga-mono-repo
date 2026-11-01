import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { Provider } from 'react-redux';

import store from '@/redux/store';
import { CommunityApi } from '@/utils/api/community/community.api';
import { BannerUploadField } from './banner-upload-field';

vi.setConfig({ testTimeout: 15_000 });

const SLOW = { timeout: 3000 };

/** The form around the field: keeps the url it gives */
function Form({ initial = '' }: { initial?: string }) {
  const [url, setUrl] = useState(initial);
  return (
    <Provider store={store}>
      <BannerUploadField id="cover" label="Image de couverture" value={url} onChange={setUrl} />
      <output aria-label="Valeur">{url}</output>
    </Provider>
  );
}

/** media/upload-url/ and confirm-upload/ through fetch; the file itself through XMLHttpRequest (progress) */
function stubUpload() {
  const calls: { url: string; body: unknown }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const text = await request.text();
    calls.push({ url: request.url, body: text ? JSON.parse(text) : null });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    if (request.url.endsWith('media/upload-url/')) {
      return json({ success: true, data: { asset_id: 'a1', file_key: 'kodinga/banner/b1.png', upload_url: 'https://storage.example.com/upload', fields: {}, max_file_size: 5242880 } }, 201);
    }
    return json({ success: true, data: { id: 'a1', file_url: 'https://utfs.io/f/b1' } });
  });
  // The storage answers once the test has seen the progress
  let finish = () => undefined as void;
  class FakeXhr {
    status = 0;
    responseText = '';
    upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    open() {
      // The method and the url do not matter here
    }
    send() {
      this.upload.onprogress?.({ lengthComputable: true, loaded: 40, total: 100 });
      finish = () => {
        this.status = 200;
        this.responseText = JSON.stringify({ url: 'https://utfs.io/f/b1' });
        this.onload?.();
      };
    }
  }
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
  return { calls, finish: () => act(() => finish()) };
}

const file = (name: string, type: string) => new File(['img'], name, { type });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  act(() => {
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Banner upload field', () => {
  it('refuses a file that is not an image of the accepted formats', async () => {
    const { calls } = stubUpload();
    render(<Form />);
    fireEvent.change(screen.getByLabelText('Image de couverture'), { target: { files: [file('cv.pdf', 'application/pdf')] } });
    expect((await screen.findByRole('alert')).textContent).toMatch(/Format non accepté/);
    expect(calls).toHaveLength(0);
  });

  it('sends the image with its progress, then shows it and gives its url', async () => {
    const upload = stubUpload();
    render(<Form />);
    fireEvent.change(screen.getByLabelText('Image de couverture'), { target: { files: [file('cover.png', 'image/png')] } });
    const bar = await screen.findByRole('progressbar', { name: 'Envoi : Image de couverture' }, SLOW);
    await waitFor(() => expect(bar.getAttribute('aria-valuenow')).toBe('40'), SLOW);
    expect(screen.getByText(/40 %/)).toBeTruthy();

    upload.finish();
    expect(await screen.findByRole('img', { name: 'Aperçu : Image de couverture' }, SLOW)).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Valeur' }).textContent).toBe('https://utfs.io/f/b1');
    expect(upload.calls.find((c) => c.url.endsWith('media/upload-url/'))?.body).toMatchObject({ purpose: 'banner', mime_type: 'image/png' });
  });

  it('removes the image, or takes a link instead', async () => {
    stubUpload();
    render(<Form initial="https://cdn.example.com/old.png" />);
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer : Image de couverture' }));
    expect(screen.getByRole('status', { name: 'Valeur' }).textContent).toBe('');

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Image de couverture : mode' })).getByRole('radio', { name: /Lien/ }));
    fireEvent.change(screen.getByLabelText(/^Lien : image de couverture/), { target: { value: 'https://cdn.example.com/new.png' } });
    expect(screen.getByRole('status', { name: 'Valeur' }).textContent).toBe('https://cdn.example.com/new.png');
  });
});
