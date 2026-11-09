import { useState } from 'react';

import { useGetPublicHackathonsQuery } from '@/utils/api/community/community.api';
import type { HackathonFormat, HackathonStatus } from '@/utils/api/hackathon/hackathon.type';
import { useDebounced } from '@/utils/hooks/useDebounced';

export const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

export type FormatFilter = HackathonFormat | 'all';
export type StatusFilter = Extract<HackathonStatus, 'registration_open' | 'in_progress' | 'completed'> | 'all';

/** Page /hackathons: every published hackathon (GET hackathons/), searched and filtered by the api */
function UsePublicHackathons() {
  const [search, setSearch] = useState('');
  const [format, setFormatState] = useState<FormatFilter>('all');
  const [status, setStatusState] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const query = useDebounced(search.trim(), SEARCH_DEBOUNCE_MS);

  const { data, isLoading, isFetching, error, refetch } = useGetPublicHackathonsQuery({
    search: query || undefined,
    format: format === 'all' ? undefined : format,
    status: status === 'all' ? undefined : status,
    page,
    page_size: PAGE_SIZE,
  });

  // A new filter starts again from page 1
  const setFormat = (value: FormatFilter) => {
    setFormatState(value);
    setPage(1);
  };
  const setStatus = (value: StatusFilter) => {
    setStatusState(value);
    setPage(1);
  };
  const changeSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return {
    search,
    setSearch: changeSearch,
    format,
    setFormat,
    status,
    setStatus,
    page,
    setPage,
    hackathons: data?.results ?? [],
    total: data?.pagination.count ?? 0,
    isFiltered: !!query || format !== 'all' || status !== 'all',
    isLoading,
    isFetching,
    error,
    refetch,
  };
}

export default UsePublicHackathons;
