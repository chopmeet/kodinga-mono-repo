import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { PostComment } from '@/utils/api/community/community.type';
import type { User } from '@/utils/api/user/user.type';

vi.setConfig({ testTimeout: 15_000 });

const URL_PATH = '/communities/abidjan-react/posts/q1';
const person = (id: string, first_name: string, last_name: string) => ({ id, username: first_name.toLowerCase(), first_name, last_name, email: `${id}@x.com` });
const AWA = person('u-awa', 'Awa', 'Ndiaye');
const KOFI = person('u-kofi', 'Kofi', 'Mensah');
const YAO = person('u-yao', 'Yao', 'Kouassi');

const comment = (id: string, author: ReturnType<typeof person>, content: string, extra: Partial<PostComment> = {}): PostComment =>
  ({ id, post_id: 'q1', parent_id: null, author, content, is_accepted_answer: false, reactions_count: 1, user_reactions: [], replies: [], created_at: '2026-10-17T10:00:00Z', updated_at: '2026-10-17T10:00:00Z', ...extra }) as PostComment;

type Options = { privacy?: 'public' | 'private'; member?: boolean };
type Call = { method: string; url: URL; body: Record<string, unknown> | null };

/** A question of Awa in abidjan-react, with two answers; comment / accept / delete like the api */
function stubPostApi({ privacy = 'public', member = true }: Options = {}) {
  let resolved = false;
  let notified = false;
  let comments = [comment('c1', KOFI, 'Utilise `useMemo` pour éviter le recalcul.'), comment('c2', YAO, 'Regarde du côté de React Compiler.')];
  const calls: Call[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ method: request.method, url, body });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    const path = url.pathname;

    if (path.endsWith('/communities/abidjan-react/')) {
      return json({
        success: true,
        data: {
          id: 'c-ar', name: 'Abidjan React', slug: 'abidjan-react', tagline: '', avatar_url: '', banner_url: '', brand_color: '#1D4ED8',
          privacy_type: privacy, pricing_type: 'free', members_count: 40, posts_count: 3, courses_count: 0, events_count: 0,
          owner: AWA, category: null, user_membership: member ? { is_member: true, role: 'member', status: 'active' } : { is_member: false, role: null, status: null },
        },
      });
    }
    const acceptId = path.match(/comments\/([^/]+)\/accept\/$/)?.[1];
    if (acceptId) {
      comments = comments.map((c) => ({ ...c, is_accepted_answer: c.id === acceptId })).sort((a, b) => Number(b.is_accepted_answer) - Number(a.is_accepted_answer));
      resolved = true;
      return json({ success: true, data: comments.find((c) => c.id === acceptId) });
    }
    const reactId = path.match(/comments\/([^/]+)\/react\/$/)?.[1];
    if (reactId) return json({ success: true, data: { reacted: true } });
    const deleteId = path.match(/comments\/([^/]+)\/$/)?.[1];
    if (deleteId && request.method === 'DELETE') {
      comments = comments.filter((c) => c.id !== deleteId);
      return json({ success: true });
    }
    if (path.endsWith('/posts/q1/help-assistance/ping-mentors/')) {
      notified = true;
      return json({ success: true, data: { notified_count: (body?.mentor_ids as string[]).length } });
    }
    if (path.endsWith('/posts/q1/help-assistance/')) {
      return json({ success: true, data: {
        post_id: 'q1', matching_skills: ['React'], ai_comment_draft: 'Pouvez-vous partager le composant et la version de React ?', status: notified ? 'notified' : 'pending',
        suggested_mentors: [
          { user_id: 'u-kofi', username: 'kofi', first_name: 'Kofi', last_name: 'Mensah', avatar_url: null, matching_skills: ['React'], reputation_score: 120 },
          { user_id: 'u-yao', username: 'yao', first_name: 'Yao', last_name: 'Kouassi', avatar_url: null, matching_skills: ['React', 'TypeScript'], reputation_score: 80 },
        ],
      } });
    }
    if (path.endsWith('/posts/q1/comments/')) {
      if (request.method === 'POST') {
        const created = comment(`c${comments.length + 10}`, AWA, String(body?.content), { parent_id: body?.parent_id ?? null });
        comments = body?.parent_id
          ? comments.map((c) => (c.id === body.parent_id ? { ...c, replies: [...c.replies, created] } : c))
          : [...comments, created];
        return json({ success: true, data: created }, 201);
      }
      return json({ success: true, data: comments });
    }
    if (path.endsWith('/posts/q1/')) {
      return json({
        success: true,
        data: {
          id: 'q1', community_id: 'c-ar', author: AWA, title: 'Comment éviter les re-rendus inutiles ?', content: 'Mon composant se re-rend à chaque frappe.',
          post_type: 'question', is_pinned: false, is_locked: false, is_resolved: resolved, views_count: 10, reactions_count: 4, comments_count: comments.length,
          user_reactions: [], created_at: '2026-10-17T09:00:00Z',
        },
      });
    }
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
  });
  return calls;
}

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '');
const signInAs = (user: ReturnType<typeof person>) =>
  act(() => {
    store.dispatch(onSetUserToken({ user: user as unknown as User, token: `${b64({ alg: 'HS256' })}.${b64({ exp: 4102444800 })}.sig`, refresh: 'r' }));
  });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(onLogout());
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Post details: answers of a question', () => {
  it('lets the author of the question accept an answer: it goes first and the question is resolved', async () => {
    signInAs(AWA);
    const calls = stubPostApi();
    renderAppAt(URL_PATH);
    expect(await screen.findByRole('heading', { level: 1, name: 'Comment éviter les re-rendus inutiles ?' }, SLOW)).toBeTruthy();
    const answers = await screen.findByRole('list', { name: 'Réponses' }, SLOW);
    expect(within(answers).getAllByRole('button', { name: /Accepter cette réponse/ })).toHaveLength(2);

    const yao = within(answers).getByRole('article', { name: 'Commentaire de Yao Kouassi' });
    fireEvent.click(within(yao).getByRole('button', { name: /Accepter cette réponse/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.pathname.endsWith('/comments/c2/accept/'))).toBe(true), SLOW);

    // The accepted answer comes first, the question is resolved
    const first = await screen.findByRole('article', { name: 'Réponse acceptée de Yao Kouassi' }, SLOW);
    expect(within(screen.getByRole('list', { name: 'Réponses' })).getAllByRole('article')[0]).toBe(first);
    expect(await screen.findByText('Question résolue', {}, SLOW)).toBeTruthy();
    expect(within(first).queryByRole('button', { name: /Accepter cette réponse/ })).toBeNull();
  });

  it('lets a member answer and reply, without accepting anything', async () => {
    signInAs(KOFI);
    const calls = stubPostApi();
    renderAppAt(URL_PATH);
    const answers = await screen.findByRole('list', { name: 'Réponses' }, SLOW);
    expect(within(answers).queryByRole('button', { name: /Accepter cette réponse/ })).toBeNull();

    fireEvent.change(screen.getByLabelText('Votre réponse'), { target: { value: 'Tu peux aussi mémoïser le callback.' } });
    fireEvent.click(screen.getByRole('button', { name: /Publier/ }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.url.pathname.endsWith('/posts/q1/comments/'))?.body).toEqual({ content: 'Tu peux aussi mémoïser le callback.' }), SLOW);

    const yao = within(answers).getByRole('article', { name: 'Commentaire de Yao Kouassi' });
    fireEvent.click(within(yao).getByRole('button', { name: 'Répondre' }));
    fireEvent.change(await within(yao).findByLabelText('Répondre à Yao Kouassi', {}, SLOW), { target: { value: 'Bonne piste !' } });
    fireEvent.click(within(yao).getByRole('button', { name: /Envoyer/ }));
    await waitFor(
      () => expect(calls.filter((c) => c.method === 'POST' && c.url.pathname.endsWith('/posts/q1/comments/')).at(-1)?.body).toEqual({ content: 'Bonne piste !', parent_id: 'c2' }),
      SLOW,
    );
  });

  it('likes an answer and deletes one of ones own', async () => {
    signInAs(KOFI);
    const calls = stubPostApi();
    renderAppAt(URL_PATH);
    const kofi = await screen.findByRole('article', { name: 'Commentaire de Kofi Mensah' }, SLOW);
    // Only Kofi's own answer can be deleted by him
    expect(within(screen.getByRole('article', { name: 'Commentaire de Yao Kouassi' })).queryByRole('button', { name: /Supprimer/ })).toBeNull();

    fireEvent.click(within(kofi).getByRole('button', { name: /J’aime \(Kofi Mensah\)/ }));
    await waitFor(() => expect(calls.find((c) => c.url.pathname.endsWith('/comments/c1/react/'))?.body).toEqual({ reaction_type: 'like' }), SLOW);

    fireEvent.click(within(kofi).getByRole('button', { name: /Supprimer/ }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.click(within(dialog).getByRole('button', { name: /Supprimer/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.url.pathname.endsWith('/comments/c1/'))).toBe(true), SLOW);
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Commentaire de Kofi Mensah' })).toBeNull(), SLOW);
  });

  it('keeps a post of a private community for its members', async () => {
    signInAs(KOFI);
    const calls = stubPostApi({ privacy: 'private', member: false });
    renderAppAt(URL_PATH);
    expect(await screen.findByRole('heading', { name: 'Réservé aux membres' }, SLOW)).toBeTruthy();
    expect(calls.some((c) => c.url.pathname.endsWith('/posts/q1/'))).toBe(false);
  });

  it('helps the author of an unsolved question: what it lacks, and mentors to ask', async () => {
    signInAs(AWA);
    const calls = stubPostApi();
    renderAppAt(URL_PATH);
    const help = await screen.findByRole('region', { name: 'Obtenir de l’aide plus vite' }, SLOW);
    expect(within(help).getByText('Pouvez-vous partager le composant et la version de React ?')).toBeTruthy();
    const mentors = within(help).getByRole('list', { name: 'Mentors suggérés' });
    expect(within(mentors).getByText('React · TypeScript')).toBeTruthy();
    // All asked by default: Yao left out
    fireEvent.click(within(mentors).getByRole('checkbox', { name: /Yao Kouassi/ }));
    fireEvent.change(within(help).getByLabelText(/Message/), { target: { value: 'Je bloque depuis hier' } });
    fireEvent.click(within(help).getByRole('button', { name: 'Prévenir le mentor' }));
    await waitFor(() => expect(calls.find((c) => c.url.pathname.endsWith('/help-assistance/ping-mentors/'))?.body).toEqual({ mentor_ids: ['u-kofi'], custom_message: 'Je bloque depuis hier' }), SLOW);
    expect(await within(help).findByText('Mentors prévenus', {}, SLOW)).toBeTruthy();
  });

  it('asks nothing of the AI for another member', async () => {
    signInAs(KOFI);
    const calls = stubPostApi();
    renderAppAt(URL_PATH);
    await screen.findByRole('list', { name: 'Réponses' }, SLOW);
    expect(screen.queryByRole('region', { name: 'Obtenir de l’aide plus vite' })).toBeNull();
    expect(calls.some((c) => c.url.pathname.includes('help-assistance'))).toBe(false);
  });
});
