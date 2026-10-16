import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { User } from '@/utils/api/user/user.type';
import { ApiBaseUrl } from '@/utils/http';

vi.setConfig({ testTimeout: 15_000 });

const settings = {
  ai_translation_enabled: false,
  default_community_language: 'fr',
  supported_languages: ['fr'],
  sentiment_analytics_enabled: true,
  non_mandatory_moderation: { spam: true },
  moderation_strictness: 'standard',
};

type Call = { method: string; url: string; auth: string | null; body: unknown };

/** Records every request (method, url, Authorization header) and answers like the api */
function stubAiApi() {
  const calls: Call[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const text = request.method === 'GET' ? '' : await request.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ method: request.method, url: request.url, auth: request.headers.get('Authorization'), body });
    const path = new URL(request.url).pathname;
    const data = path.endsWith('/ai-settings/')
      ? { ...settings, ...(body ?? {}) }
      : path.endsWith('/analyze-community/')
        ? { community_name: 'Dakar DevOps', overview_assessment: 'Communauté active.', actionable_recommendations: [], metrics_summary: {} }
        : [];
    return new Response(JSON.stringify({ success: true, data, results: [] }), { headers: { 'Content-Type': 'application/json' } });
  });
  return calls;
}

beforeEach(() => {
  act(() => {
    store.dispatch(onSetUserToken({ user: { id: 'u1', first_name: 'Awa' } as User, token: 'access-token', refresh: 'r' }));
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(onLogout());
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Community space: AI settings', () => {
  it('reads and saves the AI settings through the api client (token + api url)', async () => {
    const calls = stubAiApi();
    renderAppAt('/c/dakar-devops/settings/ai');
    fireEvent.click(await screen.findByRole('button', { name: 'Enregistrer les paramètres IA' }, SLOW));

    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true), SLOW);
    const get = calls.find((c) => c.method === 'GET' && c.url.endsWith('/communities/dakar-devops/ai-settings/'));
    const patch = calls.find((c) => c.method === 'PATCH');
    for (const call of [get, patch]) {
      expect(call?.url.startsWith(ApiBaseUrl)).toBe(true);
      expect(call?.auth).toBe('Bearer access-token');
    }
    expect(patch?.body).toMatchObject({ ai_translation_enabled: false, moderation_strictness: 'standard' });
  });

  it('runs the community diagnosis with the token', async () => {
    const calls = stubAiApi();
    renderAppAt('/c/dakar-devops/settings/ai');
    fireEvent.click(await screen.findByRole('button', { name: 'Lancer le diagnostic IA' }, SLOW));
    expect(await screen.findByText('Communauté active.', {}, SLOW)).toBeTruthy();
    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/ai-assistant/analyze-community/'));
    expect(post?.auth).toBe('Bearer access-token');
    expect(post?.body).toEqual({ community: 'dakar-devops', language: 'fr' });
  });
});
