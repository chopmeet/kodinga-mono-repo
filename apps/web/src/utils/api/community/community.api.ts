import { createApi, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';

import type {
  CheckoutSession,
  CommunityPayout,
  CommunityPlan,
  CommunityRevenue,
  CommunitySubscriber,
  CommunityTransaction,
  MyPayment,
  MySubscription,
  PaymentCheck,
  PayoutRequest,
  PlanWriteData,
} from '../billing/billing.type';
import type { MediaAsset, UploadTarget, UploadUrlRequest } from '../media/media.type';
import type { ChatMessage, Conversation } from '../messaging/messaging.type';
import type { AppNotification } from '../notification/notification.type';
import type {
  ChatTranscriptRequest,
  ChatTranscriptResponse,
  CommunityEvent,
  EventAttendee,
  EventStatus,
  EventWriteData,
  EventsQuery,
  LiveEventSummary,
  LiveJoin,
  LiveTranscriptionResponse,
  RsvpStatus,
  VideoUploadTarget,
} from '../event/event.type';
import type { Course, CourseLesson, CourseModule, CourseWriteData, LessonWriteData, ModuleWriteData, QuizResult } from '../course/course.type';
import type {
  ApplicationStatus,
  Hackathon,
  HackathonApplication,
  EvaluationWriteData,
  HackathonDashboard,
  HackathonEvaluation,
  HackathonListItem,
  HackathonResult,
  HackathonSubmission,
  HackathonTeam,
  MyTeamInvitation,
  HackathonStatus,
  HackathonWriteData,
  HackathonApplyData,
  HackathonSubmissionWriteData,
  SubmissionFileType,
} from '../hackathon/hackathon.type';
import type {
  LeaderboardEntry,
  LeaderboardPeriod,
  MyBadge,
  MyCommunityPoints,
  MyReputation,
  PointRule,
  PointRulesUpdate,
  PointsAdjustment,
  PointsTransaction,
} from '../gamification/gamification.type';
import type { MemberActivity } from '../analytics/member-activity.type';
import type { Project, ProjectComment, ProjectListItem, ProjectsQuery, ProjectWriteData } from '../project/project.type';
import type {
  OpportunitiesQuery,
  Opportunity,
  OpportunityApplication,
  OpportunityApplicationStatus,
  OpportunityListItem,
  OpportunityWriteData,
  Technology,
} from '../opportunity/opportunity.type';
import { type ApiPaginated, type ApiSuccess, unwrap } from '../api.type';
import type {
  AdminCategoryItem,
  AssistantChatResult,
  CategoryWriteData,
  CommunityAISettings,
  CommunityAISettingsWrite,
  CommunityAnalysisResult,
  CommunityCategory,
  CommunityCreateData,
  CommunityDetail,
  CommunityRuleItem,
  CommunitySettings,
  CommunityUpdateData,
  CommunityFeedQuery,
  CommunityListItem,
  CommunityListQuery,
  CommunityInvitation,
  JoinRequest,
  CreatedInvitation,
  MyInvitation,
  ShareableInviteLink,
  PublicInvitation,
  CommunityMemberItem,
  CommunityRole,
  InvitationWriteData,
  CommunityMembersQuery,
  CommunityPostItem,
  PostComment,
  PostPoll,
  PostWriteData,
  CommunityProposalResult,
  CommunityRecommendationResult,
  // CommunitySettingsWriteData,
  ContentSuggestionResult,
  ManagedCommunity,
  ManagedRole,
  MyCommunityMembership,
  SanctionData,
} from './community.type';
import type { User } from '../user/user.type';
import { authBaseQuery } from '../authBaseQuery';

const MANAGED_ROLES: ManagedRole[] = ['owner', 'admin', 'moderator'];

/** The memberships that open /c/<slug> (owner, admin, moderator) */
export const isManaged = (m: MyCommunityMembership): m is ManagedCommunity => MANAGED_ROLES.includes(m.role as ManagedRole);

type StateWithUser = {
  user?: {
    user?: User | null;
  };
};

/** Drops empty filters so the api does not receive `?q=&category=` */
const cleanParams = (query: object) =>
  Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ''));

type RsvpPatchApi = {
  dispatch: (action: unknown) => { undo: () => void };
  getState: () => unknown;
  queryFulfilled: Promise<unknown>;
};

/**
 * Registration of the user to an event, shown before the api answers: their status and the
 * counter (attending only) in the cached lists and detail; undone if the api refuses
 */
async function patchRsvp({ dispatch, getState, queryFulfilled }: RsvpPatchApi, slug: string, eventId: string, next: RsvpStatus | null) {
  const apply = (event: CommunityEvent) => {
    const was = event.user_rsvp_status === 'attending';
    const will = next === 'attending';
    event.attendees_count = Math.max(0, event.attendees_count + (will && !was ? 1 : !will && was ? -1 : 0));
    event.user_rsvp_status = next;
  };
  const patches = [
    ...CommunityApi.util.selectCachedArgsForQuery(getState() as never, 'getCommunityEvents')
      .filter((args) => args.slug === slug)
      .map((args) =>
        dispatch(
          CommunityApi.util.updateQueryData('getCommunityEvents', args, (page) => {
            const event = page.results.find((e) => e.id === eventId);
            if (event) apply(event);
          }),
        ),
      ),
    dispatch(CommunityApi.util.updateQueryData('getCommunityEvent', { slug, eventId }, apply)),
  ];
  try {
    await queryFulfilled;
  } catch {
    patches.forEach((patch) => patch.undo());
  }
}

