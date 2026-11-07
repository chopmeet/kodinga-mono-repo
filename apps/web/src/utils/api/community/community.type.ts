import type { User } from '../user/user.type';
import type { BillingInterval, CommunityPlan } from '../billing/billing.type';

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

export type ActiveLiveInfo = {
  id: string;
  title: string;
  slug?: string;
  is_public: boolean;
  attendees_count: number;
};

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
  /** Active live stream information if one is in progress */
  active_live?: ActiveLiveInfo | null;
  /** Signed-in member: the notifications of this community reach them */
  notifications_enabled?: boolean;
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
  can_start_live?: boolean;
  permissions?: (RolePermissionKey | string)[];
};

export type RolePermissionKey =
  | 'can_create_posts'
  | 'can_pin_posts'
  | 'can_delete_posts'
  | 'can_moderate_comments'
  | 'can_create_events'
  | 'can_manage_events'
  | 'can_start_live'
  | 'can_create_courses'
  | 'can_manage_courses'
  | 'can_create_hackathons'
  | 'can_manage_hackathons'
  | 'can_create_projects'
  | 'can_feature_projects'
  | 'can_invite_members'
  | 'can_review_requests'
  | 'can_sanction_members'
  | 'can_assign_roles'
  | 'can_manage_settings'
  | 'can_view_analytics';

export type RolePermissionsMap = Record<RolePermissionKey, boolean>;

export type RolePermissionsMatrix = {
  admin: RolePermissionsMap;
  moderator: RolePermissionsMap;
  member: RolePermissionsMap;
  owner?: RolePermissionsMap;
};

export type CommunitySettings = {
  allow_member_invites: boolean;
  require_approval_to_join: boolean;
  welcome_message: string;
  default_post_permission: 'all_members' | 'moderators_only' | 'admins_only';
  is_read_only?: boolean;
  enabled_features?: Record<string, boolean>;
  role_permissions?: Partial<Record<'admin' | 'moderator' | 'member', Partial<RolePermissionsMap>>>;
  all_role_permissions?: RolePermissionsMatrix;
  updated_at?: string;
};

export type CommunitySettingsWriteData = Partial<{
  allow_member_invites: boolean;
  require_approval_to_join: boolean;
  welcome_message: string;
  default_post_permission: 'all_members' | 'moderators_only' | 'admins_only';
  is_read_only: boolean;
  enabled_features: Record<string, boolean>;
  role_permissions: Partial<Record<'admin' | 'moderator' | 'member', Partial<RolePermissionsMap>>>;
}>;

export type CommunityRuleItem = { id: string; title: string; description: string; order: number };

/** CommunityDetailSerializer (GET communities/<slug>/, and the 201 of POST communities/) */
export type CommunityDetail = CommunityListItem &
  CommunityLinks & {
  description: string;
  user_membership: CommunityMembership;
  settings?: CommunitySettings | null;
  rules?: CommunityRuleItem[];
  /** Active plans of a paid community (PlanSerializer), cheapest first */
  subscription_plans?: CommunityPlan[];
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
  avatar_url?: string;
  banner_url?: string;
  settings?: { require_approval_to_join?: boolean };
  /** Paid community: its first plan, created by the api (at least 500 FCFA) */
  membership_price?: number;
  membership_interval?: BillingInterval;
  membership_plan_name?: string;
};

/** PATCH communities/<slug>/ (CommunityCreateUpdateSerializer, partial) */
export type CommunityUpdateData = Partial<{
  name: string;
  tagline: string;
  description: string;
  category_id: string | null;
  privacy_type: CommunityPrivacy;
  /** "paid" (Kodinga Pro only) with membership_price: the api creates or updates the first plan */
  pricing_type: CommunityPricing;
  membership_price: number;
  membership_interval: BillingInterval;
  membership_plan_name: string;
  brand_color: string;
  website_url: string;
  github_url: string;
  discord_url: string;
  twitter_url: string;
  whatsapp_url: string;
  telegram_url: string;
}>;

/** Links of the detail serializer */
export type CommunityLinks = { website_url?: string; github_url?: string; discord_url?: string; twitter_url?: string; whatsapp_url?: string; telegram_url?: string };

/** Roles that manage a community (plain members do not): they open /c/<slug> */
export type ManagedRole = Exclude<CommunityRole, 'member'>;

/** A community the signed-in user belongs to, with their role in it; the detail carries the settings (role permissions) */
/** The community is its detail (communities/<slug>/): settings and the membership of the user come with it */
export type MyCommunityMembership = {
  community: CommunityListItem & { settings?: CommunitySettings | null; user_membership?: CommunityMembership };
  role: CommunityRole;
};

/** A community the signed-in user manages, with their role in it */
export type ManagedCommunity = MyCommunityMembership & { role: ManagedRole };

// Mirrors apps/memberships (serializers/member.py, models/member.py, models/sanction.py)

