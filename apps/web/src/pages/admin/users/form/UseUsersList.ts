import { useGetUsersQuery } from '@/utils/api/user/user.api';
import type { UserPeriodFilter, UserRoleFilter, UsersQuery } from '@/utils/api/user/user.type';

/** What the status chips mean, mapped to the api `status` filter */
export type UserStatusFilter = 'all' | 'active' | 'unverified' | 'suspended';
export type UserRoleSelect = 'all' | 'creator' | 'member' | 'admin';
export type UserPeriodSelect = 'all' | '7d' | '30d' | '90d';

const API_STATUS: Record<UserStatusFilter, UsersQuery['status']> = {
  all: undefined,
  active: 'active',
  unverified: 'unverified',
  suspended: 'inactive',
};

/** GET users/ (search, status, role, period, pagination) */
function UseUsersList(query: {
  search: string;
  status: UserStatusFilter;
  role?: UserRoleSelect;
  period?: UserPeriodSelect;
  date_from?: string;
  date_to?: string;
  page: number;
  size: number;
}) {
  const { data, isLoading, isFetching, error, refetch } = useGetUsersQuery({
    search: query.search || undefined,
    status: API_STATUS[query.status],
    role: query.role && query.role !== 'all' ? (query.role as UserRoleFilter) : undefined,
    period: query.period && query.period !== 'all' ? (query.period as UserPeriodFilter) : undefined,
    date_from: query.date_from || undefined,
    date_to: query.date_to || undefined,
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
