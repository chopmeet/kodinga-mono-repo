import { useState } from 'react';

import { useGetProfileActivityQuery } from '@/utils/api/user/user.api';

/**
 * The contributions of a profile per day, one year at a time: from the year it joined Kodinga to
 * this one (the api counts posts, comments, lessons done, reactions and points)
 */
function UseProfileActivity(username: string, joinedAt: string | undefined) {
  const current = new Date().getFullYear();
  const joined = joinedAt ? new Date(joinedAt).getFullYear() : current;
  const [year, setYear] = useState(current);
  const { data, isFetching, error } = useGetProfileActivityQuery({ username, year }, { skip: !username });

  return {
    year,
    setYear,
    years: Array.from({ length: Math.max(1, current - Math.min(joined, current) + 1) }, (_, i) => current - i),
    counts: data?.year === year ? data.counts : undefined,
    total: data?.year === year ? data.total_contributions : undefined,
    isLoading: isFetching && data?.year !== year,
    failed: !!error,
  };
}

export default UseProfileActivity;
