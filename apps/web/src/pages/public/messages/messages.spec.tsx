import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { ChatMessage, Conversation } from '@/utils/api/messaging/messaging.type';
import type { User } from '@/utils/api/user/user.type';

vi.setConfig({ testTimeout: 15_000 });

const person = (id: string, first_name: string, last_name: string) => ({ id, username: first_name.toLowerCase(), first_name, last_name, avatar_url: '' });
const ME = person('u-me', 'Fatou', 'Sow');
const KOFI = person('u-kofi', 'Kofi', 'Mensah');
const AWA = person('u-awa', 'Awa', 'Ndiaye');

const message = (id: string, sender: typeof ME, content: string, minutesAgo: number): ChatMessage => ({
  id,
  conversation_id: 'conv-kofi',
  sender,
  content,
  is_edited: false,
  is_deleted: false,
  is_pinned: false,
  deleted_at: null,
  created_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  updated_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
});

const conversation = (id: string, other: typeof ME, last: string, unread: number): Conversation => ({
  id,
  conversation_type: 'direct',
  title: null,
  community_id: null,
  last_message_at: new Date().toISOString(),
  participants: [ME, other].map((user, i) => ({ id: `${id}-p${i}`, user, role: 'member', joined_at: '', last_read_at: '' })),
  last_message: { id: 'last', sender_username: other.username, content: last, created_at: new Date().toISOString() },
  unread_count: unread,
  created_at: new Date().toISOString(),
});

type Call = { method: string; url: URL; body: Record<string, unknown> | null };

