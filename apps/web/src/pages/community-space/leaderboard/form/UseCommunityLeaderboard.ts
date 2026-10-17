import { useMemo, useState } from 'react';

import { useGetCommunityLeaderboardQuery } from '@/utils/api/community/community.api';
import { downloadCsv, useUser } from '@/utils/Utils';

export const LIMITS = [10, 25, 50, 100] as const;
export type Limit = (typeof LIMITS)[number];

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/**
 * Ranking of the members of a community (GET communities/<slug>/leaderboard/?limit=).
 * The api answers the top N in one go: the search is done here, on the ranks it returned.
 */
function UseCommunityLeaderboard(slug: string) {
  const [limit, setLimit] = useState<Limit>(50);
  const [search, setSearch] = useState('');
  const userId = useUser()?.id;
  const query = useGetCommunityLeaderboardQuery({ slug, limit });
  const entries = useMemo(() => query.data ?? [], [query.data]);

  const filtered = useMemo(() => {
    const needle = normalize(search.trim());
    return needle ? entries.filter((e) => normalize(`${e.user.name} ${e.user.username}`).includes(needle)) : entries;
  }, [entries, search]);

  const stats = useMemo(
    () => ({
      ranked: entries.length,
      total: entries.reduce((sum, e) => sum + e.points, 0),
      top: entries[0]?.points ?? 0,
      me: entries.find((e) => e.user.id === userId) ?? null,
    }),
    [entries, userId],
  );

  const exportCsv = () =>
    downloadCsv(
      `classement-${slug}.csv`,
      ['Rang', 'Membre', 'Pseudo', 'Points', 'Niveau', 'Titre'],
      entries.map((e) => [e.rank, e.user.name, e.user.username, e.points, e.level, e.rank_title]),
    );

  return { ...query, entries, filtered, stats, limit, setLimit, search, setSearch, exportCsv, userId };
}

export default UseCommunityLeaderboard;
