import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useGetTrendingQuery, useGlobalSearchQuery } from '@/utils/api/community/community.api';
import type { DiscoveryType } from '@/utils/api/discovery/discovery.type';
import { useDebounced } from '@/utils/hooks/useDebounced';

/** Shorter, a query matches too much to mean anything */
export const MIN_QUERY = 2;

const TYPES: DiscoveryType[] = ['community', 'course', 'event', 'developer', 'post'];
const isType = (value: string | null): value is DiscoveryType => TYPES.includes(value as DiscoveryType);

/**
 * /search?q=&type= — the whole platform: a few of each kind of result, or more of one. The words
 * live in the url (a search can be shared, the back button goes back to it); with no words, the trends.
 */
function UseGlobalSearch() {
  const [params, setParams] = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  const type = isType(params.get('type')) ? (params.get('type') as DiscoveryType) : null;
  const [text, setText] = useState(urlQuery);
  const typed = useDebounced(text.trim(), 300);

  // The words typed go to the url once the typing pauses
  useEffect(() => {
    if (typed === urlQuery) return;
    const next = new URLSearchParams(params);
    if (typed) next.set('q', typed);
    else next.delete('q');
    setParams(next, { replace: true });
  }, [typed, urlQuery, params, setParams]);

  const q = urlQuery.trim();
  const searching = q.length >= MIN_QUERY;
  const results = useGlobalSearchQuery({ q, type: type ?? undefined, limit: type ? 30 : 5 }, { skip: !searching });
  const trending = useGetTrendingQuery(6, { skip: searching });

  return {
    text,
    setText,
    q,
    type,
    searching,
    results: results.data,
    trending: trending.data,
    isLoading: searching ? results.isFetching : trending.isLoading,
    failed: searching ? !!results.error : !!trending.error,
    setType: (next: DiscoveryType | null) => {
      const updated = new URLSearchParams(params);
      if (next) updated.set('type', next);
      else updated.delete('type');
      setParams(updated, { replace: true });
    },
  };
}

export type GlobalSearch = ReturnType<typeof UseGlobalSearch>;

export default UseGlobalSearch;
