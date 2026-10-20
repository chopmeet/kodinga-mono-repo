import { useEffect, useState, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hook';
import { CommunityApi } from '@/utils/api/community/community.api';
import { realtimeClient } from './realtime-client';

/**
 * Hook to monitor WebSocket connection status.
 */
export function useRealtime() {
  const [connected, setConnected] = useState(realtimeClient.isConnected);

  useEffect(() => {
    const unsubscribe = realtimeClient.onStatusChange(setConnected);
    return () => {
      unsubscribe();
    };
  }, []);

  return {
    client: realtimeClient,
    connected,
  };
}

/**
 * Top-level hook that connects to the Realtime API when a user is signed in,
 * and disconnects when they sign out.
 */
export function useRealtimeSync() {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.user.token);

  useEffect(() => {
    if (token) {
      realtimeClient.connect();
    } else {
      realtimeClient.disconnect();
    }
  }, [token]);

  // Global personal listeners (notifications & direct message previews)
  useEffect(() => {
    if (!token) return;

    // When an unread update or new message preview arrives for the user
    const unsubPreview = realtimeClient.on('conversation.message_preview', () => {
      dispatch(CommunityApi.util.invalidateTags(['conversations']));
    });

    // When a new conversation is created
    const unsubConv = realtimeClient.on('conversation.created', () => {
      dispatch(CommunityApi.util.invalidateTags(['conversations']));
    });

    // When an in-app notification is pushed
    const unsubNotif = realtimeClient.on('notification.created', () => {
      // Invalidate header notifications count
      dispatch(CommunityApi.util.invalidateTags(['conversations']));
    });

    return () => {
      unsubPreview();
      unsubConv();
      unsubNotif();
    };
  }, [token, dispatch]);
}

interface MessageEventData {
  id: string;
  conversation_id: string;
  content?: string;
}

interface IdEventData {
  conversation_id: string;
  message_id?: string;
}

interface TypingEventData {
  conversation_id: string;
  user?: { id: string; username: string };
}

/**
 * Subscribes to a conversation topic, manages incoming real-time messages,
 * typing indicators, and updates RTK Query cache.
 */
export function useRealtimeConversation(conversationId: string | undefined) {
  const dispatch = useAppDispatch();
  const [typingUsers, setTypingUsers] = useState<Record<string, { username: string; timestamp: number }>>({});
  const typingTimers = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    if (!conversationId) return;

    realtimeClient.subscribeConversation(conversationId);

    // 1. New message
    const unsubCreated = realtimeClient.on<MessageEventData>('message.created', (message) => {
      if (message?.conversation_id === conversationId) {
        // Instantly invalidate messages and conversations query tags
        dispatch(CommunityApi.util.invalidateTags([
          { type: 'messages', id: conversationId },
          'conversations',
        ]));
      }
    });

    // 2. Updated message
    const unsubUpdated = realtimeClient.on<MessageEventData>('message.updated', (message) => {
      if (message?.conversation_id === conversationId) {
        dispatch(CommunityApi.util.invalidateTags([
          { type: 'messages', id: conversationId },
        ]));
      }
    });

    // 3. Deleted message
    const unsubDeleted = realtimeClient.on<IdEventData>('message.deleted', (data) => {
      if (data?.conversation_id === conversationId) {
        dispatch(CommunityApi.util.invalidateTags([
          { type: 'messages', id: conversationId },
          'conversations',
        ]));
      }
    });

    // 4. Pinned message
    const unsubPinned = realtimeClient.on<IdEventData>('message.pinned', (data) => {
      if (data?.conversation_id === conversationId) {
        dispatch(CommunityApi.util.invalidateTags([
          { type: 'messages', id: conversationId },
        ]));
      }
    });

    // 5. Read receipt
    const unsubRead = realtimeClient.on<IdEventData>('message.read', (data) => {
      if (data?.conversation_id === conversationId) {
        dispatch(CommunityApi.util.invalidateTags(['conversations']));
      }
    });

    // 6. Typing started
    const unsubTypingStarted = realtimeClient.on<TypingEventData>('typing.started', (data) => {
      if (data?.conversation_id === conversationId && data.user) {
        const userId = data.user.id;
        const username = data.user.username;

        setTypingUsers((prev) => ({
          ...prev,
          [userId]: { username, timestamp: Date.now() },
        }));

        // Auto-clear typing after 4 seconds of silence
        if (typingTimers.current[userId]) {
          clearTimeout(typingTimers.current[userId]);
        }
        typingTimers.current[userId] = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = { ...prev };
            delete next[userId];
            return next;
          });
        }, 4000);
      }
    });

    // 7. Typing stopped
    const unsubTypingStopped = realtimeClient.on<TypingEventData>('typing.stopped', (data) => {
      if (data?.conversation_id === conversationId && data.user) {
        const userId = data.user.id;
        if (typingTimers.current[userId]) {
          clearTimeout(typingTimers.current[userId]);
          delete typingTimers.current[userId];
        }
        setTypingUsers((prev) => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
      }
    });

    return () => {
      realtimeClient.unsubscribeConversation(conversationId);
      unsubCreated();
      unsubUpdated();
      unsubDeleted();
      unsubPinned();
      unsubRead();
      unsubTypingStarted();
      unsubTypingStopped();
      Object.values(typingTimers.current).forEach(clearTimeout);
      typingTimers.current = {};
    };
  }, [conversationId, dispatch]);

  const sendTyping = (isTyping: boolean) => {
    if (conversationId) {
      realtimeClient.sendTyping(conversationId, isTyping);
    }
  };

  const activeTypingList = Object.values(typingUsers).map((u) => u.username);

  return {
    typingUsers: activeTypingList,
    sendTyping,
  };
}

