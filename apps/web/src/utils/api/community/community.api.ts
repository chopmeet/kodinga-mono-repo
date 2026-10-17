import { createApi, fetchBaseQuery, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';

import { ApiBaseUrl } from '@/utils/http';
import type { Course, CourseLesson, CourseModule, CourseWriteData, LessonWriteData, ModuleWriteData } from '../course/course.type';
import type { CommunityEvent, EventAttendee, EventStatus, EventWriteData, EventsQuery } from '../event/event.type';
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
  HackathonStatus,
  HackathonWriteData,
} from '../hackathon/hackathon.type';
import type { LeaderboardEntry } from '../gamification/gamification.type';
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
import { prepareHeaders } from '../user/user.api';
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
  CommunityFeedQuery,
  CommunityListItem,
  CommunityListQuery,
  CommunityInvitation,
  CommunityMemberItem,
  CommunityRole,
  InvitationWriteData,
  CommunityMembersQuery,
  CommunityPostItem,
  CommunityProposalResult,
  CommunityRecommendationResult,
  ContentSuggestionResult,
  ManagedCommunity,
  ManagedRole,
  SanctionData,
} from './community.type';

const MANAGED_ROLES: ManagedRole[] = ['owner', 'admin', 'moderator'];

/** Drops empty filters so the api does not receive `?q=&category=` */
const cleanParams = (query: object) =>
  Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ''));