export type MembershipStatus = 'active' | 'pending' | 'rejected' | 'suspended' | 'banned' | 'left';

/** CommunityMemberSerializer */
export type CommunityMemberItem = {
  id: string;
  /** Without the email for those who do not manage the community */
  user: User & { avatar_url?: string; headline?: string };
  role: CommunityRole;
  status: MembershipStatus;
  custom_title: string;
  joined_at: string;
  reputation_score: number;
  created_at: string;
  /** A session seen in the last 15 minutes */
  is_online?: boolean;
};

export type CommunityMembersQuery = {
  slug: string;
  status?: MembershipStatus;
  role?: CommunityRole;
  search?: string;
  /** Only those seen in the last 15 minutes */
  online?: boolean;
  /** joined_at, -joined_at, reputation, username, role… */
  ordering?: string;
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
  code_snippet?: string;
  code_language?: string;
  /** Reactions of the signed-in user ('like', 'fire'…) */
  user_reactions?: string[];
  /** Saved by the signed-in user */
  is_bookmarked?: boolean;
  poll?: PostPoll | null;
  is_pinned: boolean;
  is_locked: boolean;
  is_resolved: boolean;
  views_count: number;
  reactions_count: number;
  comments_count: number;
  created_at: string;
};

/** PollSerializer (embedded in a post of type poll) */
export type PostPoll = {
  id: string;
  question: string;
  is_multiple_choice: boolean;
  expires_at: string | null;
  total_votes: number;
  is_expired: boolean;
  user_has_voted: boolean;
  user_voted_option_ids: string[];
  options: { id: string; text: string; votes_count: number; percentage: number; order: number }[];
};

/** CommentSerializer: top-level comments carry their replies (one level) */
export type PostComment = {
  id: string;
  post_id: string;
  parent_id: string | null;
  author: User;
  content: string;
  is_accepted_answer: boolean;
  reactions_count: number;
  user_reactions: string[];
  replies: PostComment[];
  created_at: string;
  updated_at: string;
};

/** PostCreateUpdateSerializer (PATCH takes any subset; the poll is only read on creation) */
export type PostWriteData = {
  title: string;
  content: string;
  post_type: PostType;
  code_snippet: string;
  code_language: string;
  poll?: { question?: string; options: string[]; is_multiple_choice: boolean; duration_days: number };
};

export type CommunityFeedQuery = {
  slug: string;
  type?: PostType;
  q?: string;
  pinned?: boolean;
  /** Pinned first, then by reactions + comments (the most recent without it) */
  sort?: 'popular';
  /** Only the posts saved by the signed-in user */
  bookmarked?: boolean;
  /** Only the posts whose comments are closed */
  locked?: boolean;
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

// Invitations (apps/memberships/serializers/invitation.py)

/** CommunityInvitationSerializer */
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';

/**
 * WorkspaceInvitationSerializer (GET communities/<slug>/invitations/, paginated): the code of the
 * link is never listed, only given once at creation (or when an invitation is sent again)
 */
export type CommunityInvitation = {
  id: string;
  /** Empty for a shareable link */
  email: string;
  role: CommunityRole;
  status: InvitationStatus;
  expires_at: string | null;
  accepted_at: string | null;
  is_valid: boolean;
  invited_by: User;
  created_at: string;
  /** 0: unlimited (a shareable link) */
  max_uses?: number;
  uses_count?: number;
};

/** POST communities/<slug>/invitations/ (CommunityInvitationSerializer): the invitation and the code of its link */
export type CreatedInvitation = CommunityInvitation & { invite_code: string };

/** GET invitations/my/ (WorkspaceInvitationSerializer): invitations by email to the address of the user */
export type MyInvitation = Omit<CommunityInvitation, 'invited_by'> & {
  community_id: string;
  community_name: string;
  community_slug: string;
  community_avatar_url: string;
  invited_by: User | null;
};

/** POST communities/<slug>/invitations/share-link/: the one reusable link of a role, unlimited uses for 30 days */
export type ShareableInviteLink = {
  community_slug: string;
  share_url: string;
  token: string;
  role: CommunityRole;
  expires_at: string;
  uses_count: number;
};

/** PublicInvitationDetailSerializer (GET invitations/<token>/, public): shown before accepting a link sent by email */
export type PublicInvitation = {
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
  workspace_avatar_url: string;
  role: string;
  role_display: string;
  masked_email: string;
  status: InvitationStatus;
  expires_at: string | null;
  is_valid: boolean;
};

/** CreateInvitationRequestSerializer */
export type InvitationWriteData = {
  /** Sent by the api to this address (then max_uses does not apply) */
  email?: string;
  role: CommunityRole;
  max_uses?: number;
  expires_in_days: number;
};

/** A pending request to join a community the user reviews (members?status=pending) */
export type JoinRequest = { community: { slug: string; name: string }; member: CommunityMemberItem };
