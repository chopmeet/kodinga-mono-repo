import { createApi, fetchBaseQuery, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';

import { ApiBaseUrl } from '@/utils/http';
import { type ApiPaginated, type ApiSuccess, unwrap } from '../api.type';
import { prepareHeaders } from '../user/user.api';
import type {
  CommunityCategory,
  CommunityCreateData,
  CommunityFeedQuery,
  CommunityMemberItem,
  CommunityMembersQuery,
  CommunityPostItem,
  CommunityDetail,
  CommunityListItem,
  CommunityListQuery,
  ManagedCommunity,
  ManagedRole,
  SanctionData,
} from './community.type';

const MANAGED_ROLES: ManagedRole[] = ['owner', 'admin', 'moderator'];

/** Drops empty filters so the api does not receive `?q=&category=` */
const cleanParams = (query: CommunityListQuery) =>
  Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ''));

export const CommunityApi = createApi({
  reducerPath: 'communityApi',
  tagTypes: ['communities', 'categories', 'members', 'posts'],
  baseQuery: fetchBaseQuery({ baseUrl: ApiBaseUrl, prepareHeaders }),
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
    /**
     * Communities the signed-in user manages (owner / admin / moderator), with the role.
     * communities/my/ lists every active membership but without the role: the role comes from
     * each community detail (user_membership). One request per community until the list
     * endpoint returns it.
     */
    getMyManagedCommunities: builder.query<ManagedCommunity[], void>({
      async queryFn(_arg, _api, _extra, baseQuery) {
        const list = await baseQuery({ url: 'communities/my/', params: { page_size: 100 } });
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
    sanctionMember: builder.mutation<unknown, SanctionData>({
      query: ({ slug, memberId, ...body }) => ({ url: `communities/${slug}/members/${memberId}/sanctions/`, method: 'POST', body }),
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
    // The api archives (is_active = false): owner or superuser only
    archiveCommunity: builder.mutation<ApiSuccess<undefined>, string>({
      query: (slug) => ({ url: `communities/${slug}/`, method: 'DELETE' }),
      invalidatesTags: ['communities'],
    }),
  }),
});

export const {
  useGetCommunitiesQuery,
  useDiscoverCommunitiesQuery,
  useGetCommunityCategoriesQuery,
  useGetCommunityQuery,
  useGetMyManagedCommunitiesQuery,
  useCreateCommunityMutation,
  useArchiveCommunityMutation,
  useGetCommunityMembersQuery,
  useDecideMemberMutation,
  useSanctionMemberMutation,
  useGetCommunityFeedQuery,
  useTogglePostPinMutation,
  useTogglePostLockMutation,
  useDeletePostMutation,
} = CommunityApi;
