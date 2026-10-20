import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { useLocation, useParams } from 'react-router-dom';

import { customToast } from '@kodinga-mono-repo/ui';
import { useAppSelector } from '@/redux/hook';
import {
  useAcceptAnswerMutation,
  useAddPostCommentMutation,
  useDeletePostCommentMutation,
  useGetCommunityQuery,
  useGetPostCommentsQuery,
  useGetPostQuery,
  useToggleCommentLikeMutation,
  useTogglePostLikeMutation,
} from '@/utils/api/community/community.api';
import type { PostComment } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';
import { isAdmin, useUser } from '@/utils/Utils';
import { canSeeContent, membershipOf } from './UseCommunityPage';
import { useRealtimePostComments } from '@/utils/realtime/use-realtime';

/**
 * /communities/:slug/posts/:postId — one post and its comments (GET posts/<id>/ and .../comments/).
 * On a question, its author accepts one answer (POST comments/<id>/accept/): it goes first and the
 * question becomes resolved. Comments: active members, closed when the post is locked; deleting:
 * the author of the comment or the moderators.
 */
function UsePostDetails() {
  const { slug = '', postId = '' } = useParams();
  const { pathname } = useLocation();
  const user = useUser();
  const signedIn = !!useAppSelector((s) => s.user.token);

  const { data: community, isLoading: isCommunityLoading } = useGetCommunityQuery(slug, { skip: !slug });
  const membership = membershipOf(community, signedIn);
  const canSee = community ? canSeeContent(community, membership) : false;
  const { data: post, isLoading: isPostLoading, error } = useGetPostQuery(postId, { skip: !postId || !canSee });
  const { data: comments = [], isLoading: isCommentsLoading } = useGetPostCommentsQuery(postId, { skip: !post });
  // Comments, reactions and the accepted answer of others appear live
  useRealtimePostComments(post ? postId : undefined);

  const [addComment, { isLoading: isSending }] = useAddPostCommentMutation();
  const [deleteComment] = useDeletePostCommentMutation();
  const [toggleCommentLike] = useToggleCommentLikeMutation();
  const [togglePostLike, { isLoading: isLiking }] = useTogglePostLikeMutation();
  const [acceptAnswer, { isLoading: isAccepting }] = useAcceptAnswerMutation();

  const isMember = membership === 'member';
  const role = community?.user_membership?.role;
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
    slug,
    community,
    post,
    comments,
    membership,
    canSee,
    isLoading: isCommunityLoading || (canSee && isPostLoading),
    isCommentsLoading,
    // A post of another community is not shown here
    notFound: (!!post && !!community && post.community_id !== community.id) || (error as FetchBaseQueryError | undefined)?.status === 404,
    error: post ? undefined : error,
    loginUrl: `/auth/login?next=${encodeURIComponent(pathname)}`,
    isMember,
    isQuestion,
    canComment: isMember && !!post && !post.is_locked,
    /** Stack Overflow way: the author of the question picks the answer that solved it */
    canAccept: (c: PostComment) => isQuestion && isAuthor && !c.parent_id && !c.is_accepted_answer,
    canDelete: (c: PostComment) => !!user && (c.author.id === user.id || isModerator || isAdmin(user)),
    isSending,
    isLiking,
    isAccepting,
    send: (content: string, parentId?: string) =>
      run(addComment({ postId, content, ...(parentId ? { parent_id: parentId } : {}) }).unwrap(), parentId ? 'Réponse publiée.' : isQuestion ? 'Réponse publiée.' : 'Commentaire publié.'),
    remove: (c: PostComment) => run(deleteComment({ postId, commentId: c.id }).unwrap(), 'Commentaire supprimé.'),
    likeComment: (c: PostComment) => run(toggleCommentLike({ postId, commentId: c.id }).unwrap()),
    likePost: () => run(togglePostLike(postId).unwrap()),
    accept: (c: PostComment) => run(acceptAnswer({ postId, commentId: c.id }).unwrap(), 'Réponse acceptée : la question est résolue.'),
  };
}

export type PostDetailsPage = ReturnType<typeof UsePostDetails>;

export default UsePostDetails;
