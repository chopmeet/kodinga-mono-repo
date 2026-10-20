import { useDeferredValue, useState } from 'react';

import { useGetAllEventAttendeesQuery } from '@/utils/api/community/community.api';
import type { RsvpStatus } from '@/utils/api/event/event.type';

export type AttendeeFilter = 'all' | RsvpStatus | 'checked_in';

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Attendees of an event for the team: all of them (GET .../attendees/?all=true), searched by
 * name or username, filtered by answer or presence, and paginated here
 */
function UseEventAttendees(slug: string, eventId: string) {
  const { data = [], isLoading } = useGetAllEventAttendeesQuery({ slug, eventId });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AttendeeFilter>('all');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const query = normalize(useDeferredValue(search).trim());

  const matching = data.filter((a) => {
    if (filter === 'checked_in' ? !a.checked_in_at : filter !== 'all' && a.status !== filter) return false;
    if (!query) return true;
    return normalize(`${a.user.full_name ?? ''} ${a.user.username}`).includes(query);
  });
  const counts = {
    all: data.length,
    attending: data.filter((a) => a.status === 'attending').length,
    maybe: data.filter((a) => a.status === 'maybe').length,
    checked_in: data.filter((a) => a.checked_in_at).length,
  };

  return {
    isLoading,
    total: data.length,
    counts,
    matching: matching.length,
    rows: matching.slice((page - 1) * size, page * size),
    search,
    setSearch: (value: string) => {
      setSearch(value);
      setPage(1);
    },
    filter,
    setFilter: (value: AttendeeFilter) => {
      setFilter(value);
      setPage(1);
    },
    page,
    setPage,
    size,
    setSize: (value: number) => {
      setSize(value);
      setPage(1);
    },
  };
}

export default UseEventAttendees;
