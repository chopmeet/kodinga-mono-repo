// Gamification (apps/gamification): reputation points, levels and leaderboards.
import { translatedLabels } from '@/utils/translated';

/** ?period= of the community leaderboard: rolling windows (last 7 or 30 days), or all time */
export type LeaderboardPeriod = 'all_time' | 'monthly' | 'weekly';

/** Texts in locales/<lang>/labels.ts, read in the current language */
export const PERIOD_LABEL = translatedLabels<LeaderboardPeriod>('labels.leaderboardPeriod.', ['weekly', 'monthly', 'all_time']);

/** LeaderboardEntrySerializer; `points` are the ones earned in the community over the period */
export type LeaderboardEntry = {
  rank: number;
  user: { id: string; username: string; name: string; avatar_url: string };
  points: number;
  level: number;
  rank_title: string;
};

type GamificationUser = { id: string; username: string; name: string; avatar_url: string; headline: string };

/** UserReputationSerializer (GET gamification/reputation/me/): points across Kodinga */
export type MyReputation = {
  total_points: number;
  level: number;
  rank_title: string;
  current_streak_days: number;
  last_activity_date: string | null;
  badges_count: number;
};

/** ReputationTransactionSerializer: one gain (or loss) of points */
export type PointsTransaction = {
  id: string;
  user: GamificationUser;
  community_id: string | null;
  community_name: string | null;
  community_slug: string | null;
  action: string;
  action_label: string;
  points: number;
  source: string;
  source_label: string;
  awarded_by: GamificationUser | null;
  description: string;
  created_at: string;
};

/** UserBadgeSerializer (GET gamification/badges/my/) */
export type MyBadge = {
  id: string;
  badge: { id: string; slug: string; name: string; description: string; icon_url: string; category: string; points_reward: number };
  community: { id: string; name: string; slug: string; avatar_url: string } | null;
  awarded_at: string;
};

/** MemberCommunityPointsSerializer (GET communities/<slug>/gamification/points/me/) */
export type MyCommunityPoints = {
  community_slug: string;
  total_points: number;
  level: number;
  rank_title: string;
  /** null while the member has no point */
  rank: number | null;
  total_ranked_members: number;
  points_to_next_rank: number;
  transactions_count: number;
  breakdown_by_action: { action: string; action_label: string; points: number; count: number }[];
};

/** CommunityPointRuleSerializer (GET communities/<slug>/gamification/rules/): points of one action in the community */
export type PointRule = {
  id: string;
  action: string;
  label: string;
  description: string;
  points: number;
  default_points: number;
  is_active: boolean;
  allow_multiple_per_reference: boolean;
  updated_at: string;
};

/** PATCH communities/<slug>/gamification/rules/ (owner, or admin allowed to manage the settings) */
export type PointRulesUpdate = { rules: { action: string; points: number; is_active: boolean }[]; note?: string };

/** POST communities/<slug>/gamification/points/adjust/: points to add (or remove), with a reason */
export type PointsAdjustment = { user_id: string; points: number; reason: string };
