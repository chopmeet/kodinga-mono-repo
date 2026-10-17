// Gamification (apps/gamification): reputation points, levels and leaderboards.

/** LeaderboardEntrySerializer; `points` are the ones earned in the community (all time) */
export type LeaderboardEntry = {
  rank: number;
  user: { id: string; username: string; name: string; avatar_url: string };
  points: number;
  level: number;
  rank_title: string;
};
