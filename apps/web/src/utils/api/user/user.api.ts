import { createApi } from '@reduxjs/toolkit/query/react';

import { type ApiPaginated, type ApiSuccess, unwrap } from '../api.type';
import { authBaseQuery } from '../authBaseQuery';
import type {
  EducationWriteData,
  FollowState,
  ExperienceWriteData,
  MyProfile,
  PortfolioWriteData,
  ProfileWriteData,
  ProfileActivity,
  ProfileFollow,
  PublicProfile,
  SkillWriteData,
  UserSession,
} from '../profile/profile.type';
import type { User, UserFormData, UsersQuery } from './user.type';

export const UserApi = createApi({
  reducerPath: 'userApi',
  tagTypes: ['user', 'users', 'profile', 'my-profile', 'sessions', 'follows'],
  baseQuery: authBaseQuery,
  endpoints: (builder) => ({
    meAccount: builder.query<User, void>({
      query: () => 'users/me/',
      transformResponse: unwrap<User>,
      providesTags: ['user'],
    }),
    // Every account of the platform (admin): search on email / username / name, status filter
    getUsers: builder.query<ApiPaginated<User>, UsersQuery>({
      query: (params) => ({
        url: 'users/',
        params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')),
      }),
      providesTags: ['users'],
    }),
    // Platform governance (super-admins only), traced in the audit log by the api
    toggleUserAdmin: builder.mutation<User, { id: string; is_superadmin: boolean }>({
      query: ({ id, is_superadmin }) => ({ url: `admin/users/${id}/toggle-admin/`, method: 'POST', body: { is_superadmin } }),
      transformResponse: unwrap<User>,
      invalidatesTags: ['users'],
    }),
    toggleUserStatus: builder.mutation<User, { id: string; is_active: boolean; reason?: string }>({
      query: ({ id, ...body }) => ({ url: `admin/users/${id}/toggle-status/`, method: 'POST', body }),
      transformResponse: unwrap<User>,
      invalidatesTags: ['users'],
    }),
    // Public developer profile (the api answers 404 for an unknown or private one)
    getPublicProfile: builder.query<PublicProfile, string>({
      query: (username) => `profiles/${encodeURIComponent(username)}/`,
      transformResponse: unwrap<PublicProfile>,
      providesTags: (_result, _error, username) => [{ type: 'profile', id: username }],
    }),
    // Who follows a profile, or whom it follows, most recent first
    getProfileFollows: builder.query<ApiPaginated<ProfileFollow>, { username: string; list: 'followers' | 'following'; page_size: number }>({
      query: ({ username, list, page_size }) => ({ url: `profiles/${encodeURIComponent(username)}/${list}/`, params: { page: 1, page_size } }),
      providesTags: (_result, _error, { username }) => [{ type: 'follows', id: username }],
    }),
    // Follows the profile, or stops following it: the api toggles, and answers the new state and counts
    toggleFollow: builder.mutation<FollowState, string>({
      query: (username) => ({ url: `profiles/${encodeURIComponent(username)}/follow/`, method: 'POST' }),
      transformResponse: unwrap<FollowState>,
      invalidatesTags: (_result, _error, username) => [{ type: 'follows', id: username }],
      async onQueryStarted(username, { dispatch, getState, queryFulfilled }) {
        const { data } = await queryFulfilled.catch(() => ({ data: null }));
        if (!data) return;
        // The page may have been opened as /profiles/@name
        for (const arg of UserApi.util.selectCachedArgsForQuery(getState(), 'getPublicProfile')) {
          if (arg.replace(/^@/, '') !== username) continue;
          dispatch(
            UserApi.util.updateQueryData('getPublicProfile', arg, (profile) => {
              profile.is_following = data.is_following;
              profile.followers_count = data.followers_count;
              profile.following_count = data.following_count;
            }),
          );
        }
      },
    }),
    // Posts, comments, lessons done, reactions and points of each day of a year
    getProfileActivity: builder.query<ProfileActivity, { username: string; year: number }>({
      query: ({ username, year }) => ({ url: `profiles/${encodeURIComponent(username)}/activity/`, params: { year } }),
      transformResponse: unwrap<ProfileActivity>,
    }),
    updateMe: builder.mutation<User, UserFormData>({
      query: (body) => ({ url: 'users/me/', method: 'PATCH', body }),
      transformResponse: (res: ApiSuccess<User>) => res.data,
      invalidatesTags: ['user'],
    }),
    // Developer profile of the signed-in user (created by the api on first read)
    getMyProfile: builder.query<MyProfile, void>({
      query: () => 'profiles/me/',
      transformResponse: unwrap<MyProfile>,
      providesTags: ['my-profile'],
    }),
    updateMyProfile: builder.mutation<MyProfile, ProfileWriteData>({
      query: (body) => ({ url: 'profiles/me/', method: 'PATCH', body }),
      transformResponse: unwrap<MyProfile>,
      invalidatesTags: ['my-profile', 'profile'],
    }),
    // Skills: no update on the api, a skill is removed then added again
    addSkill: builder.mutation<unknown, SkillWriteData>({
      query: (body) => ({ url: 'profiles/me/skills/', method: 'POST', body }),
      invalidatesTags: ['my-profile', 'profile'],
    }),
    deleteSkill: builder.mutation<unknown, string>({
      query: (id) => ({ url: `profiles/me/skills/${id}/`, method: 'DELETE' }),
      invalidatesTags: ['my-profile', 'profile'],
    }),
    addExperience: builder.mutation<unknown, ExperienceWriteData>({
      query: (body) => ({ url: 'profiles/me/experiences/', method: 'POST', body }),
      invalidatesTags: ['my-profile', 'profile'],
    }),
    updateExperience: builder.mutation<unknown, { id: string } & Partial<ExperienceWriteData>>({
      query: ({ id, ...body }) => ({ url: `profiles/me/experiences/${id}/`, method: 'PATCH', body }),
      invalidatesTags: ['my-profile', 'profile'],
    }),
    deleteExperience: builder.mutation<unknown, string>({
      query: (id) => ({ url: `profiles/me/experiences/${id}/`, method: 'DELETE' }),
      invalidatesTags: ['my-profile', 'profile'],
    }),
    addEducation: builder.mutation<unknown, EducationWriteData>({
      query: (body) => ({ url: 'profiles/me/educations/', method: 'POST', body }),
      invalidatesTags: ['my-profile', 'profile'],
    }),
    updateEducation: builder.mutation<unknown, { id: string } & Partial<EducationWriteData>>({
      query: ({ id, ...body }) => ({ url: `profiles/me/educations/${id}/`, method: 'PATCH', body }),
      invalidatesTags: ['my-profile', 'profile'],
    }),
    deleteEducation: builder.mutation<unknown, string>({
      query: (id) => ({ url: `profiles/me/educations/${id}/`, method: 'DELETE' }),
      invalidatesTags: ['my-profile', 'profile'],
    }),
    addPortfolioProject: builder.mutation<unknown, PortfolioWriteData>({
      query: (body) => ({ url: 'profiles/me/portfolio/', method: 'POST', body }),
      invalidatesTags: ['my-profile', 'profile'],
    }),
    updatePortfolioProject: builder.mutation<unknown, { id: string } & Partial<PortfolioWriteData>>({
      query: ({ id, ...body }) => ({ url: `profiles/me/portfolio/${id}/`, method: 'PATCH', body }),
      invalidatesTags: ['my-profile', 'profile'],
    }),
    deletePortfolioProject: builder.mutation<unknown, string>({
      query: (id) => ({ url: `profiles/me/portfolio/${id}/`, method: 'DELETE' }),
      invalidatesTags: ['my-profile', 'profile'],
    }),
    // Account security
    changePassword: builder.mutation<unknown, { current_password: string; new_password: string; confirm_password: string }>({
      query: (body) => ({ url: 'auth/password/change/', method: 'POST', body }),
    }),
    getSessions: builder.query<UserSession[], void>({
      query: () => 'auth/sessions/',
      transformResponse: (res: ApiSuccess<UserSession[]> | ApiPaginated<UserSession>) => ('results' in res ? res.results : unwrap(res)),
      providesTags: ['sessions'],
    }),
    // Every session, this device included (the api blacklists all the refresh tokens)
    logoutAll: builder.mutation<unknown, void>({
      query: () => ({ url: 'auth/logout-all/', method: 'POST' }),
    }),
    revokeSession: builder.mutation<unknown, string>({
      query: (id) => ({ url: `auth/sessions/${id}/`, method: 'DELETE' }),
      invalidatesTags: ['sessions'],
    }),
  }),
});

export const { 
  useMeAccountQuery, 
  useUpdateMeMutation,
  useGetUsersQuery,
  useGetPublicProfileQuery,
  useGetProfileFollowsQuery,
  useToggleFollowMutation,
  useGetProfileActivityQuery,
  useToggleUserAdminMutation,
  useToggleUserStatusMutation,
  useGetMyProfileQuery,
  useUpdateMyProfileMutation,
  useAddSkillMutation,
  useDeleteSkillMutation,
  useAddExperienceMutation,
  useUpdateExperienceMutation,
  useDeleteExperienceMutation,
  useAddEducationMutation,
  useUpdateEducationMutation,
  useDeleteEducationMutation,
  useAddPortfolioProjectMutation,
  useUpdatePortfolioProjectMutation,
  useDeletePortfolioProjectMutation,
  useChangePasswordMutation,
  useGetSessionsQuery,
  useRevokeSessionMutation,
  useLogoutAllMutation,

} = UserApi;
