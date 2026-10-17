import { customToast } from '@kodinga-mono-repo/ui';
import {
  useDeletePostMutation,
  useGetCommunityFeedQuery,
  useTogglePostLockMutation,
  useTogglePostPinMutation,
} from '@/utils/api/community/community.api';
import type { CommunityPostItem, PostType } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';
import { useDebounced } from '@/utils/hooks/useDebounced';
import { getName } from '@/utils/Utils';

/** "locked" is not a filter of the api feed yet */
export type PostStateFilter = 'all' | 'pinned';
export type PostTypeFilter = PostType | 'all';

/** A post of the feed with its author's display name */
export type SpacePost = Omit<CommunityPostItem, 'author'> & { author: string; author_username: string; author_id: string };

/**
 * Feed of the community for moderation (GET communities/<slug>/feed/, pinned posts first): type,
 * search and "pinned" are filtered by the api. Pin, lock and delete are open to moderators and
 * above (POST posts/<id>/pin/, posts/<id>/lock/, DELETE posts/<id>/).
 */
function UseSpacePosts(slug: string, query: { search: string; state: PostStateFilter; type: PostTypeFilter; page: number; size: number }) {
  const q = useDebounced(query.search.trim(), 300);
  const { data, isLoading, isFetching, error, refetch } = useGetCommunityFeedQuery({
    slug,
    type: query.type === 'all' ? undefined : query.type,
    q: q || undefined,
    pinned: query.state === 'pinned' ? true : undefined,
    page: query.page,
    page_size: query.size,
  });
  // Totals of the chips: page_size=1 is enough, the api gives the count
  const all = useGetCommunityFeedQuery({ slug, page: 1, page_size: 1 }).data?.pagination.count;
  const pinned = useGetCommunityFeedQuery({ slug, pinned: true, page: 1, page_size: 1 }).data?.pagination.count;

  const [togglePin] = useTogglePostPinMutation();
  const [toggleLock] = useTogglePostLockMutation();
  const [deletePost] = useDeletePostMutation();

  const run = async (action: Promise<unknown>, message: string) => {
    try {
      await action;
      customToast.success({ message });
      return true;
    } catch (err) {
      customToast.error({ message: parseApiError(err).message });
      return false;
    }
  };

  const posts: SpacePost[] = (data?.results ?? []).map(({ author, ...p }) => ({
    ...p,
    author: getName(author) || author.username,
    author_username: author.username,
    author_id: author.id,
  }));

  return {
    posts,
    total: data?.pagination.count ?? 0,
    counts: { all, pinned } satisfies Record<PostStateFilter, number | undefined>,
    isLoading,
    isFetching,
    error: data ? undefined : error,
    refetch,
    togglePin: (p: SpacePost) => run(togglePin(p.id).unwrap(), p.is_pinned ? 'Publication désépinglée.' : 'Publication épinglée en haut du fil.'),
    toggleLock: (p: SpacePost) => run(toggleLock(p.id).unwrap(), p.is_locked ? 'Commentaires rouverts.' : 'Commentaires verrouillés.'),
    remove: (p: SpacePost) => run(deletePost(p.id).unwrap(), 'Publication supprimée.'),
  };
}

export default UseSpacePosts;
