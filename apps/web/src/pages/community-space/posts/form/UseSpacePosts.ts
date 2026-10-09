import { useMemo, useState } from 'react';

import { customToast } from '@kodinga-mono-repo/ui';
import { type AdminPost, getCommunityPosts, type PostType } from '@/data/admin-community-details.data';
import type { CommunityListItem } from '@/utils/api/community/community.type';

export type PostStateFilter = 'all' | 'pinned' | 'locked';
export type PostTypeFilter = PostType | 'all';

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Pinned first, then newest (feed order of the api)
const feedOrder = (a: AdminPost, b: AdminPost) =>
  Number(b.is_pinned) - Number(a.is_pinned) || b.created_at.localeCompare(a.created_at);

/**
 * Mock of the moderation endpoints of the feed. Changes live in local state.
 * With the api: GET communities/<slug>/feed/, POST posts/<id>/pin/, posts/<id>/lock/, DELETE posts/<id>/.
 * Every action is open to moderators and above (posts/services/post_service.py).
 */
function UseSpacePosts(community: CommunityListItem, query: { search: string; state: PostStateFilter; type: PostTypeFilter }) {
  const [posts, setPosts] = useState<AdminPost[]>(() => getCommunityPosts(community));

  const filtered = useMemo(() => {
    const needle = normalize(query.search.trim());
    return posts.filter(
      (p) =>
        (!needle || normalize(`${p.title} ${p.author}`).includes(needle)) &&
        (query.state === 'all' || (query.state === 'pinned' ? p.is_pinned : p.is_locked)) &&
        (query.type === 'all' || p.type === query.type)
    );
  }, [posts, query.search, query.state, query.type]);

  const patch = (post: AdminPost, changes: Partial<AdminPost>, message: string) => {
    setPosts((list) => list.map((p) => (p.id === post.id ? { ...p, ...changes } : p)).sort(feedOrder));
    customToast.success({ message });
  };

  return {
    posts,
    filtered,
    counts: {
      all: posts.length,
      pinned: posts.filter((p) => p.is_pinned).length,
      locked: posts.filter((p) => p.is_locked).length,
    } satisfies Record<PostStateFilter, number>,
    togglePin: (p: AdminPost) => patch(p, { is_pinned: !p.is_pinned }, p.is_pinned ? 'Publication désépinglée.' : 'Publication épinglée en haut du fil.'),
    toggleLock: (p: AdminPost) => patch(p, { is_locked: !p.is_locked }, p.is_locked ? 'Commentaires rouverts.' : 'Commentaires verrouillés.'),
    remove: (p: AdminPost) => {
      setPosts((list) => list.filter((x) => x.id !== p.id));
      customToast.success({ message: 'Publication supprimée.' });
    },
  };
}

export default UseSpacePosts;
