import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { useLocation, useParams } from 'react-router-dom';

import { customToast } from '@kodinga/ui';
import { useAppSelector } from '@/redux/hook';
import { useGetCommunityQuery, useGetPostQuery, useTogglePostReactionMutation } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import { canSeeContent, membershipOf } from './UseCommunityPage';
import UsePostComments from './UsePostComments';

/**
 * /communities/:slug/posts/:postId — one post (GET posts/<id>/) and its comments (UsePostComments,
 * the same as under a card of the feed).
 */
function UsePostDetails() {
  const { slug = '', postId = '' } = useParams();
  const { pathname } = useLocation();
  const signedIn = !!useAppSelector((s) => s.user.token);

  const { data: community, isLoading: isCommunityLoading } = useGetCommunityQuery(slug, { skip: !slug });
  const membership = membershipOf(community, signedIn);
  const canSee = community ? canSeeContent(community, membership) : false;
  const { data: post, isLoading: isPostLoading, error } = useGetPostQuery(postId, { skip: !postId || !canSee });
  const isMember = membership === 'member';
  const comments = UsePostComments({ post, isMember, role: community?.user_membership?.role });
  const [togglePostReaction, { isLoading: isReacting }] = useTogglePostReactionMutation();

  return {
    ...comments,
    slug,
    community,
    post,
    membership,
    canSee,
    isLoading: isCommunityLoading || (canSee && isPostLoading),
    // A post of another community is not shown here
    notFound: (!!post && !!community && post.community_id !== community.id) || (error as FetchBaseQueryError | undefined)?.status === 404,
    error: post ? undefined : error,
    loginUrl: `/auth/login?next=${encodeURIComponent(pathname)}`,
    isReacting,
    /** Adds or removes a reaction of the user ('like' or any emoji) */
    reactPost: async (reaction: string) => {
      try {
        await togglePostReaction({ postId, reaction }).unwrap();
        return true;
      } catch (err) {
        customToast.error({ message: parseApiError(err).message });
        return false;
      }
    },
  };
}

export type PostDetailsPage = ReturnType<typeof UsePostDetails>;

export default UsePostDetails;