export const CommunityApi = createApi({
  reducerPath: 'communityApi',
  tagTypes: [
    'communities', 
    'categories', 
    'members', 
    'posts',
    'ai-settings',
    'events',
    'hackathons',
    'courses',
    'opportunities',
    'leaderboard',
    'projects',
    'invitations',
  ],
  baseQuery: fetchBaseQuery({ 
    baseUrl: ApiBaseUrl, 
    prepareHeaders 
  }),
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
    getMyManagedCommunities: builder.query<ManagedCommunity[], void>({
      async queryFn(_arg, _api, _extra, baseQuery) {
        const list = await baseQuery({ url: 'communities/my/', params: { page_size: 10 } });
        if (list.error) return { error: list.error };
        const items = (list.data as ApiPaginated<CommunityListItem>).results ?? [];
        const details = await Promise.all(items.map((c) => baseQuery(`communities/${c.slug}/`)));
        const failed = details.find((d) => d.error);
        if (failed?.error) return { error: failed.error as FetchBaseQueryError };
        const managed = details.flatMap((d) => {
          const detail = (d.data as ApiSuccess<CommunityDetail>).data;
          const role = detail.user_membership?.role;
          return detail.user_membership?.is_member && role && MANAGED_ROLES.includes(role as ManagedRole)
            ? [{ community: detail, role: role as ManagedRole }]
            : [];
        });
        return { data: managed };
      },
      providesTags: ['communities'],
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
    // Not revoked invitations: owner and admins only (superusers everywhere)
    getCommunityInvitations: builder.query<CommunityInvitation[], string>({
      query: (slug) => `communities/${slug}/invitations/`,
      transformResponse: unwrap<CommunityInvitation[]>,
      providesTags: ['invitations'],
    }),
    createInvitation: builder.mutation<CommunityInvitation, InvitationWriteData & { slug: string }>({
      query: ({ slug, ...body }) => ({ url: `communities/${slug}/invitations/`, method: 'POST', body }),
      transformResponse: unwrap<CommunityInvitation>,
      invalidatesTags: ['invitations'],
    }),
    // The signed-in user joins with the role of the invitation (no approval, no subscription)
    acceptInvitation: builder.mutation<CommunityMemberItem, string>({
      query: (invite_code) => ({ url: 'invitations/accept/', method: 'POST', body: { invite_code } }),
      transformResponse: unwrap<CommunityMemberItem>,
      invalidatesTags: ['members', 'communities'],
    }),
    getCommunityFeed: builder.query<ApiPaginated<CommunityPostItem>, CommunityFeedQuery>({
      query: ({ slug, ...params }) => ({ url: `communities/${slug}/feed/`, params: cleanParams(params) }),
      providesTags: ['posts'],
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
      invalidatesTags: ['posts', 'communities'],
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
    getEventAttendees: builder.query<ApiPaginated<EventAttendee>, { slug: string; eventId: string; page?: number; page_size?: number }>({
      query: ({ slug, eventId, ...params }) => ({ url: `communities/${slug}/events/${eventId}/attendees/`, params: cleanParams(params) }),
      providesTags: (_result, _error, { eventId }) => [{ type: 'events', id: `${eventId}-attendees` }],
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
    deleteLesson: builder.mutation<unknown, { slug: string; courseSlug: string; lessonId: string }>({
      query: ({ slug, courseSlug, lessonId }) => ({ url: `communities/${slug}/courses/${courseSlug}/lessons/${lessonId}/`, method: 'DELETE' }),
      invalidatesTags: ['courses'],
    }),
    // Points earned in the community, all time (the api has no period here), at most 100 members
    getCommunityLeaderboard: builder.query<LeaderboardEntry[], { slug: string; limit?: number }>({
      query: ({ slug, limit }) => ({ url: `communities/${slug}/leaderboard/`, params: cleanParams({ limit }) }),
      transformResponse: (response: ApiSuccess<LeaderboardEntry[]>) => unwrap(response),
      providesTags: ['leaderboard'],
    }),
    // Projects: raw responses (no envelope); lists are not paginated and only hold published projects
    getCommunityProjects: builder.query<ProjectListItem[], ProjectsQuery>({
      query: (params) => ({ url: 'projects/', params: cleanParams(params) }),
      providesTags: ['projects'],
    }),
    getProject: builder.query<Project, string>({
      query: (projectSlug) => `projects/${projectSlug}/`,
      providesTags: (_result, _error, projectSlug) => [{ type: 'projects', id: projectSlug }],
    }),
    createProject: builder.mutation<Project, ProjectWriteData>({
      query: (body) => ({ url: 'projects/', method: 'POST', body }),
      invalidatesTags: ['projects'],
    }),
    updateProject: builder.mutation<Project, Partial<ProjectWriteData> & { projectSlug: string }>({
      query: ({ projectSlug, ...body }) => ({ url: `projects/${projectSlug}/`, method: 'PATCH', body }),
      invalidatesTags: ['projects'],
    }),
    // Owner or staff only
    deleteProject: builder.mutation<unknown, string>({
      query: (projectSlug) => ({ url: `projects/${projectSlug}/`, method: 'DELETE' }),
      invalidatesTags: ['projects'],
    }),
    // Toggles the vote of the signed-in user; the cached project is patched, without a new GET (it counts a view)
    toggleProjectUpvote: builder.mutation<{ is_upvoted: boolean; upvotes_count: number }, string>({
      query: (projectSlug) => ({ url: `projects/${projectSlug}/upvote/`, method: 'POST' }),
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
      providesTags: (_result, _error, projectSlug) => [{ type: 'projects', id: `${projectSlug}-comments` }],
    }),
    addProjectComment: builder.mutation<ProjectComment, { projectSlug: string; content: string; parent_id?: string }>({
      query: ({ projectSlug, ...body }) => ({ url: `projects/${projectSlug}/comments/`, method: 'POST', body }),
      invalidatesTags: (_result, _error, { projectSlug }) => [{ type: 'projects', id: `${projectSlug}-comments` }],
    }),
    // Opportunities: raw responses (no envelope), lists are not paginated and only hold open offers
    getCommunityOpportunities: builder.query<OpportunityListItem[], OpportunitiesQuery>({
      query: (params) => ({ url: 'opportunities/', params: cleanParams(params) }),
      providesTags: ['opportunities'],
    }),
    getOpportunity: builder.query<Opportunity, string>({
      query: (opportunitySlug) => `opportunities/${opportunitySlug}/`,
      providesTags: (_result, _error, opportunitySlug) => [{ type: 'opportunities', id: opportunitySlug }],
    }),
    createOpportunity: builder.mutation<Opportunity, OpportunityWriteData>({
      query: (body) => ({ url: 'opportunities/', method: 'POST', body }),
      invalidatesTags: ['opportunities'],
    }),
    updateOpportunity: builder.mutation<Opportunity, Partial<OpportunityWriteData> & { opportunitySlug: string }>({
      query: ({ opportunitySlug, ...body }) => ({ url: `opportunities/${opportunitySlug}/`, method: 'PATCH', body }),
      invalidatesTags: ['opportunities'],
    }),
    // The api does not delete: DELETE closes the offer (status = closed), poster or staff only
    closeOpportunity: builder.mutation<{ status: 'closed' }, string>({
      query: (opportunitySlug) => ({ url: `opportunities/${opportunitySlug}/`, method: 'DELETE' }),
      invalidatesTags: ['opportunities'],
    }),
    getOpportunityApplications: builder.query<OpportunityApplication[], string>({
      query: (opportunitySlug) => `opportunities/${opportunitySlug}/applications/`,
      providesTags: (_result, _error, opportunitySlug) => [{ type: 'opportunities', id: `${opportunitySlug}-applications` }],
    }),
    updateOpportunityApplicationStatus: builder.mutation<
      OpportunityApplication,
      { applicationId: string; opportunitySlug: string; status: OpportunityApplicationStatus }
    >({
      query: ({ applicationId, status }) => ({ url: `opportunities/applications/${applicationId}/status/`, method: 'PATCH', body: { status } }),
      invalidatesTags: (_result, _error, { opportunitySlug }) => [{ type: 'opportunities', id: `${opportunitySlug}-applications` }],
    }),
    getTechnologies: builder.query<Technology[], string>({
      query: (search) => ({ url: 'profiles/technologies/', params: search ? { search } : undefined }),
      transformResponse: (response: ApiSuccess<Technology[]>) => unwrap(response),
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
  useGetMyManagedCommunitiesQuery,
  useCreateCommunityMutation,
  useArchiveCommunityMutation,
  useGetCommunityMembersQuery,
  useDecideMemberMutation,
  useSanctionMemberMutation,
  useChangeMemberRoleMutation,
  useGetCommunityInvitationsQuery,
  useCreateInvitationMutation,
  useAcceptInvitationMutation,
  useGetCommunityFeedQuery,
  useTogglePostPinMutation,
  useTogglePostLockMutation,
  useDeletePostMutation,
  useRecommendCommunitiesMutation,
  usePlanCommunityMutation,
  useSuggestContentMutation,
  useAnalyzeCommunityMutation,
  useAssistantChatMutation,
  useGetCommunityAISettingsQuery,
  useUpdateCommunityAISettingsMutation,
  useGetCommunityEventsQuery,
  useGetCommunityEventQuery,
  useCreateEventMutation,
  useUpdateEventMutation,
  useDeleteEventMutation,
  useUpdateEventStatusMutation,
  useGetEventAttendeesQuery,
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
  useGetCommunityOpportunitiesQuery,
  useGetOpportunityQuery,
  useCreateOpportunityMutation,
  useUpdateOpportunityMutation,
  useCloseOpportunityMutation,
  useGetOpportunityApplicationsQuery,
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