/** Raw messaging api (no envelope): two conversations, messages of the one with Kofi */
function stubMessagingApi() {
  let unread = 2;
  let messages = [message('m1', KOFI, 'Salut ! Tu viens au meetup samedi ?', 30), message('m2', ME, 'Oui, avec plaisir.', 20), message('m3', KOFI, 'Top, à samedi.', 5)];
  const calls: Call[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ method: request.method, url, body });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    const path = url.pathname;

    if (path.endsWith('/conversations/')) {
      if (request.method === 'POST') return json(conversation('conv-awa', AWA, '', 0), 201);
      return json([conversation('conv-kofi', KOFI, 'Top, à samedi.', unread), conversation('conv-awa', AWA, 'Merci pour ta réponse !', 1)]);
    }
    if (path.endsWith('/conversations/conv-kofi/read/')) {
      unread = 0;
      return json({ status: 'ok' });
    }
    if (path.endsWith('/conversations/conv-kofi/messages/')) {
      if (request.method === 'POST') {
        const sent = message(`m${messages.length + 1}`, ME, String(body?.content), 0);
        messages = [...messages, sent];
        return json(sent, 201);
      }
      return json(messages);
    }
    if (path.endsWith('/conversations/conv-awa/messages/')) return json([]);
    const messageId = path.match(/\/messages\/([^/]+)\/$/)?.[1];
    if (messageId && request.method === 'PATCH') {
      messages = messages.map((m) => (m.id === messageId ? { ...m, content: String(body?.content), is_edited: true } : m));
      return json(messages.find((m) => m.id === messageId));
    }
    if (messageId && request.method === 'DELETE') {
      messages = messages.map((m) => (m.id === messageId ? { ...m, is_deleted: true, content: '[Ce message a été supprimé]' } : m));
      return json({ status: 'deleted' });
    }
    if (path.endsWith('/profiles/awa/')) {
      return json({ success: true, data: { id: 'pr-awa', user: { ...AWA, full_name: 'Awa Ndiaye', date_joined: '2026-01-01T00:00:00Z' }, display_name: 'Awa Ndiaye', headline: '', bio: '', avatar_url: '', banner_url: '', location: '' } });
    }
    if (path.endsWith('/users/me/')) return json({ success: true, data: ME });
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
  });
  return calls;
}

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '');
const signIn = () =>
  act(() => {
    store.dispatch(onSetUserToken({ user: ME as unknown as User, token: `${b64({ alg: 'HS256' })}.${b64({ exp: 4102444800 })}.sig`, refresh: 'r' }));
  });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(onLogout());
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Messages', () => {
  it('sends a visitor to the login first', async () => {
    stubMessagingApi();
    const { where } = renderAppAt('/messages');
    await waitFor(() => expect(where()).toBe(`/auth/login?next=${encodeURIComponent('/messages')}`), SLOW);
  });

  it('shows the unread count in the header and lists the conversations', async () => {
    signIn();
    stubMessagingApi();
    renderAppAt('/messages');
    // 2 + 1 unread (the header follows the language of the app: "non lus" / "unread")
    expect(await screen.findByRole('link', { name: /^Messages \(3 / }, SLOW)).toBeTruthy();
    const list = await screen.findByRole('list', { name: 'Conversations' }, SLOW);
    expect(within(list).getByText('Kofi Mensah')).toBeTruthy();
    expect(within(list).getByLabelText('2 non lus')).toBeTruthy();
  });

  it('opens a conversation, marks it read, sends with Enter, edits and deletes a message', async () => {
    signIn();
    const calls = stubMessagingApi();
    renderAppAt('/messages/conv-kofi');
    const thread = await screen.findByRole('list', { name: 'Messages' }, SLOW);
    expect(within(thread).getByText('Salut ! Tu viens au meetup samedi ?')).toBeTruthy();
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.pathname.endsWith('/conv-kofi/read/'))).toBe(true), SLOW);

    const input = screen.getByLabelText('Votre message');
    fireEvent.change(input, { target: { value: 'Je ramène les croissants 🥐' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.url.pathname.endsWith('/conv-kofi/messages/'))?.body).toEqual({ content: 'Je ramène les croissants 🥐' }), SLOW);
    expect(await within(screen.getByRole('list', { name: 'Messages' })).findByText('Je ramène les croissants 🥐', {}, SLOW)).toBeTruthy();

    // Own message: edit
    const mine = within(screen.getByRole('list', { name: 'Messages' })).getByText('Oui, avec plaisir.').closest('li') as HTMLElement;
    const trigger = within(mine).getByRole('button', { name: 'Actions du message' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(within(await screen.findByRole('menu', {}, SLOW)).getByRole('menuitem', { name: /Modifier/ }));
    fireEvent.change(within(mine).getByLabelText('Modifier le message'), { target: { value: 'Oui, avec grand plaisir.' } });
    fireEvent.click(within(mine).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH' && c.url.pathname.endsWith('/messages/m2/'))?.body).toEqual({ content: 'Oui, avec grand plaisir.' }), SLOW);
    expect(await within(screen.getByRole('list', { name: 'Messages' })).findByText(/modifié/, {}, SLOW)).toBeTruthy();

    // Own message: delete (it keeps its place, marked deleted)
    const sent = within(screen.getByRole('list', { name: 'Messages' })).getByText('Je ramène les croissants 🥐').closest('li') as HTMLElement;
    const sentTrigger = within(sent).getByRole('button', { name: 'Actions du message' });
    sentTrigger.focus();
    fireEvent.keyDown(sentTrigger, { key: 'Enter' });
    fireEvent.click(within(await screen.findByRole('menu', {}, SLOW)).getByRole('menuitem', { name: /Supprimer/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.url.pathname.endsWith('/messages/m4/'))).toBe(true), SLOW);
    expect(await within(screen.getByRole('list', { name: 'Messages' })).findByText('Ce message a été supprimé', {}, SLOW)).toBeTruthy();

    // Others' messages have no actions
    const kofis = within(screen.getByRole('list', { name: 'Messages' })).getByText('Top, à samedi.').closest('li') as HTMLElement;
    expect(within(kofis).queryByRole('button', { name: 'Actions du message' })).toBeNull();
  });

  it('starts a conversation from a public profile', async () => {
    signIn();
    const calls = stubMessagingApi();
    const { where } = renderAppAt('/profiles/awa');
    fireEvent.click(await screen.findByRole('button', { name: /Envoyer un message/ }, SLOW));
    await waitFor(() => expect(where()).toBe('/messages/conv-awa'), SLOW);
    expect(calls.find((c) => c.method === 'POST' && c.url.pathname.endsWith('/conversations/'))?.body).toEqual({ conversation_type: 'direct', recipient_id: 'u-awa' });
    expect(await screen.findByText('Dites bonjour à Awa Ndiaye 👋', {}, SLOW)).toBeTruthy();
  });
});
