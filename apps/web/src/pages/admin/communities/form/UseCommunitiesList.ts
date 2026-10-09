import { useEffect, useMemo, useState } from 'react';

import { adminCategories, adminCommunities } from '@/data/admin-communities.data';
import type { ApiPaginated } from '@/utils/api/api.type';
import type { CommunityListItem, CommunityListQuery } from '@/utils/api/community/community.type';

const FAKE_LATENCY_MS = 300;

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Mock of GET communities/ (same query params, same paginated response).
 * To plug the api: replace the body with useGetCommunitiesQuery(query) and drop `archivedIds`
 * (the api stops listing archived communities by itself).
 */
function UseCommunitiesList(query: CommunityListQuery, archivedIds: string[]) {
  const { q = '', category, privacy, pricing, page = 1, page_size = 10 } = query;

  const data = useMemo<ApiPaginated<CommunityListItem>>(() => {
    const needle = normalize(q.trim());
    const matching = adminCommunities.filter(
      (c) =>
        !archivedIds.includes(c.id) &&
        (!needle || normalize(`${c.name} ${c.slug} ${c.tagline}`).includes(needle)) &&
        (!category || c.category?.slug === category) &&
        (!privacy || c.privacy_type === privacy) &&
        (!pricing || c.pricing_type === pricing)
    );
    const total = matching.length;
    return {
      success: true,
      pagination: {
        count: total,
        total_pages: Math.max(1, Math.ceil(total / page_size)),
        current_page: page,
        next: page * page_size < total ? `?page=${page + 1}` : null,
        previous: page > 1 ? `?page=${page - 1}` : null,
        page_size,
      },
      results: matching.slice((page - 1) * page_size, page * page_size),
    };
  }, [q, category, privacy, pricing, page, page_size, archivedIds]);

  // Short fake loading on each new query, like a network round trip
  const key = JSON.stringify(query);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setLoadedKey(key), FAKE_LATENCY_MS);
    return () => clearTimeout(timer);
  }, [key]);

  return {
    data,
    categories: adminCategories,
    isLoading: loadedKey === null,
    isFetching: loadedKey !== key,
  };
}

export default UseCommunitiesList;
