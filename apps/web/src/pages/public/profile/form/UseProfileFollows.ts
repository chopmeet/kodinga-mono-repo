import { useState } from 'react';

import { useGetProfileFollowsQuery } from '@/utils/api/user/user.api';

export type FollowList = 'followers' | 'following';

const PAGE_SIZE = 20;

/** The followers or the followings of a profile, opened in a dialog, 20 more at a time */
function UseProfileFollows(username: string) {
  const [open, setOpen] = useState<FollowList | null>(null);
  const [size, setSize] = useState(PAGE_SIZE);
  const { data, isLoading, isFetching, error } = useGetProfileFollowsQuery({ username, list: open ?? 'followers', page_size: size }, { skip: !open });
  const people = data?.results ?? [];

  return {
    open,
    people,
    total: data?.pagination.count ?? 0,
    isLoading,
    isFetching,
    failed: !!error,
    hasMore: people.length < (data?.pagination.count ?? 0),
    show: (list: FollowList) => {
      setSize(PAGE_SIZE);
      setOpen(list);
    },
    close: () => setOpen(null),
    more: () => setSize((n) => n + PAGE_SIZE),
  };
}

export default UseProfileFollows;
