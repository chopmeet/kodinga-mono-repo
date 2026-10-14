import { useGetUsersQuery } from '@/utils/api/user/user.api';
import type { UsersQuery } from '@/utils/api/user/user.type';

/** What the status chips mean, mapped to the api `status` filter */
export type UserStatusFilter = 'all' | 'active' | 'unverified' | 'suspended';

const API_STATUS: Record<UserStatusFilter, UsersQuery['status']> = {
  all: undefined,
  active: 'active',
  unverified: 'unverified',
  suspended: 'inactive',
};

/** GET users/ (search, status, pagination) */
function UseUsersList(query: { search: string; status: UserStatusFilter; page: number; size: number }) {
  const { data, isLoading, isFetching, error, refetch } = useGetUsersQuery({
    search: query.search,
    status: API_STATUS[query.status],
    page: query.page,
    page_size: query.size,
  });

  return {
    results: data?.results ?? [],
    total: data?.pagination.count ?? 0,
    hasData: !!data,
    isLoading,
    isFetching,
    error,
    refetch,
  };
}

export default UseUsersList;
