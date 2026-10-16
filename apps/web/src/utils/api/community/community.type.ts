import type { User } from '../user/user.type';

// Mirrors apps/communities (models/community.py, serializers/community.py, serializers/category.py)

export type CommunityPrivacy = 'public' | 'private' | 'secret';
export type CommunityPricing = 'free' | 'paid';

export type CommunityCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon_url: string;
  order: number;
  created_at: string;
};

/** CommunityCategorySerializer as the admin sees it (GET communities/categories/?include_inactive=true) */
export type AdminCategoryItem = CommunityCategory & { is_active: boolean; communities_count: number };

/** CommunityCategoryCreateUpdateSerializer: the slug is built from the name when omitted */
export type CategoryWriteData = Partial<Pick<AdminCategoryItem, 'name' | 'slug' | 'description' | 'icon_url' | 'is_active' | 'order'>>;

/** CommunityListSerializer */
export type CommunityListItem = {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  avatar_url: string;
  banner_url: string;
  brand_color: string | null;
  category: CommunityCategory | null;
  owner: User;
  privacy_type: CommunityPrivacy;
  pricing_type: CommunityPricing;
  is_verified: boolean;
  is_featured: boolean;
  members_count: number;
  posts_count: number;
  courses_count: number;
  events_count: number;
  created_at: string;
  /** Active membership of the signed-in user (false for visitors) */
  is_member?: boolean;
};

/** Query params of GET communities/ */
export type CommunityListQuery = Partial<{
  q: string;
  category: string;
  privacy: CommunityPrivacy;
  pricing: CommunityPricing;
  is_featured: boolean;
  page: number;
  page_size: number;
}>;

export type CommunityRole = 'owner' | 'admin' | 'moderator' | 'member';

/** user_membership of the detail serializer (role of the signed-in user in this community) */
export type CommunityMembership = {
  is_member: boolean;
  role: CommunityRole | null;
  status: string | null;
};

export type CommunitySettings = {
  allow_member_invites: boolean;
  require_approval_to_join: boolean;
  welcome_message: string;
  default_post_permission: 'all_members' | 'moderators_only' | 'admins_only';
  is_read_only?: boolean;
};

export type CommunityRuleItem = { id: string; title: string; description: string; order: number };

/** CommunityDetailSerializer (GET communities/<slug>/, and the 201 of POST communities/) */
export type CommunityDetail = CommunityListItem & {
  description: string;
  user_membership: CommunityMembership;
  settings?: CommunitySettings | null;
  rules?: CommunityRuleItem[];
};

/** CommunityCreateUpdateSerializer: the slug is generated from the name when omitted */
export type CommunityCreateData = {
  name: string;
  slug?: string;
  tagline?: string;
  category_id?: string | null;
  privacy_type: CommunityPrivacy;
  pricing_type: CommunityPricing;
  brand_color?: string;
  settings?: { require_approval_to_join?: boolean };
};

/** Roles that manage a community (plain members do not): they open /c/<slug> */
export type ManagedRole = Exclude<CommunityRole, 'member'>;

/** A community the signed-in user manages, with their role in it */
export type ManagedCommunity = { community: CommunityListItem; role: ManagedRole };

// Mirrors apps/memberships (serializers/member.py, models/member.py, models/sanction.py)

export type MembershipStatus = 'active' | 'pending' | 'rejected' | 'suspended' | 'banned' | 'left';

/** CommunityMemberSerializer */
export type CommunityMemberItem = {
  id: string;
  user: User;
  role: CommunityRole;
  status: MembershipStatus;
  custom_title: string;
  joined_at: string;
  reputation_score: number;
  created_at: string;
};

export type CommunityMembersQuery = {
  slug: string;
  status?: MembershipStatus;
  role?: CommunityRole;
  search?: string;
  page?: number;
  page_size?: number;
};

export type SanctionData = {
  slug: string;
  memberId: string;
  sanction_type: 'warning' | 'mute' | 'suspension' | 'ban';
  reason: string;
  duration_days?: number | null;
};

// Mirrors apps/posts (serializers/post.py PostListSerializer, models/post.py)

export type PostType = 'discussion' | 'question' | 'project_showcase' | 'poll' | 'announcement';

export type CommunityPostItem = {
  id: string;
  community_id: string;
  author: User;
  title: string;
  content: string;
  post_type: PostType;
  is_pinned: boolean;
  is_locked: boolean;
  is_resolved: boolean;
  views_count: number;
  reactions_count: number;
  comments_count: number;
  created_at: string;
};

export type CommunityFeedQuery = {
  slug: string;
  type?: PostType;
  q?: string;
  page?: number;
  page_size?: number;
};

// ==============================================================================
// AI Community Assistant Types
// ==============================================================================

export type CommunityRecommendationCard = {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  category: string;
  privacy_type: string;
  pricing_type: string;
  members_count: number;
  language: string;
  relevance_reason: string;
  match_score: number;
};

export type CommunityRecommendationResult = {
  recommendations: CommunityRecommendationCard[];
  reasoning: string;
  suggested_alternatives: string[];
  provider: string;
};

export type FirstWeekPlanItem = {
  day: string;
  focus: string;
  action_items: string[];
};

export type CommunityProposalResult = {
  name_suggestions: string[];
  description: string;
  purpose: string;
  target_audience: string;
  suggested_categories: string[];
  suggested_rules: string[];
  recommended_language: string;
  recommended_visibility: string;
  welcome_message: string;
  first_discussion_prompts: string[];
  initial_event_ideas: string[];
  first_week_launch_plan: FirstWeekPlanItem[];
  follow_up_questions: string[];
  provider: string;
};

export type ContentSuggestionResult = {
  discussion_categories: string[];
  first_post: { title: string; content: string; type: string };
  weekly_activities: { title: string; description: string }[];
  monthly_events: { title: string; format: string; description: string }[];
  onboarding_prompt: string;
  weekly_content_calendar: { day: string; topic: string; type: string }[];
  provider: string;
};

export type ImprovementRecommendation = {
  category: string;
  title: string;
  action_draft: string;
  rationale: string;
};

export type CommunityAnalysisResult = {
  community_name: string;
  overview_assessment: string;
  strengths: string[];
  improvement_areas: string[];
  actionable_recommendations: ImprovementRecommendation[];
  event_suggestions: string[];
  engagement_tactics: string[];
  /** Figures the diagnosis is based on (the api may add others) */
  metrics_summary: {
    members_count?: number;
    recent_posts_30d?: number;
    unanswered_questions_count?: number;
    upcoming_events_count?: number;
    [key: string]: unknown;
  };
  provider: string;
};

export type AssistantChatResult = {
  conversation_id: string;
  reply: string;
  suggested_follow_ups: string[];
  suggested_action?: string;
  data?: unknown;
  provider: string;
};


/** GET / PATCH communities/<slug>/ai-settings/ (apps/ai) */
export type CommunityAISettings = {
  ai_translation_enabled: boolean;
  default_community_language: string;
  supported_languages: string[];
  sentiment_analytics_enabled: boolean;
  non_mandatory_moderation: Record<string, boolean>;
  moderation_strictness: string;
  /** Platform rules, always on (read only) */
  platform_locked_rules?: {
    prohibit_sexual_harassment: boolean;
    prohibit_targeted_harassment: boolean;
    prohibit_hate_speech_and_bullying: boolean;
    mandatory_pre_publication_moderation: boolean;
    fail_closed_on_outage: boolean;
    notice: string;
  };
};

export type CommunityAISettingsWrite = Omit<CommunityAISettings, 'platform_locked_rules'>;
