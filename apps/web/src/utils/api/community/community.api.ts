import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { ApiBaseUrl } from '@/utils/http';
import { type ApiPaginated, type ApiSuccess, unwrap } from '../api.type';
import { prepareHeaders } from '../user/user.api';
import type { CommunityCategory, CommunityListItem, CommunityListQuery } from './community.type';

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
  useArchiveCommunityMutation,
} = CommunityApi;
