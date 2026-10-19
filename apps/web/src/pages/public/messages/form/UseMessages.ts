import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { customToast } from '@kodinga-mono-repo/ui';
import {
  useDeleteMessageMutation,
  useEditMessageMutation,
  useGetConversationsQuery,
  useGetMessagesQuery,
  useMarkConversationReadMutation,
  useSendMessageMutation,
  useStartConversationMutation,
} from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import type { ChatUser, Conversation } from '@/utils/api/messaging/messaging.type';
import { useAppSelector } from '@/redux/hook';
import { useUser } from '@/utils/Utils';

import {
  useRealtime,
  useRealtimeConversation,
} from '@/utils/realtime/use-realtime';

/** Fallback polling if WebSocket is temporarily disconnected */
export const MESSAGES_POLLING = 15_000;
export const CONVERSATIONS_POLLING = 30_000;

export const fullName = (u: Pick<ChatUser, 'first_name' | 'last_name' | 'username'>) => [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username;

/** The other person of a direct conversation (the user alone: a group) */
export function otherPerson(conversation: Conversation, meId: string | undefined) {
  return conversation.participants.find((p) => p.user.id !== meId)?.user ?? conversation.participants[0]?.user;
}

/** Name shown for a conversation: its title (group) or the other person */
export function conversationName(conversation: Conversation, meId: string | undefined) {
  if (conversation.conversation_type === 'group') return conversation.title || 'Groupe';
  const other = otherPerson(conversation, meId);
  return other ? fullName(other) : 'Conversation';
}

/** Total of the unread messages (badge of the header) */
export function useUnreadMessages() {
  const signedIn = !!useAppSelector((s) => s.user.token);
  const { connected } = useRealtime();
  const { data = [] } = useGetConversationsQuery(undefined, {
    skip: !signedIn,
    pollingInterval: connected ? 0 : CONVERSATIONS_POLLING,
  });
  return data.reduce((n, c) => n + c.unread_count, 0);
}

/** "Envoyer un message" from a profile or a member card: opens (or creates) the direct conversation */
export function useStartConversation() {
  const navigate = useNavigate();
  const [start, { isLoading }] = useStartConversationMutation();
  const open = async (userId: string) => {
    try {
      const conversation = await start(userId).unwrap();
      navigate(`/messages/${conversation.id}`);
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };
  return { open, isLoading };
}

/**
 * /messages and /messages/:conversationId — the conversations of the signed-in user
 * (GET conversations/) and the open one (GET .../messages/, marked read when new messages arrive).
 * Real-time updates via WebSockets with fallback polling if disconnected.
 */
function UseMessages() {
  const { conversationId = '' } = useParams();
  const me = useUser();
  const { connected } = useRealtime();
  const { typingUsers, sendTyping } = useRealtimeConversation(conversationId);

  const conversations = useGetConversationsQuery(undefined, {
    pollingInterval: connected ? 0 : CONVERSATIONS_POLLING,
  });
  const messages = useGetMessagesQuery(conversationId, {
    skip: !conversationId,
    pollingInterval: connected ? 0 : MESSAGES_POLLING,
  });
  const [send, { isLoading: isSending }] = useSendMessageMutation();
  const [edit] = useEditMessageMutation();
  const [remove] = useDeleteMessageMutation();
  const [markRead] = useMarkConversationReadMutation();

  const current = conversations.data?.find((c) => c.id === conversationId);
  const unread = current?.unread_count ?? 0;
  const count = messages.data?.length ?? 0;

  // Opening a conversation, or new messages in it, marks it read
  useEffect(() => {
    if (conversationId && unread > 0) markRead(conversationId);
  }, [conversationId, unread, count, markRead]);

  const run = async (action: Promise<unknown>) => {
    try {
      await action;
      return true;
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
      return false;
    }
  };

  return {
    meId: me?.id,
    conversationId,
    conversations: conversations.data ?? [],
    isConversationsLoading: conversations.isLoading,
    current,
    messages: messages.data ?? [],
    isMessagesLoading: messages.isLoading,
    /** Unknown id, or a conversation the user is not part of */
    notFound: !!conversationId && conversations.isSuccess && !current,
    isSending,
    isRealtimeConnected: connected,
    typingUsers,
    sendTyping,
    send: (content: string) => run(send({ conversationId, content }).unwrap()),
    edit: (messageId: string, content: string) => run(edit({ conversationId, messageId, content }).unwrap()),
    remove: (messageId: string) => run(remove({ conversationId, messageId }).unwrap()),
  };
}

export type MessagesPage = ReturnType<typeof UseMessages>;

export default UseMessages;
