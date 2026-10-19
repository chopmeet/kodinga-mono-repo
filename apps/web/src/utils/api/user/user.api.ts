import { createApi } from '@reduxjs/toolkit/query/react';

import { type ApiPaginated, type ApiSuccess, unwrap } from '../api.type';
import { authBaseQuery } from '../authBaseQuery';
import type { PublicProfile } from '../profile/profile.type';
import type { User, UserFormData, UsersQuery } from './user.type';

export const UserApi = createApi({
  reducerPath: 'userApi',
  tagTypes: ['user', 'users', 'profile'],
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
    updateMe: builder.mutation<User, UserFormData>({
      query: (body) => ({ url: 'users/me/', method: 'PATCH', body }),
      transformResponse: (res: ApiSuccess<User>) => res.data,
      invalidatesTags: ['user'],
    }),
  }),
});

export const { 
  useMeAccountQuery, 
  useUpdateMeMutation,
  useGetUsersQuery,
  useGetPublicProfileQuery,
  useToggleUserAdminMutation,
  useToggleUserStatusMutation,

} = UserApi;
