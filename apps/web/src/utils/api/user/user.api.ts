import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { ApiBaseUrl } from '@/utils/http';
import { AppStorage } from '@/utils/storage';
import { type ApiPaginated, type ApiSuccess, unwrap } from '../api.type';
import type { AuthState, User, UserFormData, UsersQuery } from './user.type';

// Shared by every *Api: attaches the JWT stored by User.slice
export const prepareHeaders = (
  headers: Headers,
  { getState }: { getState: () => unknown }
) => {
  const token =
    (getState() as { user: AuthState }).user.token ??
    AppStorage.getItem<AuthState>('user')?.token;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
};

export const UserApi = createApi({
  reducerPath: 'userApi',
  tagTypes: ['user', 'users'],
  baseQuery: fetchBaseQuery({ baseUrl: ApiBaseUrl, prepareHeaders }),
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

} = UserApi;