/**
 * Subscribes to community feed events in real-time.
 */
export function useRealtimeCommunityFeed(communityId: string | undefined) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!communityId) return;

    realtimeClient.subscribeCommunity(communityId);

    const unsubCreated = realtimeClient.on('post.created', () => {
      dispatch(CommunityApi.util.invalidateTags(['posts']));
    });

    const unsubUpdated = realtimeClient.on('post.updated', () => {
      dispatch(CommunityApi.util.invalidateTags(['posts']));
    });

    const unsubDeleted = realtimeClient.on('post.deleted', () => {
      dispatch(CommunityApi.util.invalidateTags(['posts']));
    });

    const unsubPinned = realtimeClient.on('post.pinned', () => {
      dispatch(CommunityApi.util.invalidateTags(['posts']));
    });

    const unsubReaction = realtimeClient.on('post.reaction', () => {
      dispatch(CommunityApi.util.invalidateTags(['posts']));
    });

    const unsubCommentCount = realtimeClient.on('post.comments_count', () => {
      dispatch(CommunityApi.util.invalidateTags(['posts']));
    });

    return () => {
      realtimeClient.unsubscribeCommunity(communityId);
      unsubCreated();
      unsubUpdated();
      unsubDeleted();
      unsubPinned();
      unsubReaction();
      unsubCommentCount();
    };
  }, [communityId, dispatch]);
}

/**
 * Subscribes to a post thread comments in real-time.
 */
export function useRealtimePostComments(postId: string | undefined) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!postId) return;

    realtimeClient.subscribePost(postId);

    const unsubCommentCreated = realtimeClient.on('comment.created', () => {
      dispatch(CommunityApi.util.invalidateTags([
        { type: 'posts', id: `${postId}-comments` },
        { type: 'posts', id: postId },
      ]));
    });

    const unsubCommentUpdated = realtimeClient.on('comment.updated', () => {
      dispatch(CommunityApi.util.invalidateTags([
        { type: 'posts', id: `${postId}-comments` },
      ]));
    });

    const unsubCommentDeleted = realtimeClient.on('comment.deleted', () => {
      dispatch(CommunityApi.util.invalidateTags([
        { type: 'posts', id: `${postId}-comments` },
        { type: 'posts', id: postId },
      ]));
    });

    const unsubCommentReaction = realtimeClient.on('comment.reaction', () => {
      dispatch(CommunityApi.util.invalidateTags([
        { type: 'posts', id: `${postId}-comments` },
      ]));
    });

    const unsubAccepted = realtimeClient.on('comment.accepted', () => {
      dispatch(CommunityApi.util.invalidateTags([
        { type: 'posts', id: `${postId}-comments` },
        { type: 'posts', id: postId },
        'posts',
      ]));
    });

    return () => {
      realtimeClient.unsubscribePost(postId);
      unsubCommentCreated();
      unsubCommentUpdated();
      unsubCommentDeleted();
      unsubCommentReaction();
      unsubAccepted();
    };
  }, [postId, dispatch]);
}
