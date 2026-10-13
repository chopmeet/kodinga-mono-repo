import { useGetCommunitiesQuery, useGetCommunityCategoriesQuery } from '@/utils/api/community/community.api';
import type { CommunityListQuery } from '@/utils/api/community/community.type';

/**
 * GET communities/ (search, category, privacy, pricing, pagination) and the categories of the
 * filters. Archived communities leave the list by themselves (the api lists active ones only).
 */
function UseCommunitiesList(query: CommunityListQuery) {
  const list = useGetCommunitiesQuery(query);
  const { data: categories = [] } = useGetCommunityCategoriesQuery();

  return {
    data: list.data,
    categories,
    isLoading: list.isLoading,
    isFetching: list.isFetching,
    error: list.error,
    refetch: list.refetch,
  };
}

export default UseCommunitiesList;
