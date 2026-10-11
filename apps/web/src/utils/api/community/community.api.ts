import { createApi, fetchBaseQuery, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';

import { ApiBaseUrl } from '@/utils/http';
import { type ApiPaginated, type ApiSuccess, unwrap } from '../api.type';
import { prepareHeaders } from '../user/user.api';
import type {
  CommunityCategory,
  CommunityCreateData,
  CommunityDetail,
  CommunityListItem,
  CommunityListQuery,
  ManagedCommunity,
  ManagedRole,
} from './community.type';

const MANAGED_ROLES: ManagedRole[] = ['owner', 'admin', 'moderator'];

/** Drops empty filters so the api does not receive `?q=&category=` */
const cleanParams = (query: CommunityListQuery) =>
  Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ''));

export const CommunityApi = createApi({
  reducerPath: 'communityApi',
  tagTypes: ['communities', 'categories'],
  baseQuery: fetchBaseQuery({ baseUrl: ApiBaseUrl, prepareHeaders }),
  endpoints: (builder) => ({
    getCommunities: builder.query<ApiPaginated<CommunityListItem>, CommunityListQuery>({
      query: (query) => ({ url: 'communities/', params: cleanParams(query) }),
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
    // The api archives (is_active = false): owner or superuser only
    archiveCommunity: builder.mutation<ApiSuccess<undefined>, string>({
      query: (slug) => ({ url: `communities/${slug}/`, method: 'DELETE' }),
      invalidatesTags: ['communities'],
    }),
  }),
});

export const {
  useGetCommunitiesQuery,
  useGetCommunityCategoriesQuery,
  useGetCommunityQuery,
  useGetMyManagedCommunitiesQuery,
  useCreateCommunityMutation,
  useArchiveCommunityMutation,
} = CommunityApi;