export const CommunityApi = createApi({
  reducerPath: 'communityApi',
  tagTypes: [
    'communities', 
    'categories', 
    'members', 
    'posts',
    'settings',
    'ai-settings',
    'events',
    'hackathons',
    'courses',
    'opportunities',
    'leaderboard',
    'projects',
    'invitations',
    'conversations',
    'messages',
    'notifications',
    'plans',
    'community-billing',
    'member-activity',
    'point-rules',
  ],
  baseQuery: authBaseQuery,
  endpoints: (builder) => ({
    getCommunities: builder.query<ApiPaginated<CommunityListItem>, CommunityListQuery>({
      query: (query) => ({ url: 'communities/', params: cleanParams(query) }),
      providesTags: ['communities'],
    }),
    /**
     * Directory of the home page, "Afficher plus" style: the pages of one search (same filters)
     * are appended in a single cache entry; changing a filter starts again from page 1.
     */
    discoverCommunities: builder.query<ApiPaginated<CommunityListItem>, CommunityListQuery>({
      query: (query) => ({ url: 'communities/', params: cleanParams(query) }),
      serializeQueryArgs: ({ endpointName, queryArgs }) => {
        const { page: _page, ...filters } = queryArgs;
        return `${endpointName}(${JSON.stringify(cleanParams(filters))})`;
      },
      merge: (current, incoming, { arg }) => {
        if ((arg.page ?? 1) <= 1) return incoming;
        const known = new Set(current.results.map((c) => c.id));
        current.results.push(...incoming.results.filter((c) => !known.has(c.id)));
        current.pagination = incoming.pagination;
        return current;
      },
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.page !== previousArg?.page,
      providesTags: ['communities'],
    }),
    // Admin: every category (inactive ones too), with its communities count
    getAdminCategories: builder.query<AdminCategoryItem[], void>({
      query: () => ({ url: 'communities/categories/', params: { include_inactive: true } }),
      transformResponse: unwrap<AdminCategoryItem[]>,
      providesTags: ['categories'],
    }),
    createCategory: builder.mutation<AdminCategoryItem, CategoryWriteData>({
      query: (body) => ({ url: 'communities/categories/', method: 'POST', body }),
      transformResponse: unwrap<AdminCategoryItem>,
      invalidatesTags: ['categories'],
    }),
    // currentSlug: the category to edit (its slug may change through `slug`)
    updateCategory: builder.mutation<AdminCategoryItem, { currentSlug: string } & CategoryWriteData>({
      query: ({ currentSlug, ...body }) => ({ url: `communities/categories/${currentSlug}/`, method: 'PATCH', body }),
      transformResponse: unwrap<AdminCategoryItem>,
      invalidatesTags: ['categories'],
    }),
    // hard_delete: removed for good (only sensible without communities); otherwise deactivated
    deleteCategory: builder.mutation<unknown, { slug: string; hard?: boolean }>({
      query: ({ slug, hard }) => ({ url: `communities/categories/${slug}/`, method: 'DELETE', params: hard ? { hard_delete: true } : {} }),
      invalidatesTags: ['categories'],
    }),
    getCommunityCategories: builder.query<CommunityCategory[], void>({
      query: () => 'communities/categories/',
      transformResponse: unwrap<CommunityCategory[]>,
      providesTags: ['categories'],
    }),
    getCommunity: builder.query<CommunityDetail, string>({
      query: (slug) => `communities/${slug}/`,
      transformResponse: unwrap<CommunityDetail>,
      providesTags: (_result, _error, slug) => [{ type: 'communities', id: slug }],
    }),
    //
    // Every active membership of the user, with the role (only the detail carries it)
    getMyCommunities: builder.query<MyCommunityMembership[], void>({
      async queryFn(_arg, _api, _extra, baseQuery) {
        const list = await baseQuery({ url: 'communities/my/', params: { page_size: 20 } });
        if (list.error) return { error: list.error };
        const items = (list.data as ApiPaginated<CommunityListItem>).results ?? [];
        const details = await Promise.all(items.map((c) => baseQuery(`communities/${c.slug}/`)));
        const failed = details.find((d) => d.error);
        if (failed?.error) return { error: failed.error as FetchBaseQueryError };
        const memberships = details.flatMap((d) => {
          const detail = (d.data as ApiSuccess<CommunityDetail>).data;
          const role = detail.user_membership?.role;
          return detail.user_membership?.is_member && role ? [{ community: detail, role: role as CommunityRole }] : [];
        });
        return { data: memberships };
      },
      providesTags: ['communities'],
    }),
    /**
     * Joins the community: active at once, or pending when the community approves its members.
     * A paid community needs an active subscription (the payment makes the member by itself).
     */
    joinCommunity: builder.mutation<CommunityMemberItem, string>({
      query: (slug) => ({ url: `communities/${slug}/join/`, method: 'POST' }),
      transformResponse: unwrap<CommunityMemberItem>,
      invalidatesTags: ['communities', 'members'],
    }),
    // The owner cannot leave (ownership transfer first)
    leaveCommunity: builder.mutation<unknown, string>({
      query: (slug) => ({ url: `communities/${slug}/leave/`, method: 'POST' }),
      invalidatesTags: ['communities', 'members'],
    }),
    // The bell of a community: its notifications reach the member, or not
    setCommunityNotifications: builder.mutation<{ notifications_enabled: boolean }, { slug: string; enabled: boolean }>({
      query: ({ slug, enabled }) => ({ url: `communities/${slug}/notifications/toggle/`, method: 'POST', body: { notifications_enabled: enabled } }),
      transformResponse: unwrap<{ notifications_enabled: boolean }>,
      async onQueryStarted({ slug }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(CommunityApi.util.updateQueryData('getCommunity', slug, (c) => void (c.notifications_enabled = data.notifications_enabled)));
        } catch {
          // the caller shows the error
        }
      },
    }),
    // Active plans of a paid community (public)
    getCommunityPlans: builder.query<CommunityPlan[], string>({
      query: (community) => ({ url: 'billing/plans/', params: { community } }),
      transformResponse: unwrap<CommunityPlan[]>,
      providesTags: ['plans'],
    }),
    // Kodinga Pro plans (no community): paid communities and their plans need it
    getProPlans: builder.query<CommunityPlan[], void>({
      query: () => 'billing/plans/',
      transformResponse: unwrap<CommunityPlan[]>,
      providesTags: ['plans'],
    }),
    // Plans of a community, for its owner and admins: the api lists the active ones only
    createPlan: builder.mutation<CommunityPlan, { community_id: string } & PlanWriteData>({
      query: (body) => ({ url: 'billing/plans/', method: 'POST', body }),
      transformResponse: unwrap<CommunityPlan>,
      // The detail of the community carries its plans (subscription_plans)
      invalidatesTags: ['plans', 'communities'],
    }),
    updatePlan: builder.mutation<CommunityPlan, { planId: string } & Partial<PlanWriteData>>({
      query: ({ planId, ...body }) => ({ url: `billing/plans/${planId}/`, method: 'PATCH', body }),
      transformResponse: unwrap<CommunityPlan>,
      // The detail of the community carries its plans (subscription_plans)
      invalidatesTags: ['plans', 'communities'],
    }),
    // No delete: the plan is no longer offered (subscribers keep it until the end of their period)
    deactivatePlan: builder.mutation<unknown, string>({
      query: (planId) => ({ url: `billing/plans/${planId}/`, method: 'DELETE' }),
      // The detail of the community carries its plans (subscription_plans)
      invalidatesTags: ['plans', 'communities'],
    }),
    // The signed-in member: subscriptions, payments, and the status of one payment
    getMySubscriptions: builder.query<MySubscription[], void>({
      query: () => 'billing/subscriptions/me/',
      transformResponse: unwrap<MySubscription[]>,
      providesTags: [{ type: 'communities', id: 'my-billing' }],
    }),
    getMyPayments: builder.query<MyPayment[], void>({
      query: () => 'billing/payments/my/',
      transformResponse: unwrap<MyPayment[]>,
      providesTags: [{ type: 'communities', id: 'my-billing' }],
    }),
    getPaymentStatus: builder.query<PaymentCheck, string>({
      query: (paymentId) => `billing/payments/${paymentId}/status/`,
      transformResponse: unwrap<PaymentCheck>,
    }),
    // Ends the subscription at the end of the paid period (no renewal): access stays until then
    cancelSubscription: builder.mutation<MySubscription, string>({
      query: (subscriptionId) => ({ url: `billing/subscriptions/${subscriptionId}/cancel/`, method: 'POST' }),
      transformResponse: unwrap<MySubscription>,
      invalidatesTags: [{ type: 'communities', id: 'my-billing' }],
    }),
    // Billing of a community for its owner (403 for anyone else): subscribers, payments, revenue, payouts
    getCommunitySubscribers: builder.query<CommunitySubscriber[], string>({
      query: (slug) => `billing/communities/${slug}/subscribers/`,
      transformResponse: unwrap<CommunitySubscriber[]>,
      providesTags: (_r, _e, slug) => [{ type: 'community-billing', id: slug }],
    }),
    getCommunityTransactions: builder.query<CommunityTransaction[], string>({
      query: (slug) => `billing/communities/${slug}/transactions/`,
      transformResponse: unwrap<CommunityTransaction[]>,
      providesTags: (_r, _e, slug) => [{ type: 'community-billing', id: slug }],
    }),
    getCommunityRevenue: builder.query<CommunityRevenue, string>({
      query: (slug) => `billing/communities/${slug}/revenue/`,
      transformResponse: unwrap<CommunityRevenue>,
      providesTags: (_r, _e, slug) => [{ type: 'community-billing', id: slug }],
    }),
    getCommunityPayouts: builder.query<CommunityPayout[], string>({
      query: (slug) => `billing/communities/${slug}/payouts/`,
      transformResponse: unwrap<CommunityPayout[]>,
      providesTags: (_r, _e, slug) => [{ type: 'community-billing', id: slug }],
    }),
    /**
     * Revenue of several communities of the owner (one revenue/ call each): for the overview of
     * /dashboard, until the api serves a total across communities
     */
    getOwnedRevenues: builder.query<CommunityRevenue[], string[]>({
      async queryFn(slugs, _api, _extra, baseQuery) {
        const answers = await Promise.all(slugs.map((slug) => baseQuery(`billing/communities/${slug}/revenue/`)));
        const failed = answers.find((a) => a.error);
        if (failed?.error) return { error: failed.error as FetchBaseQueryError };
        return { data: answers.map((a) => (a.data as ApiSuccess<CommunityRevenue>).data) };
      },
      providesTags: (_r, _e, slugs) => slugs.map((slug) => ({ type: 'community-billing' as const, id: slug })),
    }),
    // The amount leaves the available balance at once (the request is then handled by Kodinga)
    requestPayout: builder.mutation<CommunityPayout, { slug: string } & PayoutRequest>({
      query: ({ slug, ...body }) => ({ url: `billing/communities/${slug}/payouts/`, method: 'POST', body }),
      transformResponse: unwrap<CommunityPayout>,
      invalidatesTags: (_r, _e, { slug }) => [{ type: 'community-billing', id: slug }],
    }),
    // PayDunya session: the browser goes to checkout_url, then comes back to return_url
    createCheckout: builder.mutation<CheckoutSession, { plan_id: string; return_url?: string; cancel_url?: string; referral_code?: string }>({
      query: (body) => ({ url: 'billing/checkout/', method: 'POST', body }),
      transformResponse: unwrap<CheckoutSession>,
    }),
    // Media upload, step 1 and 3 (step 2 sends the file to upload_url: see utils/api/media/upload.ts)
    requestUploadUrl: builder.mutation<UploadTarget, UploadUrlRequest>({
      query: (body) => ({ url: 'media/upload-url/', method: 'POST', body }),
      transformResponse: unwrap<UploadTarget>,
    }),
    confirmUpload: builder.mutation<MediaAsset, { file_key: string; file_url: string; file_size?: number }>({
      query: (body) => ({ url: 'media/confirm-upload/', method: 'POST', body }),
      transformResponse: unwrap<MediaAsset>,
    }),
    // Messaging: raw responses (no envelope), participants only. No realtime: the pages poll
    getConversations: builder.query<Conversation[], void>({
      query: () => 'conversations/',
      // A list today; tolerate a paginated answer ({ results }) so the header badge never breaks
      transformResponse: (response: unknown) =>
        Array.isArray(response) ? (response as Conversation[]) : ((response as { results?: Conversation[] } | null)?.results ?? []),
      providesTags: ['conversations'],
    }),
    getConversation: builder.query<Conversation, string>({
      query: (conversationId) => `conversations/${conversationId}/`,
      providesTags: (_result, _error, id) => [{ type: 'conversations', id }],
    }),
    // Opens the direct conversation with a user (the existing one when there is one)
    startConversation: builder.mutation<Conversation, string>({
      query: (recipient_id) => ({ url: 'conversations/', method: 'POST', body: { conversation_type: 'direct', recipient_id } }),
      invalidatesTags: ['conversations'],
    }),
    getMessages: builder.query<ChatMessage[], string>({
      query: (conversationId) => `conversations/${conversationId}/messages/`,
      providesTags: (_result, _error, id) => [{ type: 'messages', id }],
    }),
    sendMessage: builder.mutation<ChatMessage, { conversationId: string; content: string }>({
      query: ({ conversationId, content }) => ({ url: `conversations/${conversationId}/messages/`, method: 'POST', body: { content } }),
      async onQueryStarted({ conversationId, content }, { dispatch, getState, queryFulfilled }) {
        const state = getState() as StateWithUser;
        const currentUser = state.user?.user;
        const tempId = `temp-msg-${Date.now()}`;
        const optimisticMsg: ChatMessage = {
          id: tempId,
          conversation_id: conversationId,
          sender: {
            id: currentUser?.id ?? 'me',
            username: currentUser?.username ?? 'moi',
            first_name: currentUser?.first_name ?? '',
            last_name: currentUser?.last_name ?? '',
            avatar_url: currentUser?.avatar ?? '',
          },
          content,
          is_edited: false,
          is_deleted: false,
          is_pinned: false,
          deleted_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const msgPatch = dispatch(
          CommunityApi.util.updateQueryData('getMessages', conversationId, (messages) => {
            messages.push(optimisticMsg);
          }),
        );

        const convPatch = dispatch(
          CommunityApi.util.updateQueryData('getConversations', undefined, (conversations) => {
            const conv = conversations.find((c) => c.id === conversationId);
            if (conv) {
              conv.last_message_at = optimisticMsg.created_at;
              conv.last_message = {
                id: tempId,
                sender_username: currentUser?.username ?? 'moi',
                content,
                created_at: optimisticMsg.created_at,
              };
            }
          }),
        );

        try {
          const { data: createdMsg } = await queryFulfilled;
          dispatch(
            CommunityApi.util.updateQueryData('getMessages', conversationId, (messages) => {
              const idx = messages.findIndex((m) => m.id === tempId);
              if (idx !== -1) messages[idx] = createdMsg;
            }),
          );
        } catch {
          msgPatch.undo();
          convPatch.undo();
        }
      },
    }),
    markConversationRead: builder.mutation<unknown, string>({
      query: (conversationId) => ({ url: `conversations/${conversationId}/read/`, method: 'POST' }),
      invalidatesTags: ['conversations'],
    }),
    // Own messages only
    editMessage: builder.mutation<ChatMessage, { conversationId: string; messageId: string; content: string }>({
      query: ({ messageId, content }) => ({ url: `messages/${messageId}/`, method: 'PATCH', body: { content } }),
      async onQueryStarted({ conversationId, messageId, content }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          CommunityApi.util.updateQueryData('getMessages', conversationId, (messages) => {
            const m = messages.find((item) => item.id === messageId);
            if (m) {
              m.content = content;
              m.is_edited = true;
            }
          }),
        );
        try {
          const { data: updatedMsg } = await queryFulfilled;
          dispatch(
            CommunityApi.util.updateQueryData('getMessages', conversationId, (messages) => {
              const idx = messages.findIndex((item) => item.id === messageId);
              if (idx !== -1) messages[idx] = updatedMsg;
            }),
          );
        } catch {
          patch.undo();
        }
      },
    }),
    deleteMessage: builder.mutation<unknown, { conversationId: string; messageId: string }>({
      query: ({ messageId }) => ({ url: `messages/${messageId}/`, method: 'DELETE' }),
      async onQueryStarted({ conversationId, messageId }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          CommunityApi.util.updateQueryData('getMessages', conversationId, (messages) => {
            const m = messages.find((item) => item.id === messageId);
            if (m) {
              m.is_deleted = true;
              m.content = '[Ce message a été supprimé]';
            }
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),
    // Signed-in users only; the api makes the creator the owner (active membership)
    createCommunity: builder.mutation<CommunityDetail, CommunityCreateData>({
      query: (body) => ({ url: 'communities/', method: 'POST', body }),
      transformResponse: unwrap<CommunityDetail>,
      invalidatesTags: ['communities'],
    }),
    // Members of a community: moderators and above (superusers everywhere)
    getCommunityMembers: builder.query<ApiPaginated<CommunityMemberItem>, CommunityMembersQuery>({
      query: ({ slug, ...params }) => ({ url: `communities/${slug}/members/`, params: cleanParams(params) }),
      providesTags: ['members'],
    }),
    /**
     * Join dates of the active members, for the growth chart of the dashboard. The api has no
     * statistics per community and sorts members by reputation: the pages are read up to `max`.
     */
    getCommunityMemberJoins: builder.query<{ joined_at: string[]; total: number; complete: boolean }, { slug: string; max?: number }>({
      async queryFn({ slug, max = 500 }, _api, _extra, baseQuery) {
        const joined_at: string[] = [];
        let total = 0;
        for (let page = 1; joined_at.length < max; page += 1) {
          const result = await baseQuery({ url: `communities/${slug}/members/`, params: { status: 'active', page, page_size: 100 } });
          if (result.error) return { error: result.error };
          const data = result.data as ApiPaginated<CommunityMemberItem>;
          total = data.pagination.count;
          joined_at.push(...data.results.map((m) => m.joined_at));
          if (joined_at.length >= total || data.results.length === 0) break;
        }
        return { data: { joined_at, total, complete: joined_at.length >= total } };
      },
      providesTags: ['members'],
    }),
    /**
     * Pending join requests of several communities (one members?status=pending call each, 20 per
     * community, oldest first): for the notification center, until the api notifies them
     */
    getJoinRequests: builder.query<JoinRequest[], { slug: string; name: string }[]>({
      async queryFn(communities, _api, _extra, baseQuery) {
        const answers = await Promise.all(
          communities.map((c) => baseQuery({ url: `communities/${c.slug}/members/`, params: { status: 'pending', page_size: 20 } })),
        );
        const failed = answers.find((a) => a.error);
        if (failed?.error) return { error: failed.error as FetchBaseQueryError };
        const requests = answers.flatMap((a, i) =>
          ((a.data as ApiPaginated<CommunityMemberItem>).results ?? []).map((member) => ({ community: communities[i], member })),
        );
        return { data: requests.sort((x, y) => x.member.created_at.localeCompare(y.member.created_at)) };
      },
      providesTags: ['members'],
    }),
    decideMember: builder.mutation<CommunityMemberItem, { slug: string; memberId: string; approve: boolean }>({
      query: ({ slug, memberId, approve }) => ({ url: `communities/${slug}/members/${memberId}/`, method: 'PUT', body: { approve } }),
      transformResponse: unwrap<CommunityMemberItem>,
      invalidatesTags: ['members', 'communities'],
    }),
    // Owner and admins only; only the owner gives the "owner" role (ownership transfer)
    changeMemberRole: builder.mutation<CommunityMemberItem, { slug: string; memberId: string; role: CommunityRole }>({
      query: ({ slug, memberId, role }) => ({ url: `communities/${slug}/members/${memberId}/`, method: 'PATCH', body: { role } }),
      transformResponse: unwrap<CommunityMemberItem>,
      invalidatesTags: ['members'],
    }),
    sanctionMember: builder.mutation<unknown, SanctionData>({
      query: ({ slug, memberId, ...body }) => ({ url: `communities/${slug}/members/${memberId}/sanctions/`, method: 'POST', body }),
      invalidatesTags: ['members', 'communities'],
    }),
    // Invitations of the community, most recent first (owner and admins): the 100 latest
    getCommunityInvitations: builder.query<CommunityInvitation[], string>({
      query: (slug) => ({ url: `communities/${slug}/invitations/`, params: { page_size: 100 } }),
      transformResponse: (response: ApiPaginated<CommunityInvitation> | ApiSuccess<CommunityInvitation[]>) =>
        'results' in response ? (response.results ?? []) : (response.data ?? []),
      providesTags: ['invitations'],
    }),
    // With an email, the api sends the invitation (30 days at most, for one person)
    createInvitation: builder.mutation<CreatedInvitation, InvitationWriteData & { slug: string }>({
      query: ({ slug, ...body }) => ({ url: `communities/${slug}/invitations/`, method: 'POST', body }),
      transformResponse: unwrap<CreatedInvitation>,
      invalidatesTags: ['invitations'],
    }),
    // The link stops working at once
    revokeInvitation: builder.mutation<CommunityInvitation, { slug: string; invitationId: string }>({
      query: ({ slug, invitationId }) => ({ url: `workspaces/${slug}/invitations/${invitationId}/`, method: 'DELETE' }),
      transformResponse: unwrap<CommunityInvitation>,
      invalidatesTags: ['invitations'],
    }),
    // A new link (the former one stops working), valid 7 more days, sent again by email
    resendInvitation: builder.mutation<CommunityInvitation & { raw_token: string }, { slug: string; invitationId: string }>({
      query: ({ slug, invitationId }) => ({ url: `workspaces/${slug}/invitations/${invitationId}/resend/`, method: 'POST' }),
      transformResponse: unwrap<CommunityInvitation & { raw_token: string }>,
      invalidatesTags: ['invitations'],
    }),
    // What an invitation sent by email is about, before signing in (404 for a shareable link)
    getPublicInvitation: builder.query<PublicInvitation, string>({
      query: (token) => `invitations/${encodeURIComponent(token)}/`,
      transformResponse: unwrap<PublicInvitation>,
    }),
    // The signed-in user joins with the role of the invitation (no approval, no subscription)
    acceptInvitation: builder.mutation<CommunityMemberItem, string>({
      query: (invite_code) => ({ url: 'invitations/accept/', method: 'POST', body: { invite_code } }),
      transformResponse: unwrap<CommunityMemberItem>,
      invalidatesTags: ['members', 'communities'],
    }),
    // By the token of a link or the id of an invitation. The route that keeps a shareable link reusable
    // (invitations/accept/ would consume it at its first use)
    acceptInvitationByToken: builder.mutation<CommunityMemberItem, string>({
      query: (token) => ({ url: `invitations/${encodeURIComponent(token)}/accept/`, method: 'POST' }),
      transformResponse: unwrap<CommunityMemberItem>,
      invalidatesTags: ['members', 'communities', 'invitations'],
    }),
    // Only for an invitation by email: a shareable link would be closed for everyone
    declineInvitation: builder.mutation<unknown, string>({
      query: (token) => ({ url: `invitations/${encodeURIComponent(token)}/decline/`, method: 'POST' }),
      invalidatesTags: ['invitations'],
    }),
    // Invitations received at the address of the user (pending by default)
    getMyInvitations: builder.query<MyInvitation[], void>({
      query: () => ({ url: 'invitations/my/', params: { page_size: 100 } }),
      transformResponse: (response: ApiPaginated<MyInvitation>) => response.results ?? [],
      providesTags: ['invitations'],
    }),
    // Created at the first call for a role, then the same link until it is revoked or expires
    createShareLink: builder.mutation<ShareableInviteLink, { slug: string; role: CommunityRole }>({
      query: ({ slug, role }) => ({ url: `communities/${slug}/invitations/share-link/`, method: 'POST', body: { role } }),
      transformResponse: unwrap<ShareableInviteLink>,
      invalidatesTags: ['invitations'],
    }),
    getCommunityFeed: builder.query<ApiPaginated<CommunityPostItem>, CommunityFeedQuery>({
      query: ({ slug, ...params }) => ({ url: `communities/${slug}/feed/`, params: cleanParams(params) }),
      providesTags: ['posts'],
    }),
    // Active members (community settings may keep it to the team); the author edits it afterwards
    createPost: builder.mutation<CommunityPostItem, PostWriteData & { slug: string }>({
      query: ({ slug, ...body }) => ({ url: `communities/${slug}/feed/`, method: 'POST', body }),
      transformResponse: unwrap<CommunityPostItem>,
      invalidatesTags: ['communities'],
      async onQueryStarted({ slug, ...body }, { dispatch, getState, queryFulfilled }) {
        const state = getState() as StateWithUser;
        const currentUser = state.user?.user ?? {
          id: 'me',
          username: 'moi',
          email: 'user@example.com',
          first_name: 'Moi',
          last_name: '',
          full_name: 'Moi',
          is_active: true,
          is_email_verified: true,
          preferred_language: 'fr',
          timezone: 'UTC',
          date_joined: new Date().toISOString(),
          last_login: null,
        };

        const tempId = `temp-post-${Date.now()}`;
        const optimisticPost: CommunityPostItem = {
          id: tempId,
          community_id: '',
          author: currentUser,
          title: body.title,
          content: body.content,
          post_type: body.post_type,
          code_snippet: body.code_snippet,
          code_language: body.code_language,
          user_reactions: [],
          poll: body.poll
            ? {
                id: `temp-poll-${Date.now()}`,
                // Like PostService.create_post: the title of the post, else "Sondage"
                question: body.poll.question ?? (body.title || 'Sondage'),
                is_multiple_choice: body.poll.is_multiple_choice,
                expires_at: null,
                total_votes: 0,
                is_expired: false,
                user_has_voted: false,
                user_voted_option_ids: [],
                options: (body.poll.options ?? []).map((text, idx) => ({
                  id: `temp-opt-${idx}`,
                  text,
                  votes_count: 0,
                  percentage: 0,
                  order: idx,
                })),
              }
            : null,
          is_pinned: false,
          is_locked: false,
          is_resolved: false,
          views_count: 0,
          reactions_count: 0,
          comments_count: 0,
          created_at: new Date().toISOString(),
        };

        const cachedArgs = CommunityApi.util.selectCachedArgsForQuery(getState() as never, 'getCommunityFeed')
          .filter((args) => args.slug === slug);

        const patches = cachedArgs.map((args) =>
          dispatch(
            CommunityApi.util.updateQueryData('getCommunityFeed', args, (feed) => {
              feed.results.unshift(optimisticPost);
              if (feed.pagination) feed.pagination.count += 1;
            }),
          ),
        );

        try {
          const { data: createdPost } = await queryFulfilled;
          cachedArgs.forEach((args) => {
            dispatch(
              CommunityApi.util.updateQueryData('getCommunityFeed', args, (feed) => {
                const idx = feed.results.findIndex((p) => p.id === tempId);
                if (idx !== -1) {
                  feed.results[idx] = createdPost;
                }
              }),
            );
          });
        } catch {
          patches.forEach((patch) => patch.undo());
        }
      },
    }),
    updatePost: builder.mutation<CommunityPostItem, Partial<Omit<PostWriteData, 'poll'>> & { postId: string }>({
      query: ({ postId, ...body }) => ({ url: `posts/${postId}/`, method: 'PATCH', body }),
      transformResponse: unwrap<CommunityPostItem>,
      async onQueryStarted({ postId, ...body }, { dispatch, getState, queryFulfilled }) {
        const patchDetail = dispatch(
          CommunityApi.util.updateQueryData('getPost', postId, (post) => {
            Object.assign(post, body);
          }),
        );
        const cachedArgs = CommunityApi.util.selectCachedArgsForQuery(getState() as never, 'getCommunityFeed');
        const feedPatches = cachedArgs.map((args) =>
          dispatch(
            CommunityApi.util.updateQueryData('getCommunityFeed', args, (feed) => {
              const p = feed.results.find((item) => item.id === postId);
              if (p) Object.assign(p, body);
            }),
          ),
        );
        try {
          const { data: updatedPost } = await queryFulfilled;
          dispatch(CommunityApi.util.updateQueryData('getPost', postId, (post) => Object.assign(post, updatedPost)));
          cachedArgs.forEach((args) => {
            dispatch(
              CommunityApi.util.updateQueryData('getCommunityFeed', args, (feed) => {
                const idx = feed.results.findIndex((item) => item.id === postId);
                if (idx !== -1) feed.results[idx] = updatedPost;
              }),
            );
          });
        } catch {
          patchDetail.undo();
          feedPatches.forEach((p) => p.undo());
        }
      },
    }),
    // Like / unlike (signed-in users): the cached feeds are patched, no new GET
    togglePostLike: builder.mutation<{ reacted: boolean }, string>({
      query: (postId) => ({ url: `posts/${postId}/react/`, method: 'POST', body: { reaction_type: 'like' } }),
      transformResponse: unwrap<{ reacted: boolean }>,
      async onQueryStarted(postId, { dispatch, getState, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            CommunityApi.util.updateQueryData('getPost', postId, (post) => {
              const others = (post.user_reactions ?? []).filter((r) => r !== 'like');
              post.user_reactions = data.reacted ? [...others, 'like'] : others;
              post.reactions_count = Math.max(0, post.reactions_count + (data.reacted ? 1 : -1));
            }),
          );
          for (const args of CommunityApi.util.selectCachedArgsForQuery(getState(), 'getCommunityFeed')) {
            dispatch(
              CommunityApi.util.updateQueryData('getCommunityFeed', args, (feed) => {
                const post = feed.results.find((p) => p.id === postId);
                if (!post) return;
                const others = (post.user_reactions ?? []).filter((r) => r !== 'like');
                post.user_reactions = data.reacted ? [...others, 'like'] : others;
                post.reactions_count = Math.max(0, post.reactions_count + (data.reacted ? 1 : -1));
              }),
            );
          }
        } catch {
          // the caller shows the error
        }
      },
    }),
    // Saves or unsaves a post for the signed-in user: the cached post and feeds are patched
    toggleBookmark: builder.mutation<{ is_bookmarked: boolean }, string>({
      query: (postId) => ({ url: `posts/${postId}/bookmark/`, method: 'POST' }),
      transformResponse: unwrap<{ is_bookmarked: boolean }>,
      async onQueryStarted(postId, { dispatch, getState, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(CommunityApi.util.updateQueryData('getPost', postId, (post) => void (post.is_bookmarked = data.is_bookmarked)));
          for (const args of CommunityApi.util.selectCachedArgsForQuery(getState(), 'getCommunityFeed')) {
            dispatch(
              CommunityApi.util.updateQueryData('getCommunityFeed', args, (feed) => {
                const post = feed.results.find((p) => p.id === postId);
                if (!post) return;
                post.is_bookmarked = data.is_bookmarked;
                // Unsaved from the list of the saved ones: it leaves it
                if (args.bookmarked && !data.is_bookmarked) {
                  feed.results = feed.results.filter((p) => p.id !== postId);
                  feed.pagination.count = Math.max(0, feed.pagination.count - 1);
                }
              }),
            );
          }
        } catch {
          // the caller shows the error
        }
      },
    }),
    // Members; a new vote replaces the previous one. The answered poll patches the cached post and feeds
    votePoll: builder.mutation<PostPoll, { postId: string; option_ids: string[] }>({
      query: ({ postId, option_ids }) => ({ url: `posts/${postId}/vote/`, method: 'POST', body: { option_ids } }),
      transformResponse: unwrap<PostPoll>,
      async onQueryStarted({ postId }, { dispatch, getState, queryFulfilled }) {
        try {
          const { data: poll } = await queryFulfilled;
          dispatch(CommunityApi.util.updateQueryData('getPost', postId, (post) => void (post.poll = poll)));
          for (const args of CommunityApi.util.selectCachedArgsForQuery(getState(), 'getCommunityFeed')) {
            dispatch(
              CommunityApi.util.updateQueryData('getCommunityFeed', args, (feed) => {
                const post = feed.results.find((p) => p.id === postId);
                if (post) post.poll = poll;
              }),
            );
          }
        } catch {
          // the caller shows the error
        }
      },
    }),
    // One post (counts a view), with its comments: accepted answer first (GET posts/<id>/comments/)
    getPost: builder.query<CommunityPostItem, string>({
      query: (postId) => `posts/${postId}/`,
      transformResponse: unwrap<CommunityPostItem>,
      providesTags: (_result, _error, postId) => [{ type: 'posts', id: postId }],
    }),
    getPostComments: builder.query<PostComment[], string>({
      query: (postId) => `posts/${postId}/comments/`,
      transformResponse: unwrap<PostComment[]>,
      providesTags: (_result, _error, postId) => [{ type: 'posts', id: `${postId}-comments` }],
    }),
    // Active members; closed when the post is locked. parent_id answers a comment (one level)
    addPostComment: builder.mutation<PostComment, { postId: string; content: string; parent_id?: string }>({
      query: ({ postId, ...body }) => ({ url: `posts/${postId}/comments/`, method: 'POST', body }),
      transformResponse: unwrap<PostComment>,
      async onQueryStarted({ postId, content, parent_id }, { dispatch, getState, queryFulfilled }) {
        const state = getState() as StateWithUser;
        const currentUser = state.user?.user ?? {
          id: 'me',
          username: 'moi',
          email: 'user@example.com',
          first_name: 'Moi',
          last_name: '',
          full_name: 'Moi',
          is_active: true,
          is_email_verified: true,
          preferred_language: 'fr',
          timezone: 'UTC',
          date_joined: new Date().toISOString(),
          last_login: null,
        };

        const tempCommentId = `temp-cmt-${Date.now()}`;
        const optimisticComment: PostComment = {
          id: tempCommentId,
          post_id: postId,
          parent_id: parent_id ?? null,
          author: currentUser,
          content,
          is_accepted_answer: false,
          reactions_count: 0,
          user_reactions: [],
          replies: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const commentsPatch = dispatch(
          CommunityApi.util.updateQueryData('getPostComments', postId, (comments) => {
            if (parent_id) {
              const parent = comments.find((c) => c.id === parent_id);
              if (parent) {
                parent.replies = parent.replies ?? [];
                parent.replies.unshift(optimisticComment);
                return;
              }
            }
            if (comments.length > 0 && comments[0].is_accepted_answer) {
              comments.splice(1, 0, optimisticComment);
            } else {
              comments.unshift(optimisticComment);
            }
          }),
        );

        const postPatch = dispatch(
          CommunityApi.util.updateQueryData('getPost', postId, (post) => {
            post.comments_count = (post.comments_count ?? 0) + 1;
          }),
        );

        const feedArgs = CommunityApi.util.selectCachedArgsForQuery(getState() as never, 'getCommunityFeed');
        const feedPatches = feedArgs.map((args) =>
          dispatch(
            CommunityApi.util.updateQueryData('getCommunityFeed', args, (feed) => {
              const p = feed.results.find((item) => item.id === postId);
              if (p) p.comments_count = (p.comments_count ?? 0) + 1;
            }),
          ),
        );

        try {
          const { data: createdComment } = await queryFulfilled;
          dispatch(
            CommunityApi.util.updateQueryData('getPostComments', postId, (comments) => {
              if (parent_id) {
                const parent = comments.find((c) => c.id === parent_id);
                if (parent?.replies) {
                  const idx = parent.replies.findIndex((r) => r.id === tempCommentId);
                  if (idx !== -1) {
                    parent.replies[idx] = createdComment;
                    return;
                  }
                }
              }
              const idx = comments.findIndex((c) => c.id === tempCommentId);
              if (idx !== -1) comments[idx] = createdComment;
            }),
          );
        } catch {
          commentsPatch.undo();
          postPatch.undo();
          feedPatches.forEach((p) => p.undo());
        }
      },
    }),
    // The author, or the moderators of the community
    deletePostComment: builder.mutation<unknown, { postId: string; commentId: string }>({
      query: ({ commentId }) => ({ url: `comments/${commentId}/`, method: 'DELETE' }),
      async onQueryStarted({ postId, commentId }, { dispatch, getState, queryFulfilled }) {
        const commentsPatch = dispatch(
          CommunityApi.util.updateQueryData('getPostComments', postId, (comments) => {
            const idx = comments.findIndex((c) => c.id === commentId);
            if (idx !== -1) {
              comments.splice(idx, 1);
              return;
            }
            for (const parent of comments) {
              if (parent.replies) {
                const rIdx = parent.replies.findIndex((r) => r.id === commentId);
                if (rIdx !== -1) {
                  parent.replies.splice(rIdx, 1);
                  return;
                }
              }
            }
          }),
        );

        const postPatch = dispatch(
          CommunityApi.util.updateQueryData('getPost', postId, (post) => {
            post.comments_count = Math.max(0, (post.comments_count ?? 1) - 1);
          }),
        );

        const feedArgs = CommunityApi.util.selectCachedArgsForQuery(getState() as never, 'getCommunityFeed');
        const feedPatches = feedArgs.map((args) =>
          dispatch(
            CommunityApi.util.updateQueryData('getCommunityFeed', args, (feed) => {
              const p = feed.results.find((item) => item.id === postId);
              if (p) p.comments_count = Math.max(0, (p.comments_count ?? 1) - 1);
            }),
          ),
        );

        try {
          await queryFulfilled;
        } catch {
          commentsPatch.undo();
          postPatch.undo();
          feedPatches.forEach((p) => p.undo());
        }
      },
    }),
    toggleCommentLike: builder.mutation<{ reacted: boolean }, { postId: string; commentId: string }>({
      query: ({ commentId }) => ({ url: `comments/${commentId}/react/`, method: 'POST', body: { reaction_type: 'like' } }),
      transformResponse: unwrap<{ reacted: boolean }>,
      async onQueryStarted({ postId, commentId }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            CommunityApi.util.updateQueryData('getPostComments', postId, (comments) => {
              const update = (c: PostComment) => {
                const others = (c.user_reactions ?? []).filter((r) => r !== 'like');
                c.user_reactions = data.reacted ? [...others, 'like'] : others;
                c.reactions_count = Math.max(0, c.reactions_count + (data.reacted ? 1 : -1));
              };
              const top = comments.find((c) => c.id === commentId);
              if (top) {
                update(top);
                return;
              }
              for (const p of comments) {
                const rep = (p.replies ?? []).find((r) => r.id === commentId);
                if (rep) {
                  update(rep);
                  return;
                }
              }
            }),
          );
        } catch {
          // ignore
        }
      },
    }),
    // Only the author of the post: replaces a previous accepted answer, the post becomes resolved
    acceptAnswer: builder.mutation<PostComment, { postId: string; commentId: string }>({
      query: ({ commentId }) => ({ url: `comments/${commentId}/accept/`, method: 'POST' }),
      transformResponse: unwrap<PostComment>,
      async onQueryStarted({ postId, commentId }, { dispatch, queryFulfilled }) {
        const patchComments = dispatch(
          CommunityApi.util.updateQueryData('getPostComments', postId, (comments) => {
            comments.forEach((c) => {
              c.is_accepted_answer = c.id === commentId;
            });
            comments.sort((a, b) => {
              if (a.is_accepted_answer && !b.is_accepted_answer) return -1;
              if (!a.is_accepted_answer && b.is_accepted_answer) return 1;
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });
          }),
        );
        const patchPost = dispatch(
          CommunityApi.util.updateQueryData('getPost', postId, (post) => {
            post.is_resolved = true;
          }),
        );
        try {
          const { data: accepted } = await queryFulfilled;
          dispatch(
            CommunityApi.util.updateQueryData('getPostComments', postId, (comments) => {
              comments.forEach((c) => {
                c.is_accepted_answer = c.id === accepted.id;
              });
              comments.sort((a, b) => {
                if (a.is_accepted_answer && !b.is_accepted_answer) return -1;
                if (!a.is_accepted_answer && b.is_accepted_answer) return 1;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              });
            }),
          );
        } catch {
          patchComments.undo();
          patchPost.undo();
        }
      },
    }),
    togglePostPin: builder.mutation<unknown, string>({
      query: (postId) => ({ url: `posts/${postId}/pin/`, method: 'POST' }),
      invalidatesTags: ['posts'],
    }),
    togglePostLock: builder.mutation<unknown, string>({
      query: (postId) => ({ url: `posts/${postId}/lock/`, method: 'POST' }),
      invalidatesTags: ['posts'],
    }),
    deletePost: builder.mutation<unknown, string>({
      query: (postId) => ({ url: `posts/${postId}/`, method: 'DELETE' }),
      async onQueryStarted(postId, { dispatch, getState, queryFulfilled }) {
        const cachedArgs = CommunityApi.util.selectCachedArgsForQuery(getState() as never, 'getCommunityFeed');
        const patches = cachedArgs.map((args) =>
          dispatch(
            CommunityApi.util.updateQueryData('getCommunityFeed', args, (feed) => {
              const idx = feed.results.findIndex((p) => p.id === postId);
              if (idx !== -1) {
                feed.results.splice(idx, 1);
                if (feed.pagination) feed.pagination.count = Math.max(0, feed.pagination.count - 1);
              }
            }),
          ),
        );
        try {
          await queryFulfilled;
        } catch {
          patches.forEach((patch) => patch.undo());
        }
      },
      invalidatesTags: ['communities'],
    }),
    // Events of a community (apps/events): owner, admins and the host manage them
    getCommunityEvents: builder.query<ApiPaginated<CommunityEvent>, EventsQuery>({
      query: ({ slug, ...params }) => ({ url: `communities/${slug}/events/`, params: cleanParams(params) }),
      providesTags: ['events'],
    }),
    getCommunityEvent: builder.query<CommunityEvent, { slug: string; eventId: string }>({
      query: ({ slug, eventId }) => `communities/${slug}/events/${eventId}/`,
      transformResponse: unwrap<CommunityEvent>,
      providesTags: (_result, _error, { eventId }) => [{ type: 'events', id: eventId }],
    }),
    createEvent: builder.mutation<CommunityEvent, { slug: string } & EventWriteData>({
      query: ({ slug, ...body }) => ({ url: `communities/${slug}/events/`, method: 'POST', body }),
      transformResponse: unwrap<CommunityEvent>,
      invalidatesTags: ['events'],
    }),
    updateEvent: builder.mutation<CommunityEvent, { slug: string; eventId: string } & Partial<EventWriteData>>({
      query: ({ slug, eventId, ...body }) => ({ url: `communities/${slug}/events/${eventId}/`, method: 'PATCH', body }),
      transformResponse: unwrap<CommunityEvent>,
      invalidatesTags: ['events'],
    }),
    deleteEvent: builder.mutation<unknown, { slug: string; eventId: string }>({
      query: ({ slug, eventId }) => ({ url: `communities/${slug}/events/${eventId}/`, method: 'DELETE' }),
      invalidatesTags: ['events'],
    }),
    // live (start), completed (end), cancelled
    updateEventStatus: builder.mutation<CommunityEvent, { slug: string; eventId: string; status: EventStatus }>({
      query: ({ slug, eventId, status }) => ({ url: `communities/${slug}/events/${eventId}/status/`, method: 'POST', body: { status } }),
      transformResponse: unwrap<CommunityEvent>,
      invalidatesTags: ['events'],
    }),
    // Replay of an event: a video created on the api (Mux direct upload), then attached to the event
    createVideoUpload: builder.mutation<VideoUploadTarget, { title: string; cors_origin: string }>({
      query: (body) => ({ url: 'media/videos/upload-url/', method: 'POST', body }),
      transformResponse: unwrap<VideoUploadTarget>,
    }),
    attachEventReplay: builder.mutation<CommunityEvent, { slug: string; eventId: string; video_asset_id?: string; video_url?: string; file?: File | Blob }>({
      query: ({ slug, eventId, video_asset_id, video_url, file }) => {
        if (file) {
          const formData = new FormData();
          formData.append('video', file, (file as File).name || 'recording.webm');
          return { url: `communities/${slug}/events/${eventId}/replay/`, method: 'POST', body: formData };
        }
        return {
          url: `communities/${slug}/events/${eventId}/replay/`,
          method: 'POST',
          body: { ...(video_asset_id ? { video_asset_id } : {}), ...(video_url ? { video_url } : {}) },
        };
      },
      transformResponse: unwrap<CommunityEvent>,
      invalidatesTags: (_result, _error, { eventId }) => ['events', { type: 'events', id: eventId }],
    }),
    // AI Live Replay: Asynchronous Transcription, Executive Summary & Grounded Chat with Docs
    transcribeEventLive: builder.mutation<LiveTranscriptionResponse, { slug: string; eventId: string; force?: boolean; language?: string }>({
      query: ({ slug, eventId, ...body }) => ({ url: `communities/${slug}/events/${eventId}/transcribe/`, method: 'POST', body }),
      transformResponse: unwrap<LiveTranscriptionResponse>,
      invalidatesTags: (_result, _error, { eventId }) => ['events', { type: 'events', id: eventId }, { type: 'events', id: `${eventId}-transcription` }],
    }),
    getEventTranscription: builder.query<LiveTranscriptionResponse, { slug: string; eventId: string }>({
      query: ({ slug, eventId }) => `communities/${slug}/events/${eventId}/transcription/`,
      transformResponse: unwrap<LiveTranscriptionResponse>,
      providesTags: (_result, _error, { eventId }) => [{ type: 'events', id: `${eventId}-transcription` }],
    }),
    generateEventSummary: builder.mutation<{ summary: LiveEventSummary }, { slug: string; eventId: string }>({
      query: ({ slug, eventId }) => ({ url: `communities/${slug}/events/${eventId}/summary/`, method: 'POST' }),
      transformResponse: unwrap<{ summary: LiveEventSummary }>,
      invalidatesTags: (_result, _error, { eventId }) => ['events', { type: 'events', id: eventId }, { type: 'events', id: `${eventId}-transcription` }],
    }),
    chatEventTranscript: builder.mutation<ChatTranscriptResponse, ChatTranscriptRequest>({
      query: ({ slug, eventId, ...body }) => ({ url: `communities/${slug}/events/${eventId}/chat-transcript/`, method: 'POST', body }),
      transformResponse: unwrap<ChatTranscriptResponse>,
    }),
    // Every attendee at once (?all=true): the api has no search, the page searches them
    getAllEventAttendees: builder.query<EventAttendee[], { slug: string; eventId: string }>({
      query: ({ slug, eventId }) => ({ url: `communities/${slug}/events/${eventId}/attendees/`, params: { all: true } }),
      transformResponse: unwrap<EventAttendee[]>,
      providesTags: (_result, _error, { eventId }) => [{ type: 'events', id: `${eventId}-attendees` }],
    }),
    /**
     * Confirms the presence of a participant (the host or a manager of the events): they earn the
     * points of "event_attended"
     */
    checkInAttendee: builder.mutation<EventAttendee, { slug: string; eventId: string; userId: string }>({
      query: ({ slug, eventId, userId }) => ({ url: `communities/${slug}/events/${eventId}/check-in/`, method: 'POST', body: { user_id: userId } }),
      transformResponse: unwrap<EventAttendee>,
      invalidatesTags: (_r, _e, { eventId }) => [{ type: 'events', id: `${eventId}-attendees` }, 'leaderboard'],
    }),
    getEventAttendees: builder.query<ApiPaginated<EventAttendee>, { slug: string; eventId: string; page?: number; page_size?: number }>({
      query: ({ slug, eventId, ...params }) => ({ url: `communities/${slug}/events/${eventId}/attendees/`, params: cleanParams(params) }),
      providesTags: (_result, _error, { eventId }) => [{ type: 'events', id: `${eventId}-attendees` }],
    }),
    // A member (or anyone, for a public event) registers: attending or maybe; DELETE cancels
    rsvpEvent: builder.mutation<unknown, { slug: string; eventId: string; status: RsvpStatus }>({
      query: ({ slug, eventId, status }) => ({ url: `communities/${slug}/events/${eventId}/rsvp/`, method: 'POST', body: { status } }),
      // The button and the counter change at once; the api confirms (or everything is put back)
      onQueryStarted: ({ slug, eventId, status }, { dispatch, getState, queryFulfilled }) => patchRsvp({ dispatch, getState, queryFulfilled }, slug, eventId, status),
      invalidatesTags: (_result, _error, { eventId }) => ['events', { type: 'events', id: eventId }],
    }),
    // Token of the LiveKit room of a "livekit" event (it also checks the attendee in); the host publishes
    joinLiveEvent: builder.mutation<LiveJoin, { slug: string; eventId: string }>({
      query: ({ slug, eventId }) => ({ url: `communities/${slug}/events/${eventId}/join-live/`, method: 'POST' }),
      transformResponse: unwrap<LiveJoin>,
    }),
    cancelEventRsvp: builder.mutation<unknown, { slug: string; eventId: string }>({
      query: ({ slug, eventId }) => ({ url: `communities/${slug}/events/${eventId}/rsvp/`, method: 'DELETE' }),
      onQueryStarted: ({ slug, eventId }, { dispatch, getState, queryFulfilled }) => patchRsvp({ dispatch, getState, queryFulfilled }, slug, eventId, null),
      invalidatesTags: (_result, _error, { eventId }) => ['events', { type: 'events', id: eventId }],
    }),
    // Single-use ticket (30 s) to open the WebSocket of the realtime api (/ws/?ticket=)
    createWsTicket: builder.mutation<{ ticket: string }, void>({
      query: () => ({ url: 'auth/ws-ticket/', method: 'POST' }),
    }),
    // In-app notifications of the signed-in user (pushed by the realtime api; polled as a fallback)
    getNotifications: builder.query<ApiPaginated<AppNotification>, { page?: number; page_size?: number; unread?: boolean }>({
      query: (params) => ({ url: 'notifications/', params: cleanParams(params) }),
      providesTags: ['notifications'],
    }),
    getUnreadNotificationsCount: builder.query<number, void>({
      query: () => 'notifications/unread-count/',
      transformResponse: (response: ApiSuccess<{ unread_count: number }>) => unwrap(response).unread_count,
      providesTags: ['notifications'],
    }),
    markNotificationRead: builder.mutation<unknown, string>({
      query: (id) => ({ url: `notifications/${id}/read/`, method: 'POST' }),
      invalidatesTags: ['notifications'],
    }),
    markAllNotificationsRead: builder.mutation<unknown, void>({
      query: () => ({ url: 'notifications/read-all/', method: 'POST' }),
      invalidatesTags: ['notifications'],
    }),
    deleteNotification: builder.mutation<unknown, string>({
      query: (id) => ({ url: `notifications/${id}/`, method: 'DELETE' }),
      invalidatesTags: ['notifications'],
    }),
    // Hackathons of a community (apps/hackathons): owner and admins manage them
    getCommunityHackathons: builder.query<ApiPaginated<HackathonListItem>, { slug: string; status?: HackathonStatus; page?: number; page_size?: number }>({
      query: ({ slug, ...params }) => ({ url: `communities/${slug}/hackathons/`, params: cleanParams(params) }),
      providesTags: ['hackathons'],
    }),
    getHackathon: builder.query<Hackathon, { slug: string; hackathonSlug: string }>({
      query: ({ slug, hackathonSlug }) => `communities/${slug}/hackathons/${hackathonSlug}/`,
      transformResponse: unwrap<Hackathon>,
      providesTags: ['hackathons'],
    }),
    createHackathon: builder.mutation<Hackathon, { slug: string } & HackathonWriteData>({
      query: ({ slug, ...body }) => ({ url: `communities/${slug}/hackathons/`, method: 'POST', body }),
      transformResponse: unwrap<Hackathon>,
      invalidatesTags: ['hackathons'],
    }),
    updateHackathon: builder.mutation<Hackathon, { slug: string; hackathonSlug: string } & Partial<HackathonWriteData>>({
      query: ({ slug, hackathonSlug, ...body }) => ({ url: `communities/${slug}/hackathons/${hackathonSlug}/`, method: 'PATCH', body }),
      transformResponse: unwrap<Hackathon>,
      invalidatesTags: ['hackathons'],
    }),
    deleteHackathon: builder.mutation<unknown, { slug: string; hackathonSlug: string }>({
      query: ({ slug, hackathonSlug }) => ({ url: `communities/${slug}/hackathons/${hackathonSlug}/`, method: 'DELETE' }),
      invalidatesTags: ['hackathons'],
    }),
    // draft -> published, or registration_open when the registrations are already open
    publishHackathon: builder.mutation<Hackathon, { slug: string; hackathonSlug: string }>({
      query: ({ slug, hackathonSlug }) => ({ url: `communities/${slug}/hackathons/${hackathonSlug}/publish/`, method: 'POST' }),
      transformResponse: unwrap<Hackathon>,
      invalidatesTags: ['hackathons'],
    }),
    transitionHackathon: builder.mutation<Hackathon, { slug: string; hackathonSlug: string; status: HackathonStatus }>({
      query: ({ slug, hackathonSlug, status }) => ({ url: `communities/${slug}/hackathons/${hackathonSlug}/lifecycle/`, method: 'POST', body: { status } }),
      transformResponse: unwrap<Hackathon>,
      invalidatesTags: ['hackathons'],
    }),
    getHackathonDashboard: builder.query<HackathonDashboard, { slug: string; hackathonSlug: string }>({
      query: ({ slug, hackathonSlug }) => `communities/${slug}/hackathons/${hackathonSlug}/dashboard/`,
      transformResponse: unwrap<HackathonDashboard>,
      providesTags: ['hackathons'],
    }),
    getHackathonApplications: builder.query<
      ApiPaginated<HackathonApplication>,
      { slug: string; hackathonSlug: string; status?: ApplicationStatus; page?: number; page_size?: number }
    >({
      query: ({ slug, hackathonSlug, ...params }) => ({ url: `communities/${slug}/hackathons/${hackathonSlug}/applications/`, params: cleanParams(params) }),
      providesTags: ['hackathons'],
    }),
    reviewHackathonApplication: builder.mutation<
      HackathonApplication,
      { slug: string; hackathonSlug: string; applicationId: string; status: 'accepted' | 'rejected' | 'waitlisted'; reason?: string }
    >({
      query: ({ slug, hackathonSlug, applicationId, ...body }) => ({
        url: `communities/${slug}/hackathons/${hackathonSlug}/applications/${applicationId}/`,
        method: 'PATCH',
        body,
      }),
      transformResponse: unwrap<HackathonApplication>,
      invalidatesTags: ['hackathons'],
    }),
    getHackathonTeams: builder.query<ApiPaginated<HackathonTeam>, { slug: string; hackathonSlug: string; page?: number; page_size?: number }>({
      query: ({ slug, hackathonSlug, ...params }) => ({ url: `communities/${slug}/hackathons/${hackathonSlug}/teams/`, params: cleanParams(params) }),
      providesTags: ['hackathons'],
    }),
    // Organizers and judges; final_only=false adds the drafts
    getHackathonSubmissions: builder.query<
      ApiPaginated<HackathonSubmission>,
      { slug: string; hackathonSlug: string; final_only?: boolean; page?: number; page_size?: number }
    >({
      query: ({ slug, hackathonSlug, ...params }) => ({ url: `communities/${slug}/hackathons/${hackathonSlug}/submissions/`, params: cleanParams(params) }),
      providesTags: ['hackathons'],
    }),
    getHackathonSubmission: builder.query<HackathonSubmission, { slug: string; hackathonSlug: string; submissionSlug: string }>({
      query: ({ slug, hackathonSlug, submissionSlug }) => `communities/${slug}/hackathons/${hackathonSlug}/submissions/${submissionSlug}/`,
      transformResponse: unwrap<HackathonSubmission>,
    }),
    assignHackathonJudges: builder.mutation<unknown, { slug: string; hackathonSlug: string; user_ids: string[] }>({
      query: ({ slug, hackathonSlug, user_ids }) => ({ url: `communities/${slug}/hackathons/${hackathonSlug}/judges/`, method: 'POST', body: { user_ids } }),
      invalidatesTags: ['hackathons'],
    }),
    removeHackathonJudge: builder.mutation<unknown, { slug: string; hackathonSlug: string; userId: string }>({
      query: ({ slug, hackathonSlug, userId }) => ({ url: `communities/${slug}/hackathons/${hackathonSlug}/judges/`, method: 'DELETE', params: { user_id: userId } }),
      invalidatesTags: ['hackathons'],
    }),
    // The signed-in judge's evaluation of a project (null when not started)
    getHackathonEvaluation: builder.query<HackathonEvaluation | null, { slug: string; hackathonSlug: string; submissionId: string }>({
      query: ({ slug, hackathonSlug, submissionId }) => `communities/${slug}/hackathons/${hackathonSlug}/judging/projects/${submissionId}/evaluate/`,
      transformResponse: unwrap<HackathonEvaluation | null>,
      providesTags: (_result, _error, { submissionId }) => [{ type: 'hackathons', id: `evaluation-${submissionId}` }],
    }),
    evaluateHackathonSubmission: builder.mutation<HackathonEvaluation, { slug: string; hackathonSlug: string; submissionId: string } & EvaluationWriteData>({
      query: ({ slug, hackathonSlug, submissionId, ...body }) => ({
        url: `communities/${slug}/hackathons/${hackathonSlug}/judging/projects/${submissionId}/evaluate/`,
        method: 'POST',
        body,
      }),
      transformResponse: unwrap<HackathonEvaluation>,
      invalidatesTags: (_result, _error, { submissionId }) => ['hackathons', { type: 'hackathons', id: `evaluation-${submissionId}` }],
    }),
    getHackathonResults: builder.query<HackathonResult[], { slug: string; hackathonSlug: string }>({
      query: ({ slug, hackathonSlug }) => `communities/${slug}/hackathons/${hackathonSlug}/results/`,
      transformResponse: unwrap<HackathonResult[]>,
      providesTags: ['hackathons'],
    }),
    // Participants (active members of the community): application, team, project
    getMyHackathonApplication: builder.query<HackathonApplication | null, { slug: string; hackathonSlug: string }>({
      // 404: not applied yet
      queryFn: async ({ slug, hackathonSlug }, _api, _extra, baseQuery) => {
        const result = await baseQuery(`communities/${slug}/hackathons/${hackathonSlug}/my-application/`);
        if (result.error) return (result.error as FetchBaseQueryError).status === 404 ? { data: null } : { error: result.error as FetchBaseQueryError };
        return { data: unwrap<HackathonApplication>(result.data as ApiSuccess<HackathonApplication>) };
      },
      providesTags: ['hackathons'],
    }),
    applyToHackathon: builder.mutation<HackathonApplication, { slug: string; hackathonSlug: string } & HackathonApplyData>({
      query: ({ slug, hackathonSlug, ...body }) => ({ url: `communities/${slug}/hackathons/${hackathonSlug}/apply/`, method: 'POST', body }),
      transformResponse: unwrap<HackathonApplication>,
      invalidatesTags: ['hackathons'],
    }),
    withdrawHackathonApplication: builder.mutation<unknown, { slug: string; hackathonSlug: string }>({
      query: ({ slug, hackathonSlug }) => ({ url: `communities/${slug}/hackathons/${hackathonSlug}/my-application/`, method: 'DELETE' }),
      invalidatesTags: ['hackathons'],
    }),
    createHackathonTeam: builder.mutation<HackathonTeam, { slug: string; hackathonSlug: string; name: string; tagline?: string }>({
      query: ({ slug, hackathonSlug, ...body }) => ({ url: `communities/${slug}/hackathons/${hackathonSlug}/teams/`, method: 'POST', body }),
      transformResponse: unwrap<HackathonTeam>,
      invalidatesTags: ['hackathons'],
    }),
    // Leader only; identifier: username or email
    inviteToHackathonTeam: builder.mutation<unknown, { slug: string; hackathonSlug: string; teamId: string; identifier: string }>({
      query: ({ slug, hackathonSlug, teamId, identifier }) => ({
        url: `communities/${slug}/hackathons/${hackathonSlug}/teams/${teamId}/invite/`,
        method: 'POST',
        body: { identifier },
      }),
      invalidatesTags: ['hackathons'],
    }),
    respondHackathonTeamInvite: builder.mutation<unknown, { slug: string; hackathonSlug: string; team_id: string; accept: boolean }>({
      query: ({ slug, hackathonSlug, ...body }) => ({ url: `communities/${slug}/hackathons/${hackathonSlug}/teams/respond-invite/`, method: 'POST', body }),
      invalidatesTags: ['hackathons'],
    }),
    // Team invitations waiting for an answer, across every hackathon
    getMyTeamInvitations: builder.query<MyTeamInvitation[], void>({
      query: () => 'hackathons/teams/my-invitations/',
      transformResponse: unwrap<MyTeamInvitation[]>,
      providesTags: ['hackathons'],
    }),
    respondMyTeamInvitation: builder.mutation<unknown, { invitation_id: string; accept: boolean }>({
      query: (body) => ({ url: 'hackathons/teams/respond-invite/', method: 'POST', body }),
      invalidatesTags: ['hackathons'],
    }),
    // Leaves the team; the leader alone dissolves it
    leaveHackathonTeam: builder.mutation<unknown, { slug: string; hackathonSlug: string; teamId: string }>({
      query: ({ slug, hackathonSlug, teamId }) => ({ url: `communities/${slug}/hackathons/${hackathonSlug}/teams/${teamId}/`, method: 'DELETE' }),
      invalidatesTags: ['hackathons'],
    }),
    // The project of the user (or of the team); created as a draft at the first read
    getMyHackathonProject: builder.query<HackathonSubmission, { slug: string; hackathonSlug: string }>({
      query: ({ slug, hackathonSlug }) => `communities/${slug}/hackathons/${hackathonSlug}/submissions/my-project/`,
      transformResponse: unwrap<HackathonSubmission>,
      providesTags: [{ type: 'hackathons', id: 'my-project' }],
    }),
    updateMyHackathonProject: builder.mutation<HackathonSubmission, { slug: string; hackathonSlug: string } & HackathonSubmissionWriteData>({
      query: ({ slug, hackathonSlug, ...body }) => ({ url: `communities/${slug}/hackathons/${hackathonSlug}/submissions/my-project/`, method: 'PATCH', body }),
      transformResponse: unwrap<HackathonSubmission>,
      invalidatesTags: ['hackathons', { type: 'hackathons', id: 'my-project' }],
    }),
    // A file (sent to UploadThing by the api) or a link to it
    attachHackathonProjectFile: builder.mutation<
      unknown,
      { slug: string; hackathonSlug: string; file_type: SubmissionFileType } & ({ file: File } | { file_url: string; file_name: string })
    >({
      query: ({ slug, hackathonSlug, ...data }) => {
        let body: FormData | object;
        if ('file' in data) {
          const form = new FormData();
          form.append('file', data.file);
          form.append('file_type', data.file_type);
          body = form;
        } else {
          // The api asks the size and the type of a linked file: unknown here
          body = { ...data, file_size: 1, mime_type: 'application/octet-stream' };
        }
        return { url: `communities/${slug}/hackathons/${hackathonSlug}/submissions/my-project/files/`, method: 'POST', body };
      },
      invalidatesTags: [{ type: 'hackathons', id: 'my-project' }],
    }),
    deleteHackathonProjectFile: builder.mutation<unknown, { slug: string; hackathonSlug: string; fileId: string }>({
      query: ({ slug, hackathonSlug, fileId }) => ({ url: `communities/${slug}/hackathons/${hackathonSlug}/submissions/my-project/files/${fileId}/`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'hackathons', id: 'my-project' }],
    }),
    // Final submission: the api checks the required fields (title, description, links)
    submitMyHackathonProject: builder.mutation<HackathonSubmission, { slug: string; hackathonSlug: string }>({
      query: ({ slug, hackathonSlug }) => ({ url: `communities/${slug}/hackathons/${hackathonSlug}/submissions/my-project/submit/`, method: 'POST' }),
      transformResponse: unwrap<HackathonSubmission>,
      invalidatesTags: ['hackathons', { type: 'hackathons', id: 'my-project' }],
    }),
    // Links prizes to projects, publishes the ranking and completes the hackathon
    publishHackathonResults: builder.mutation<Hackathon, { slug: string; hackathonSlug: string; winners: { prize_id: string; submission_id: string }[] }>({
      query: ({ slug, hackathonSlug, winners }) => ({ url: `communities/${slug}/hackathons/${hackathonSlug}/publish-results/`, method: 'POST', body: { winners } }),
      transformResponse: unwrap<Hackathon>,
      invalidatesTags: ['hackathons'],
    }),
    // Courses of a community (apps/classroom): owner and admins manage them
    getCommunityCourses: builder.query<ApiPaginated<Course>, { slug: string; is_published?: boolean; page?: number; page_size?: number }>({
      query: ({ slug, ...params }) => ({ url: `communities/${slug}/courses/`, params: cleanParams(params) }),
      providesTags: ['courses'],
    }),
    getCourse: builder.query<Course, { slug: string; courseSlug: string }>({
      query: ({ slug, courseSlug }) => `communities/${slug}/courses/${courseSlug}/`,
      transformResponse: unwrap<Course>,
      providesTags: ['courses'],
    }),
    createCourse: builder.mutation<Course, { slug: string } & CourseWriteData>({
      query: ({ slug, ...body }) => ({ url: `communities/${slug}/courses/`, method: 'POST', body }),
      transformResponse: unwrap<Course>,
      invalidatesTags: ['courses'],
    }),
    updateCourse: builder.mutation<Course, { slug: string; courseSlug: string } & Partial<CourseWriteData>>({
      query: ({ slug, courseSlug, ...body }) => ({ url: `communities/${slug}/courses/${courseSlug}/`, method: 'PATCH', body }),
      transformResponse: unwrap<Course>,
      invalidatesTags: ['courses'],
    }),
    deleteCourse: builder.mutation<unknown, { slug: string; courseSlug: string }>({
      query: ({ slug, courseSlug }) => ({ url: `communities/${slug}/courses/${courseSlug}/`, method: 'DELETE' }),
      invalidatesTags: ['courses'],
    }),
    createModule: builder.mutation<CourseModule, { slug: string; courseSlug: string } & ModuleWriteData>({
      query: ({ slug, courseSlug, ...body }) => ({ url: `communities/${slug}/courses/${courseSlug}/modules/`, method: 'POST', body }),
      transformResponse: unwrap<CourseModule>,
      invalidatesTags: ['courses'],
    }),
    updateModule: builder.mutation<CourseModule, { slug: string; courseSlug: string; moduleId: string } & Partial<ModuleWriteData>>({
      query: ({ slug, courseSlug, moduleId, ...body }) => ({ url: `communities/${slug}/courses/${courseSlug}/modules/${moduleId}/`, method: 'PATCH', body }),
      transformResponse: unwrap<CourseModule>,
      invalidatesTags: ['courses'],
    }),
    deleteModule: builder.mutation<unknown, { slug: string; courseSlug: string; moduleId: string }>({
      query: ({ slug, courseSlug, moduleId }) => ({ url: `communities/${slug}/courses/${courseSlug}/modules/${moduleId}/`, method: 'DELETE' }),
      invalidatesTags: ['courses'],
    }),
    // Learners (active members): enrolling is also done by the first progress
    enrollCourse: builder.mutation<unknown, { slug: string; courseSlug: string }>({
      query: ({ slug, courseSlug }) => ({ url: `communities/${slug}/courses/${courseSlug}/enroll/`, method: 'POST' }),
      invalidatesTags: ['courses'],
    }),
    // Done / not done; the api refuses a locked lesson and recomputes the course progress
    updateLessonProgress: builder.mutation<unknown, { slug: string; courseSlug: string; lessonId: string; is_completed: boolean }>({
      query: ({ slug, courseSlug, lessonId, is_completed }) => ({
        url: `communities/${slug}/courses/${courseSlug}/lessons/${lessonId}/progress/`,
        method: 'POST',
        body: { is_completed },
      }),
      invalidatesTags: (_result, _error, { lessonId }) => ['courses', { type: 'courses', id: lessonId }],
    }),
    // Graded by the api; passed: the lesson is done (and the course, when it was the last one)
    submitQuiz: builder.mutation<QuizResult, { slug: string; courseSlug: string; lessonId: string; answers: Record<string, string[]> }>({
      query: ({ slug, courseSlug, lessonId, answers }) => ({ url: `communities/${slug}/courses/${courseSlug}/lessons/${lessonId}/quiz/submit/`, method: 'POST', body: { answers } }),
      transformResponse: unwrap<QuizResult>,
      invalidatesTags: (_result, _error, { lessonId }) => ['courses', { type: 'courses', id: lessonId }, 'leaderboard', 'member-activity'],
    }),
    // Lesson detail (with its content), for the editor
    getLesson: builder.query<CourseLesson, { slug: string; courseSlug: string; lessonId: string }>({
      query: ({ slug, courseSlug, lessonId }) => `communities/${slug}/courses/${courseSlug}/lessons/${lessonId}/`,
      transformResponse: unwrap<CourseLesson>,
      providesTags: (_result, _error, { lessonId }) => [{ type: 'courses', id: lessonId }],
    }),
    createLesson: builder.mutation<CourseLesson, { slug: string; courseSlug: string; moduleId: string } & LessonWriteData>({
      query: ({ slug, courseSlug, moduleId, ...body }) => ({ url: `communities/${slug}/courses/${courseSlug}/modules/${moduleId}/lessons/`, method: 'POST', body }),
      transformResponse: unwrap<CourseLesson>,
      invalidatesTags: ['courses'],
    }),
    updateLesson: builder.mutation<CourseLesson, { slug: string; courseSlug: string; lessonId: string } & Partial<LessonWriteData>>({
      query: ({ slug, courseSlug, lessonId, ...body }) => ({ url: `communities/${slug}/courses/${courseSlug}/lessons/${lessonId}/`, method: 'PATCH', body }),
      transformResponse: unwrap<CourseLesson>,
      invalidatesTags: (_result, _error, { lessonId }) => ['courses', { type: 'courses', id: lessonId }],
    }),
    // Video of a lesson: a file (stored on UploadThing) or a link to a video file, ingested by Mux;
    // the api turns the lesson into a "video" one
    uploadLessonVideo: builder.mutation<CourseLesson, { slug: string; courseSlug: string; lessonId: string; file?: File; url?: string }>({
      query: ({ slug, courseSlug, lessonId, file, url }) => {
        const body = new FormData();
        if (file) body.append('video', file);
        else if (url) body.append('video_url', url);
        return { url: `communities/${slug}/courses/${courseSlug}/lessons/${lessonId}/video/`, method: 'POST', body };
      },
      transformResponse: unwrap<CourseLesson>,
      invalidatesTags: (_result, _error, { lessonId }) => ['courses', { type: 'courses', id: lessonId }],
    }),
    deleteLesson: builder.mutation<unknown, { slug: string; courseSlug: string; lessonId: string }>({
      query: ({ slug, courseSlug, lessonId }) => ({ url: `communities/${slug}/courses/${courseSlug}/lessons/${lessonId}/`, method: 'DELETE' }),
      invalidatesTags: ['courses'],
    }),
    // Points earned in the community, all time (the api has no period here), at most 100 members
    // Activity of the signed-in member: across Kodinga, or in one community (its slug)
    getMemberActivity: builder.query<MemberActivity, string | void>({
      query: (slug) => (slug ? `communities/${slug}/me/dashboard/` : 'analytics/member/dashboard/'),
      transformResponse: unwrap<MemberActivity>,
      providesTags: ['member-activity'],
    }),
    // Points of the signed-in member: across Kodinga, its last gains (in one community with its slug), badges
    getMyReputation: builder.query<MyReputation, void>({
      query: () => 'gamification/reputation/me/',
      transformResponse: unwrap<MyReputation>,
      providesTags: ['leaderboard'],
    }),
    getMyPointsHistory: builder.query<PointsTransaction[], { community?: string; limit?: number }>({
      query: ({ community, limit = 10 }) =>
        community ? { url: `communities/${community}/gamification/points/history/`, params: { limit } } : { url: 'gamification/reputation/history/', params: { limit } },
      transformResponse: unwrap<PointsTransaction[]>,
      providesTags: ['leaderboard'],
    }),
    getMyBadges: builder.query<MyBadge[], void>({
      query: () => 'gamification/badges/my/',
      transformResponse: unwrap<MyBadge[]>,
      providesTags: ['leaderboard'],
    }),
    getMyCommunityPoints: builder.query<MyCommunityPoints, string>({
      query: (slug) => `communities/${slug}/gamification/points/me/`,
      transformResponse: unwrap<MyCommunityPoints>,
      providesTags: ['leaderboard'],
    }),
    // Points of each action in the community (anyone who sees it), set by the owner or an allowed admin
    getPointRules: builder.query<PointRule[], string>({
      query: (slug) => `communities/${slug}/gamification/rules/`,
      transformResponse: unwrap<PointRule[]>,
      providesTags: (_r, _e, slug) => [{ type: 'point-rules', id: slug }],
    }),
    updatePointRules: builder.mutation<PointRule[], { slug: string } & PointRulesUpdate>({
      query: ({ slug, ...body }) => ({ url: `communities/${slug}/gamification/rules/`, method: 'PATCH', body }),
      transformResponse: unwrap<PointRule[]>,
      invalidatesTags: (_r, _e, { slug }) => [{ type: 'point-rules', id: slug }],
    }),
    adjustPoints: builder.mutation<PointsTransaction, { slug: string } & PointsAdjustment>({
      query: ({ slug, ...body }) => ({ url: `communities/${slug}/gamification/points/adjust/`, method: 'POST', body }),
      transformResponse: unwrap<PointsTransaction>,
      // The ranking and the journal change
      invalidatesTags: (_r, _e, { slug }) => ['leaderboard', { type: 'point-rules', id: `journal-${slug}` }],
    }),
    // Journal of the community (managers): the last 100 gains and adjustments
    getPointTransactions: builder.query<PointsTransaction[], string>({
      query: (slug) => `communities/${slug}/gamification/transactions/`,
      transformResponse: unwrap<PointsTransaction[]>,
      providesTags: (_r, _e, slug) => [{ type: 'point-rules', id: `journal-${slug}` }],
    }),
    getCommunityLeaderboard: builder.query<LeaderboardEntry[], { slug: string; limit?: number; period?: LeaderboardPeriod }>({
      query: ({ slug, limit, period }) => ({ url: `communities/${slug}/leaderboard/`, params: cleanParams({ limit, period }) }),
      transformResponse: (response: ApiSuccess<LeaderboardEntry[]>) => unwrap(response),
      providesTags: ['leaderboard'],
    }),
    // Projects: lists and details wrapped in standard ApiSuccess envelope
    getCommunityProjects: builder.query<ProjectListItem[], ProjectsQuery>({
      query: (params) => ({ url: 'projects/', params: cleanParams(params) }),
      transformResponse: (response: ApiSuccess<ProjectListItem[]>) => unwrap(response),
      providesTags: ['projects'],
    }),
    getProject: builder.query<Project, string>({
      query: (projectSlug) => `projects/${projectSlug}/`,
      transformResponse: (response: ApiSuccess<Project>) => unwrap(response),
      providesTags: (_result, _error, projectSlug) => [{ type: 'projects', id: projectSlug }],
    }),
    createProject: builder.mutation<Project, ProjectWriteData>({
      query: (body) => ({ url: 'projects/', method: 'POST', body }),
      transformResponse: (response: ApiSuccess<Project>) => unwrap(response),
      invalidatesTags: ['projects'],
    }),
    updateProject: builder.mutation<Project, Partial<ProjectWriteData> & { projectSlug: string }>({
      query: ({ projectSlug, ...body }) => ({ url: `projects/${projectSlug}/`, method: 'PATCH', body }),
      transformResponse: (response: ApiSuccess<Project>) => unwrap(response),
      invalidatesTags: ['projects'],
    }),
    // Owner or staff only
    // Owner and admins of its community
    featureProject: builder.mutation<unknown, { projectSlug: string; is_featured: boolean }>({
      query: ({ projectSlug, is_featured }) => ({ url: `projects/${projectSlug}/feature/`, method: 'POST', body: { is_featured } }),
      invalidatesTags: (_r, _e, { projectSlug }) => ['projects', { type: 'projects', id: projectSlug }],
    }),
    deleteProject: builder.mutation<unknown, string>({
      query: (projectSlug) => ({ url: `projects/${projectSlug}/`, method: 'DELETE' }),
      invalidatesTags: ['projects'],
    }),
    // Toggles the vote of the signed-in user; the cached project is patched, without a new GET (it counts a view)
    toggleProjectUpvote: builder.mutation<{ is_upvoted: boolean; upvotes_count: number }, string>({
      query: (projectSlug) => ({ url: `projects/${projectSlug}/upvote/`, method: 'POST' }),
      transformResponse: (response: ApiSuccess<{ is_upvoted: boolean; upvotes_count: number }>) => unwrap(response),
      async onQueryStarted(projectSlug, { dispatch, getState, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(CommunityApi.util.updateQueryData('getProject', projectSlug, (draft) => Object.assign(draft, data)));
          for (const args of CommunityApi.util.selectCachedArgsForQuery(getState(), 'getCommunityProjects')) {
            dispatch(
              CommunityApi.util.updateQueryData('getCommunityProjects', args, (list) => {
                const project = list.find((p) => p.slug === projectSlug);
                if (project) Object.assign(project, data);
              }),
            );
          }
        } catch {
          // the caller shows the error
        }
      },
    }),
    getProjectComments: builder.query<ProjectComment[], string>({
      query: (projectSlug) => `projects/${projectSlug}/comments/`,
      transformResponse: (response: ApiSuccess<ProjectComment[]>) => unwrap(response),
      providesTags: (_result, _error, projectSlug) => [{ type: 'projects', id: `${projectSlug}-comments` }],
    }),
    addProjectComment: builder.mutation<ProjectComment, { projectSlug: string; content: string; parent_id?: string }>({
      query: ({ projectSlug, ...body }) => ({ url: `projects/${projectSlug}/comments/`, method: 'POST', body }),
      transformResponse: (response: ApiSuccess<ProjectComment>) => unwrap(response),
      invalidatesTags: (_result, _error, { projectSlug }) => [{ type: 'projects', id: `${projectSlug}-comments` }],
    }),
    // Opportunities: lists and details wrapped in standard ApiSuccess envelope
    getCommunityOpportunities: builder.query<OpportunityListItem[], OpportunitiesQuery>({
      query: (params) => ({ url: 'opportunities/', params: cleanParams(params) }),
      transformResponse: (response: ApiSuccess<OpportunityListItem[]>) => unwrap(response),
      providesTags: ['opportunities'],
    }),
    getOpportunity: builder.query<Opportunity, string>({
      query: (opportunitySlug) => `opportunities/${opportunitySlug}/`,
      transformResponse: (response: ApiSuccess<Opportunity>) => unwrap(response),
      providesTags: (_result, _error, opportunitySlug) => [{ type: 'opportunities', id: opportunitySlug }],
    }),
    createOpportunity: builder.mutation<Opportunity, OpportunityWriteData>({
      query: (body) => ({ url: 'opportunities/', method: 'POST', body }),
      transformResponse: (response: ApiSuccess<Opportunity>) => unwrap(response),
      invalidatesTags: ['opportunities'],
    }),
    updateOpportunity: builder.mutation<Opportunity, Partial<OpportunityWriteData> & { opportunitySlug: string }>({
      query: ({ opportunitySlug, ...body }) => ({ url: `opportunities/${opportunitySlug}/`, method: 'PATCH', body }),
      transformResponse: (response: ApiSuccess<Opportunity>) => unwrap(response),
      invalidatesTags: ['opportunities'],
    }),
    // The api does not delete: DELETE closes the offer (status = closed), poster or staff only
    closeOpportunity: builder.mutation<{ status: 'closed' }, string>({
      query: (opportunitySlug) => ({ url: `opportunities/${opportunitySlug}/`, method: 'DELETE' }),
      transformResponse: (response: ApiSuccess<{ status: 'closed' }>) => unwrap(response),
      invalidatesTags: ['opportunities'],
    }),
    // A member applies (CV, letter, portfolio: links); the poster is notified
    applyToOpportunity: builder.mutation<OpportunityApplication, { opportunitySlug: string; resume_url: string; cover_letter: string; portfolio_url: string }>({
      query: ({ opportunitySlug, ...body }) => ({ url: `opportunities/${opportunitySlug}/apply/`, method: 'POST', body }),
      invalidatesTags: (_result, _error, { opportunitySlug }) => ['opportunities', { type: 'opportunities', id: opportunitySlug }, { type: 'opportunities', id: 'my-applications' }],
    }),
    // Applications of the signed-in user, with their status
    getMyOpportunityApplications: builder.query<OpportunityApplication[], void>({
      query: () => 'opportunities/my-applications/',
      providesTags: [{ type: 'opportunities', id: 'my-applications' }],
    }),
    getOpportunityApplications: builder.query<OpportunityApplication[], string>({
      query: (opportunitySlug) => `opportunities/${opportunitySlug}/applications/`,
      transformResponse: (response: ApiSuccess<OpportunityApplication[]>) => unwrap(response),
      providesTags: (_result, _error, opportunitySlug) => [{ type: 'opportunities', id: `${opportunitySlug}-applications` }],
    }),
    updateOpportunityApplicationStatus: builder.mutation<
      OpportunityApplication,
      { applicationId: string; opportunitySlug: string; status: OpportunityApplicationStatus }
    >({
      query: ({ applicationId, status }) => ({ url: `opportunities/applications/${applicationId}/status/`, method: 'PATCH', body: { status } }),
      transformResponse: (response: ApiSuccess<OpportunityApplication>) => unwrap(response),
      invalidatesTags: (_result, _error, { opportunitySlug }) => [{ type: 'opportunities', id: `${opportunitySlug}-applications` }],
    }),
    getTechnologies: builder.query<Technology[], string>({
      query: (search) => ({ url: 'profiles/technologies/', params: search ? { search } : undefined }),
      transformResponse: (response: ApiSuccess<Technology[]>) => unwrap(response),
    }),
    // Active categories (directory, settings of a community)
    getCategories: builder.query<AdminCategoryItem[], void>({
      query: () => 'communities/categories/',
      transformResponse: unwrap<AdminCategoryItem[]>,
      providesTags: ['categories'],
    }),
    // Settings of a community (owner and admins): profile, access, charter
    updateCommunity: builder.mutation<CommunityDetail, { slug: string } & CommunityUpdateData>({
      query: ({ slug, ...body }) => ({ url: `communities/${slug}/`, method: 'PATCH', body }),
      transformResponse: unwrap<CommunityDetail>,
      invalidatesTags: (_result, _error, { slug }) => ['communities', { type: 'communities', id: slug }],
    }),
    updateCommunitySettings: builder.mutation<CommunitySettings, { slug: string } & Partial<CommunitySettings>>({
      query: ({ slug, ...body }) => ({ url: `communities/${slug}/settings/`, method: 'PATCH', body }),
      transformResponse: unwrap<CommunitySettings>,
      invalidatesTags: (_result, _error, { slug }) => ['communities', { type: 'communities', id: slug }, { type: 'settings', id: slug }],
    }),
    addCommunityRule: builder.mutation<CommunityRuleItem, { slug: string; title: string; description: string; order: number }>({
      query: ({ slug, ...body }) => ({ url: `communities/${slug}/rules/`, method: 'POST', body }),
      transformResponse: unwrap<CommunityRuleItem>,
      invalidatesTags: (_result, _error, { slug }) => [{ type: 'communities', id: slug }],
    }),
    deleteCommunityRule: builder.mutation<unknown, { slug: string; ruleId: string }>({
      query: ({ slug, ruleId }) => ({ url: `communities/${slug}/rules/${ruleId}/`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, { slug }) => [{ type: 'communities', id: slug }],
    }),
    // The api archives (is_active = false): owner or superuser only
    archiveCommunity: builder.mutation<ApiSuccess<undefined>, string>({
      query: (slug) => ({ url: `communities/${slug}/`, method: 'DELETE' }),
      invalidatesTags: ['communities'],
    }),
    // AI Community Assistant Endpoints
    recommendCommunities: builder.mutation<ApiSuccess<CommunityRecommendationResult>, { interests: string; language?: string }>({
      query: (body) => ({ url: 'ai-assistant/recommend-communities/', method: 'POST', body }),
    }),
    planCommunity: builder.mutation<ApiSuccess<CommunityProposalResult>, { idea: string; language?: string; context?: Record<string, unknown> }>({
      query: (body) => ({ url: 'ai-assistant/plan-community/', method: 'POST', body }),
    }),
    suggestContent: builder.mutation<ApiSuccess<ContentSuggestionResult>, { community: string; goal?: string; language?: string }>({
      query: (body) => ({ url: 'ai-assistant/suggest-content/', method: 'POST', body }),
    }),
    getCommunityAISettings: builder.query<CommunityAISettings, string>({
      query: (slug) => `communities/${slug}/ai-settings/`,
      transformResponse: unwrap<CommunityAISettings>,
      providesTags: (_result, _error, slug) => [{ type: 'ai-settings', id: slug }],
    }),
    updateCommunityAISettings: builder.mutation<CommunityAISettings, { slug: string } & CommunityAISettingsWrite>({
      query: ({ slug, ...body }) => ({ url: `communities/${slug}/ai-settings/`, method: 'PATCH', body }),
      transformResponse: unwrap<CommunityAISettings>,
      invalidatesTags: (_result, _error, { slug }) => [{ type: 'ai-settings', id: slug }],
    }),
    getCommunitySettings: builder.query<CommunitySettings, string>({
      query: (slug) => `communities/${slug}/settings/`,
      transformResponse: unwrap<CommunitySettings>,
      providesTags: (_result, _error, slug) => [{ type: 'settings', id: slug }],
    }),
    analyzeCommunity: builder.mutation<ApiSuccess<CommunityAnalysisResult>, { community: string; language?: string }>({
      query: (body) => ({ url: 'ai-assistant/analyze-community/', method: 'POST', body }),
    }),
    assistantChat: builder.mutation<ApiSuccess<AssistantChatResult>, { message: string; conversation_id?: string; community?: string; language?: string }>({
      query: (body) => ({ url: 'ai-assistant/chat/', method: 'POST', body }),
    }),
  }),
});

export const {
  useGetCommunitiesQuery,
  useDiscoverCommunitiesQuery,
  useGetCommunityCategoriesQuery,
  useGetAdminCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  useGetCommunityQuery,
  useGetMyCommunitiesQuery,
  useCreateCommunityMutation,
  useArchiveCommunityMutation,
  useGetCategoriesQuery,
  useUpdateCommunityMutation,
  useUpdateCommunitySettingsMutation,
  useAddCommunityRuleMutation,
  useDeleteCommunityRuleMutation,
  useGetCommunityMembersQuery,
  useDecideMemberMutation,
  useToggleBookmarkMutation,
  useSetCommunityNotificationsMutation,
  useFeatureProjectMutation,
  useGetCommunityMemberJoinsQuery,
  useJoinCommunityMutation,
  useLeaveCommunityMutation,
  useGetCommunityPlansQuery,
  useGetProPlansQuery,
  useCreateCheckoutMutation,
  useCancelSubscriptionMutation,
  useGetCommunitySubscribersQuery,
  useGetCommunityTransactionsQuery,
  useGetCommunityRevenueQuery,
  useGetOwnedRevenuesQuery,
  useGetMemberActivityQuery,
  useCheckInAttendeeMutation,
  useGetMyReputationQuery,
  useGetMyPointsHistoryQuery,
  useGetMyBadgesQuery,
  useGetMyCommunityPointsQuery,
  useGetPointRulesQuery,
  useUpdatePointRulesMutation,
  useAdjustPointsMutation,
  useGetPointTransactionsQuery,
  useGetCommunityPayoutsQuery,
  useRequestPayoutMutation,
  useCreatePlanMutation,
  useUpdatePlanMutation,
  useDeactivatePlanMutation,
  useGetMySubscriptionsQuery,
  useGetMyPaymentsQuery,
  useGetPaymentStatusQuery,
  useRequestUploadUrlMutation,
  useConfirmUploadMutation,
  useGetConversationsQuery,
  useGetConversationQuery,
  useStartConversationMutation,
  useGetMessagesQuery,
  useSendMessageMutation,
  useMarkConversationReadMutation,
  useEditMessageMutation,
  useDeleteMessageMutation,
  useSanctionMemberMutation,
  useChangeMemberRoleMutation,
  useGetCommunityInvitationsQuery,
  useCreateInvitationMutation,
  useGetJoinRequestsQuery,
  useRevokeInvitationMutation,
  useResendInvitationMutation,
  useGetPublicInvitationQuery,
  useAcceptInvitationMutation,
  useAcceptInvitationByTokenMutation,
  useDeclineInvitationMutation,
  useGetMyInvitationsQuery,
  useCreateShareLinkMutation,
  useGetCommunityFeedQuery,
  useTogglePostPinMutation,
  useTogglePostLockMutation,
  useDeletePostMutation,
  useCreatePostMutation,
  useTogglePostLikeMutation,
  useGetPostQuery,
  useGetPostCommentsQuery,
  useAddPostCommentMutation,
  useDeletePostCommentMutation,
  useToggleCommentLikeMutation,
  useAcceptAnswerMutation,
  useVotePollMutation,
  useUpdatePostMutation,
  useRecommendCommunitiesMutation,
  usePlanCommunityMutation,
  useSuggestContentMutation,
  useAnalyzeCommunityMutation,
  useAssistantChatMutation,
  useGetCommunitySettingsQuery,
  useGetCommunityAISettingsQuery,
  useUpdateCommunityAISettingsMutation,
  useGetCommunityEventsQuery,
  useGetCommunityEventQuery,
  useCreateEventMutation,
  useUpdateEventMutation,
  useDeleteEventMutation,
  useUpdateEventStatusMutation,
  useGetEventAttendeesQuery,
  useGetAllEventAttendeesQuery,
  useCreateVideoUploadMutation,
  useAttachEventReplayMutation,
  useTranscribeEventLiveMutation,
  useGetEventTranscriptionQuery,
  useGenerateEventSummaryMutation,
  useChatEventTranscriptMutation,
  useRsvpEventMutation,
  useCancelEventRsvpMutation,
  useJoinLiveEventMutation,
  useGetNotificationsQuery,
  useGetUnreadNotificationsCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
  useGetCommunityHackathonsQuery,
  useGetHackathonQuery,
  useCreateHackathonMutation,
  useUpdateHackathonMutation,
  useDeleteHackathonMutation,
  usePublishHackathonMutation,
  useTransitionHackathonMutation,
  useGetHackathonDashboardQuery,
  useGetHackathonApplicationsQuery,
  useReviewHackathonApplicationMutation,
  useGetHackathonTeamsQuery,
  useGetHackathonSubmissionsQuery,
  useGetHackathonSubmissionQuery,
  useAssignHackathonJudgesMutation,
  useRemoveHackathonJudgeMutation,
  useGetHackathonEvaluationQuery,
  useEvaluateHackathonSubmissionMutation,
  useGetHackathonResultsQuery,
  usePublishHackathonResultsMutation,
  useGetMyHackathonApplicationQuery,
  useApplyToHackathonMutation,
  useWithdrawHackathonApplicationMutation,
  useCreateHackathonTeamMutation,
  useInviteToHackathonTeamMutation,
  useRespondHackathonTeamInviteMutation,
  useGetMyTeamInvitationsQuery,
  useRespondMyTeamInvitationMutation,
  useLeaveHackathonTeamMutation,
  useGetMyHackathonProjectQuery,
  useUpdateMyHackathonProjectMutation,
  useAttachHackathonProjectFileMutation,
  useDeleteHackathonProjectFileMutation,
  useSubmitMyHackathonProjectMutation,
  useGetCommunityCoursesQuery,
  useGetCourseQuery,
  useCreateCourseMutation,
  useUpdateCourseMutation,
  useDeleteCourseMutation,
  useCreateModuleMutation,
  useUpdateModuleMutation,
  useDeleteModuleMutation,
  useGetLessonQuery,
  useCreateLessonMutation,
  useUpdateLessonMutation,
  useDeleteLessonMutation,
  useUploadLessonVideoMutation,
  useEnrollCourseMutation,
  useUpdateLessonProgressMutation,
  useSubmitQuizMutation,
  useGetCommunityOpportunitiesQuery,
  useGetOpportunityQuery,
  useCreateOpportunityMutation,
  useUpdateOpportunityMutation,
  useCloseOpportunityMutation,
  useGetOpportunityApplicationsQuery,
  useApplyToOpportunityMutation,
  useGetMyOpportunityApplicationsQuery,
  useUpdateOpportunityApplicationStatusMutation,
  useGetTechnologiesQuery,
  useGetCommunityLeaderboardQuery,
  useGetCommunityProjectsQuery,
  useGetProjectQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useToggleProjectUpvoteMutation,
  useGetProjectCommentsQuery,
  useAddProjectCommentMutation,
} = CommunityApi;

export { CommunityApi as communityApi };
export default CommunityApi;
