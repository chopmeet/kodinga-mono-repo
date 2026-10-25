import { useEffect, useState, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hook';
import store from '@/redux/store';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { CommunityPostItem, PostComment } from '@/utils/api/community/community.type';
import type { ChatMessage } from '@/utils/api/messaging/messaging.type';
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
 * Top-level hook (mounted once by App) that connects to the Realtime API when a user is signed
 * in, and disconnects when they sign out. The ticket is asked through the api client (an expired
 * access token is renewed first).
 */
export function useRealtimeSync() {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.user.token);

  useEffect(() => {
    if (!token) {
      realtimeClient.disconnect();
      realtimeClient.setTicketProvider(null);
      realtimeClient.setTokenProvider(null);
      return;
    }
    realtimeClient.setTicketProvider(async () => (await dispatch(CommunityApi.endpoints.createWsTicket.initiate()).unwrap()).ticket ?? null);
    realtimeClient.setTokenProvider(() => token);
    realtimeClient.connect();
  }, [token, dispatch]);

  // Global personal listeners: notifications, conversations, and what was missed while offline
  useEffect(() => {
    if (!token) return;
    const conversations = () => dispatch(CommunityApi.util.invalidateTags(['conversations']));
    const unsubscribers = [
      realtimeClient.on('conversation.message_preview', conversations),
      realtimeClient.on('conversation.created', conversations),
      // The bell (unread count) and the lists of notifications
      realtimeClient.on('notification.created', () => dispatch(CommunityApi.util.invalidateTags(['notifications']))),
      // Back after a network cut: everything that may have changed is read again
      realtimeClient.on('reconnected', () => dispatch(CommunityApi.util.invalidateTags(['notifications', 'conversations', 'messages', 'posts']))),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
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
/** A "typing" signal at most every 2 s while typing (the api accepts 1 per second), "stopped" after 3 s of silence */
const TYPING_THROTTLE = 2000;
const TYPING_IDLE = 3000;

export function useRealtimeConversation(conversationId: string | undefined) {
  const dispatch = useAppDispatch();
  // The api echoes the signal to its sender too: their own is ignored
  const meId = useAppSelector((state) => state.user.user?.id);
  const lastTypingSent = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, { username: string; timestamp: number }>>({});
  const typingTimers = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    if (!conversationId) return;

    realtimeClient.subscribeConversation(conversationId);

    // 1. New message
    const unsubCreated = realtimeClient.on<ChatMessage>('message.created', (message) => {
      if (message?.conversation_id === conversationId) {
        dispatch(
          CommunityApi.util.updateQueryData('getMessages', conversationId, (messages) => {
            const existingIdx = messages.findIndex((m) => m.id === message.id);
            if (existingIdx !== -1) {
              messages[existingIdx] = message;
              return;
            }
            const tempIdx = messages.findIndex(
              (m) => m.id.startsWith('temp-msg-') && m.sender?.id === message.sender?.id && m.content === message.content,
            );
            if (tempIdx !== -1) {
              messages[tempIdx] = message;
              return;
            }
            messages.push(message);
          }),
        );
        dispatch(
          CommunityApi.util.updateQueryData('getConversations', undefined, (conversations) => {
            const conv = conversations.find((c) => c.id === conversationId);
            if (conv) {
              conv.last_message_at = message.created_at;
              conv.last_message = {
                id: message.id,
                sender_username: message.sender?.username ?? '',
                content: message.content,
                created_at: message.created_at,
              };
            }
          }),
        );
      }
    });

    // 2. Updated message
    const unsubUpdated = realtimeClient.on<ChatMessage>('message.updated', (message) => {
      if (message?.conversation_id === conversationId) {
        dispatch(
          CommunityApi.util.updateQueryData('getMessages', conversationId, (messages) => {
            const idx = messages.findIndex((m) => m.id === message.id);
            if (idx !== -1) messages[idx] = message;
          }),
        );
      }
    });

    // 3. Deleted message
    const unsubDeleted = realtimeClient.on<IdEventData>('message.deleted', (data) => {
      if (data?.conversation_id === conversationId && data.message_id) {
        dispatch(
          CommunityApi.util.updateQueryData('getMessages', conversationId, (messages) => {
            const idx = messages.findIndex((m) => m.id === data.message_id);
            if (idx !== -1) {
              messages[idx].is_deleted = true;
              messages[idx].content = '[Ce message a été supprimé]';
            }
          }),
        );
      }
    });

    // 4. Pinned message
    const unsubPinned = realtimeClient.on<{ conversation_id: string; message_id: string; is_pinned: boolean }>('message.pinned', (data) => {
      if (data?.conversation_id === conversationId && data.message_id) {
        dispatch(
          CommunityApi.util.updateQueryData('getMessages', conversationId, (messages) => {
            const m = messages.find((item) => item.id === data.message_id);
            if (m) m.is_pinned = data.is_pinned;
          }),
        );
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
      if (data?.conversation_id === conversationId && data.user && data.user.id !== meId) {
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
  }, [conversationId, dispatch, meId]);

  const stopTyping = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
    if (conversationId && lastTypingSent.current) realtimeClient.sendTyping(conversationId, false);
    lastTypingSent.current = 0;
  };

  // Leaving the conversation ends the signal
  useEffect(() => () => stopTyping(), [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Called at each keystroke: throttled, and stopped after a silence */
  const sendTyping = (isTyping: boolean) => {
    if (!conversationId) return;
    if (!isTyping) return stopTyping();
    const now = Date.now();
    if (now - lastTypingSent.current >= TYPING_THROTTLE) {
      realtimeClient.sendTyping(conversationId, true);
      lastTypingSent.current = now;
    }
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stopTyping, TYPING_IDLE);
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

    // 1. Direct injection of newly created post
    const unsubCreated = realtimeClient.on<CommunityPostItem>('post.created', (newPost) => {
      if (!newPost?.id) {
        dispatch(CommunityApi.util.invalidateTags(['posts']));
        return;
      }
      const cachedArgs = CommunityApi.util.selectCachedArgsForQuery(store.getState() as never, 'getCommunityFeed');
      for (const args of cachedArgs) {
        dispatch(
          CommunityApi.util.updateQueryData('getCommunityFeed', args, (feed) => {
            const existingIdx = feed.results.findIndex((p) => p.id === newPost.id);
            if (existingIdx !== -1) {
              feed.results[existingIdx] = newPost;
              return;
            }
            const tempIdx = feed.results.findIndex(
              (p) => p.id.startsWith('temp-post-') && p.author?.id === newPost.author?.id && p.title === newPost.title,
            );
            if (tempIdx !== -1) {
              feed.results[tempIdx] = newPost;
              return;
            }
            feed.results.unshift(newPost);
            if (feed.pagination) feed.pagination.count += 1;
          }),
        );
      }
    });

    // 2. Direct injection of updated post
    const unsubUpdated = realtimeClient.on<CommunityPostItem>('post.updated', (updatedPost) => {
      if (!updatedPost?.id) return;
      dispatch(CommunityApi.util.updateQueryData('getPost', updatedPost.id, (post) => Object.assign(post, updatedPost)));
      const cachedArgs = CommunityApi.util.selectCachedArgsForQuery(store.getState() as never, 'getCommunityFeed');
      for (const args of cachedArgs) {
        dispatch(
          CommunityApi.util.updateQueryData('getCommunityFeed', args, (feed) => {
            const idx = feed.results.findIndex((p) => p.id === updatedPost.id);
            if (idx !== -1) feed.results[idx] = updatedPost;
          }),
        );
      }
    });

    // 3. Direct removal of deleted post
    const unsubDeleted = realtimeClient.on<{ community_id: string; post_id: string }>('post.deleted', (data) => {
      if (!data?.post_id) return;
      const cachedArgs = CommunityApi.util.selectCachedArgsForQuery(store.getState() as never, 'getCommunityFeed');
      for (const args of cachedArgs) {
        dispatch(
          CommunityApi.util.updateQueryData('getCommunityFeed', args, (feed) => {
            const idx = feed.results.findIndex((p) => p.id === data.post_id);
            if (idx !== -1) {
              feed.results.splice(idx, 1);
              if (feed.pagination) feed.pagination.count = Math.max(0, feed.pagination.count - 1);
            }
          }),
        );
      }
    });

    // 4. Pin toggle
    const unsubPinned = realtimeClient.on<{ post_id: string; is_pinned: boolean }>('post.pinned', (data) => {
      if (!data?.post_id) return;
      dispatch(CommunityApi.util.updateQueryData('getPost', data.post_id, (post) => { post.is_pinned = data.is_pinned; }));
      const cachedArgs = CommunityApi.util.selectCachedArgsForQuery(store.getState() as never, 'getCommunityFeed');
      for (const args of cachedArgs) {
        dispatch(
          CommunityApi.util.updateQueryData('getCommunityFeed', args, (feed) => {
            const p = feed.results.find((item) => item.id === data.post_id);
            if (p) p.is_pinned = data.is_pinned;
          }),
        );
      }
    });

    // 5. Reaction update
    const unsubReaction = realtimeClient.on<{ post_id: string; reactions_count: number }>('post.reaction', (data) => {
      if (!data?.post_id || data.reactions_count === undefined) return;
      dispatch(CommunityApi.util.updateQueryData('getPost', data.post_id, (post) => { post.reactions_count = data.reactions_count; }));
      const cachedArgs = CommunityApi.util.selectCachedArgsForQuery(store.getState() as never, 'getCommunityFeed');
      for (const args of cachedArgs) {
        dispatch(
          CommunityApi.util.updateQueryData('getCommunityFeed', args, (feed) => {
            const p = feed.results.find((item) => item.id === data.post_id);
            if (p) p.reactions_count = data.reactions_count;
          }),
        );
      }
    });

    // 6. Comments count update
    const unsubCommentCount = realtimeClient.on<{ post_id: string; comments_count: number }>('post.comments_count', (data) => {
      if (!data?.post_id || data.comments_count === undefined) return;
      dispatch(CommunityApi.util.updateQueryData('getPost', data.post_id, (post) => { post.comments_count = data.comments_count; }));
      const cachedArgs = CommunityApi.util.selectCachedArgsForQuery(store.getState() as never, 'getCommunityFeed');
      for (const args of cachedArgs) {
        dispatch(
          CommunityApi.util.updateQueryData('getCommunityFeed', args, (feed) => {
            const p = feed.results.find((item) => item.id === data.post_id);
            if (p) p.comments_count = data.comments_count;
          }),
        );
      }
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

    const unsubCommentCreated = realtimeClient.on<PostComment>('comment.created', (newComment) => {
      if (!newComment?.id) {
        dispatch(CommunityApi.util.invalidateTags([{ type: 'posts', id: `${postId}-comments` }]));
        return;
      }
      dispatch(
        CommunityApi.util.updateQueryData('getPostComments', postId, (comments) => {
          if (newComment.parent_id) {
            const parent = comments.find((c) => c.id === newComment.parent_id);
            if (parent) {
              parent.replies = parent.replies ?? [];
              const rIdx = parent.replies.findIndex((r) => r.id === newComment.id);
              if (rIdx !== -1) {
                parent.replies[rIdx] = newComment;
                return;
              }
              const tempRIdx = parent.replies.findIndex(
                (r) => r.id.startsWith('temp-cmt-') && r.author?.id === newComment.author?.id && r.content === newComment.content,
              );
              if (tempRIdx !== -1) {
                parent.replies[tempRIdx] = newComment;
                return;
              }
              parent.replies.unshift(newComment);
              return;
            }
          }
          const idx = comments.findIndex((c) => c.id === newComment.id);
          if (idx !== -1) {
            comments[idx] = newComment;
            return;
          }
          const tempIdx = comments.findIndex(
            (c) => c.id.startsWith('temp-cmt-') && c.author?.id === newComment.author?.id && c.content === newComment.content,
          );
          if (tempIdx !== -1) {
            comments[tempIdx] = newComment;
            return;
          }
          if (comments.length > 0 && comments[0].is_accepted_answer) {
            comments.splice(1, 0, newComment);
          } else {
            comments.unshift(newComment);
          }
        }),
      );
      dispatch(
        CommunityApi.util.updateQueryData('getPost', postId, (post) => {
          post.comments_count = (post.comments_count ?? 0) + 1;
        }),
      );
    });

    const unsubCommentUpdated = realtimeClient.on<PostComment>('comment.updated', (updatedComment) => {
      if (!updatedComment?.id) return;
      dispatch(
        CommunityApi.util.updateQueryData('getPostComments', postId, (comments) => {
          const idx = comments.findIndex((c) => c.id === updatedComment.id);
          if (idx !== -1) {
            comments[idx] = updatedComment;
            return;
          }
          for (const parent of comments) {
            if (parent.replies) {
              const rIdx = parent.replies.findIndex((r) => r.id === updatedComment.id);
              if (rIdx !== -1) {
                parent.replies[rIdx] = updatedComment;
                return;
              }
            }
          }
        }),
      );
    });

    const unsubCommentDeleted = realtimeClient.on<{ post_id: string; comment_id: string }>('comment.deleted', (data) => {
      if (!data?.comment_id) return;
      dispatch(
        CommunityApi.util.updateQueryData('getPostComments', postId, (comments) => {
          const idx = comments.findIndex((c) => c.id === data.comment_id);
          if (idx !== -1) {
            comments.splice(idx, 1);
            return;
          }
          for (const parent of comments) {
            if (parent.replies) {
              const rIdx = parent.replies.findIndex((r) => r.id === data.comment_id);
              if (rIdx !== -1) {
                parent.replies.splice(rIdx, 1);
                return;
              }
            }
          }
        }),
      );
      dispatch(
        CommunityApi.util.updateQueryData('getPost', postId, (post) => {
          post.comments_count = Math.max(0, (post.comments_count ?? 1) - 1);
        }),
      );
    });

    const unsubCommentReaction = realtimeClient.on<{ comment_id: string; reactions_count: number }>('comment.reaction', (data) => {
      if (!data?.comment_id || data.reactions_count === undefined) return;
      dispatch(
        CommunityApi.util.updateQueryData('getPostComments', postId, (comments) => {
          const target = comments.find((c) => c.id === data.comment_id);
          if (target) {
            target.reactions_count = data.reactions_count;
            return;
          }
          for (const parent of comments) {
            const rep = (parent.replies ?? []).find((r) => r.id === data.comment_id);
            if (rep) {
              rep.reactions_count = data.reactions_count;
              return;
            }
          }
        }),
      );
    });

    const unsubAccepted = realtimeClient.on<PostComment>('comment.accepted', (acceptedComment) => {
      if (!acceptedComment?.id) return;
      dispatch(
        CommunityApi.util.updateQueryData('getPostComments', postId, (comments) => {
          comments.forEach((c) => {
            c.is_accepted_answer = c.id === acceptedComment.id;
          });
        }),
      );
      dispatch(
        CommunityApi.util.updateQueryData('getPost', postId, (post) => {
          post.is_resolved = true;
        }),
      );
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
