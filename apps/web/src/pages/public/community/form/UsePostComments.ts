import { customToast } from '@kodinga/ui';
import {
  useAcceptAnswerMutation,
  useAddPostCommentMutation,
  useDeletePostCommentMutation,
  useGetPostCommentsQuery,
  useToggleCommentLikeMutation,
} from '@/utils/api/community/community.api';
import type { CommunityPostItem, CommunityRole, PostComment } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';
import { useRealtime, useRealtimePostComments } from '@/utils/realtime/use-realtime';
import { isAdmin, useUser } from '@/utils/Utils';

type Options = {
  post: Pick<CommunityPostItem, 'id' | 'post_type' | 'is_locked' | 'author'> | undefined;
  isMember: boolean;
  role: CommunityRole | null | undefined;
  /** false: nothing is loaded (the comments of a feed card stay closed) */
  enabled?: boolean;
};


function UsePostComments({ post, isMember, role, enabled = true }: Options) {
  const user = useUser();
  const { connected } = useRealtime();
  const postId = post?.id ?? '';
  const active = enabled && !!post;
  const query = useGetPostCommentsQuery(postId, { skip: !active, pollingInterval: active && !connected ? 15_000 : 0 });
  // Comments, reactions and the accepted answer of others appear live
  useRealtimePostComments(active ? postId : undefined);

  const [addComment] = useAddPostCommentMutation();
  const [deleteComment] = useDeletePostCommentMutation();
  const [toggleCommentLike] = useToggleCommentLikeMutation();
  const [acceptAnswer, { isLoading: isAccepting }] = useAcceptAnswerMutation();

  const isModerator = isMember && !!role && role !== 'member';
  const isQuestion = post?.post_type === 'question';
  const isAuthor = !!user && !!post && post.author.id === user.id;

  const run = async (action: Promise<unknown>, message?: string) => {
    try {
      await action;
      if (message) customToast.success({ message });
      return true;
    } catch (err) {
      customToast.error({ message: parseApiError(err).message });
      return false;
    }
  };

  return {
    comments: query.data ?? [],
    isCommentsLoading: query.isLoading,
    commentsError: query.error ? parseApiError(query.error).message : null,
    retryComments: query.refetch,
    isMember,
    isQuestion,
    canComment: isMember && !!post && !post.is_locked,
    /** Stack Overflow way: the author of the question picks the answer that solved it */
    canAccept: (c: PostComment) => isQuestion && isAuthor && !c.parent_id && !c.is_accepted_answer,
    canDelete: (c: PostComment) => !!user && (c.author.id === user.id || isModerator || isAdmin(user)),
    isSending: false,
    isAccepting,
    /** Optimistic: shown at once, removed with a toast if the api refuses it */
    send: (content: string, parentId?: string) => {
      addComment({ postId, content, ...(parentId ? { parent_id: parentId } : {}) })
        .unwrap()
        .catch((err) => {
          customToast.error({ message: parseApiError(err).message });
        });
      return true;
    },
    remove: (c: PostComment) => run(deleteComment({ postId, commentId: c.id }).unwrap(), 'Commentaire supprimé.'),
    likeComment: (c: PostComment) => run(toggleCommentLike({ postId, commentId: c.id }).unwrap()),
    accept: (c: PostComment) => run(acceptAnswer({ postId, commentId: c.id }).unwrap(), 'Réponse acceptée : la question est résolue.'),
  };
}

/** What a comment needs from its post: rights and actions */
export type PostComments = ReturnType<typeof UsePostComments>;

export default UsePostComments;
