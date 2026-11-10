// Mirrors apps/administration (models/setting.py, serializers/audit.py SystemSettingSerializer)

/** Key/value platform setting; `is_public` ones are also served by GET system/settings/public/ */
export type SystemSetting = {
  key: string;
  value: unknown;
  description: string;
  is_public: boolean;
};

export type SystemSettingWrite = Pick<SystemSetting, 'key' | 'value'> & Partial<Pick<SystemSetting, 'description' | 'is_public'>>;

/** Who may create a community, read by the api on creation (community_service.py) */
export type CommunityCreationTier = 'all' | 'pro_only';

export const COMMUNITY_CREATION_KEY = 'community_creation_allowed_for';

/** Monthly price of Kodinga Pro, in FCFA: the api keeps the "kodinga-pro-monthly" plan in sync */
export const PRO_MONTHLY_PRICE_KEY = 'pro_monthly_price';

// Mirrors apps/analytics/services/analytics_service.py get_overview_metrics (cached 5 min by the api)
export type AnalyticsOverview = {
  users: { total: number; active_30d: number; active_24h: number; new_7d: number };
  /** Every community, inactive ones included */
  communities: { total: number };
  content: { total_posts: number; total_comments: number };
  learning: { total_courses: number; lessons_completed: number };
  ecosystem: { total_events: number; total_projects: number; total_opportunities: number };
  /** Amounts in XOF */
  financial: { total_revenue: number; total_paid_transactions: number; active_subscriptions: number };
  generated_at: string;
};

/** One entry of recent_audit_logs (administration/services/admin_service.py get_dashboard_summary) */
export type DashboardAuditLog = {
  id: string;
  /** e.g. user.suspend, system.update_setting, workspace.member_removed */
  action: string;
  /** "Système" when no actor */
  actor_username: string;
  target_type: string;
  target_id: string;
  created_at: string;
};

/** Kind of an entry of the activity feed (administration/services/admin_service.py) */
export type PlatformActivityType = 'member' | 'community' | 'payment' | 'post' | 'admin' | 'setting';

/**
 * One entry of recent_activities: sign-ups, new communities, payments, posts and admin actions.
 * Admin actions keep their audit code in `action` and their target uuid in `target`.
 */
export type PlatformActivity = {
  id: string;
  type: PlatformActivityType;
  actor: string;
  /** Audit code (user.suspend…) or the kind of event */
  action: string;
  /** Readable sentence written by the api, in French ("a créé la communauté…") */
  action_label: string;
  target: string | null;
  target_type?: string;
  at: string;
};

/** GET admin/dashboard/ */
export type AdminDashboardSummary = {
  overview: AnalyticsOverview;
  /** Older api: admin actions only */
  recent_audit_logs: DashboardAuditLog[];
  /** The whole platform, most recent first */
  recent_activities?: PlatformActivity[];
};

export type PaymentMethodStat = {
  method: string;
  amount: number;
  count: number;
};

/** GET analytics/financial/ (fields used by the front) */
export type FinancialAnalytics = {
  recent_30d_revenue: number;
  recent_30d_transactions: number;
  payment_methods_30d?: PaymentMethodStat[];
  generated_at: string;
};

/** GET analytics/growth/: the 12 last months, oldest first */
export type MonthlyGrowthPoint = {
  /** Short French month name ("Oct") */
  month: string;
  year: number;
  /** yyyy-mm */
  date: string;
  newMembers: number;
  new_members: number;
  posts: number;
  /** XOF */
  revenue: number;
};

/** GET analytics/engagement/ (fields used by the front) */
export type EngagementAnalytics = {
  dau: number;
  wau: number;
  mau: number;
  posts_last_7d: number;
  comments_last_7d: number;
  generated_at: string;
};
