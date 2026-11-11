import { useMemo } from 'react';

import {
  useGetCommunityEventsQuery,
  useGetCommunityFeedQuery,
  useGetCommunityMemberJoinsQuery,
  useGetCommunityMembersQuery,
} from '@/utils/api/community/community.api';
import { getName } from '@/utils/Utils';
import { dateFormat } from '@/utils/format';

const DAY = 86_400_000;
/** Recent posts read for the activity and the popular posts (max page size of the api) */
export const RECENT_POSTS = 100;

export type MonthlyNewMembers = { month: string; newMembers: number }[];

/** New members per month over the last 12 months, oldest first */
function monthlyNewMembers(joinedAt: string[], now: Date): MonthlyNewMembers {
  const months = Array.from({ length: 12 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 11 + i, 1));
  return months.map((start, i) => {
    const end = months[i + 1] ?? new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const label = dateFormat({ month: 'short' }).format(start).replace('.', '');
    return {
      month: label.charAt(0).toUpperCase() + label.slice(1),
      newMembers: joinedAt.filter((d) => {
        const t = new Date(d).getTime();
        return t >= start.getTime() && t < end.getTime();
      }).length,
    };
  });
}

/**
 * Figures of the space dashboard. The api has no statistics per community (analytics/ is for the
 * platform admins): totals come from the lists (page_size=1), the activity from the 100 latest
 * posts, the growth from the join dates of the members (read up to 500).
 */
function UseCommunityDashboard(slug: string) {
  const active = useGetCommunityMembersQuery({ slug, status: 'active', page: 1, page_size: 1 });
  const pending = useGetCommunityMembersQuery({ slug, status: 'pending', page: 1, page_size: 1 });
  const feed = useGetCommunityFeedQuery({ slug, page: 1, page_size: RECENT_POSTS });
  const events = useGetCommunityEventsQuery({ slug, upcoming: true, page: 1, page_size: 3 });
  const joins = useGetCommunityMemberJoinsQuery({ slug });

  return useMemo(() => {
    const now = new Date();
    const since30d = now.getTime() - 30 * DAY;
    const recent = feed.data?.results ?? [];
    const posts30d = recent.filter((p) => new Date(p.created_at).getTime() >= since30d).length;
    const joinedAt = joins.data?.joined_at ?? [];

    return {
      activeMembers: active.data?.pagination.count,
      pendingRequests: pending.data?.pagination.count,
      totalPosts: feed.data?.pagination.count,
      /** Counted on the 100 latest posts: "100+" when they are all recent */
      posts30d: feed.data ? { count: posts30d, atLeast: posts30d === RECENT_POSTS } : undefined,
      newMembers30d: joins.data ? joinedAt.filter((d) => new Date(d).getTime() >= since30d).length : undefined,
      upcomingEvents: events.data?.pagination.count,
      nextEvents: events.data?.results ?? [],
      growth: joins.data ? { data: monthlyNewMembers(joinedAt, now), complete: joins.data.complete, total: joins.data.total } : undefined,
      topPosts: [...recent]
        .sort((a, b) => b.reactions_count - a.reactions_count || b.comments_count - a.comments_count)
        .slice(0, 5)
        .map((p) => ({
          id: p.id,
          title: p.title || p.content.slice(0, 80),
          author: getName(p.author) || p.author.username,
          reactions: p.reactions_count,
          comments: p.comments_count,
        })),
      isLoading: active.isLoading || feed.isLoading,
      isGrowthLoading: joins.isLoading,
      isPostsLoading: feed.isLoading,
    };
  }, [active.data, pending.data, feed.data, feed.isLoading, events.data, joins.data, joins.isLoading, active.isLoading]);
}

export default UseCommunityDashboard;
