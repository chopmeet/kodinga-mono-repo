import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { ApiBaseUrl } from '@/utils/http';
import { AppStorage } from '@/utils/storage';
import { QueryUrl } from '@/utils/Utils';
import type {
  AuthState,
  PaginationResults,
  TypeQuery,
  User,
  UserFormData,
} from './user.type';

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
  tagTypes: ['user', 'usersList'],
  baseQuery: fetchBaseQuery({ baseUrl: ApiBaseUrl, prepareHeaders }),
  endpoints: (builder) => ({
    meAccount: builder.query<User, void>({
      query: () => 'me/',
      providesTags: ['user'],
    }),
    getUsersList: builder.query<PaginationResults<User>, TypeQuery>({
      query: (q) => QueryUrl('users', q),
      providesTags: ['usersList'],
    }),
    addOrEditUser: builder.mutation<User, { id?: number; data: UserFormData }>({
      query: ({ id, data }) => ({
        url: id ? `users/${id}/` : 'users/',
        method: id ? 'PUT' : 'POST',
        body: data,
      }),
      invalidatesTags: ['user', 'usersList'],
    }),
    deleteUser: builder.mutation<void, number>({
      query: (id) => ({ url: `users/${id}/`, method: 'DELETE' }),
      invalidatesTags: ['usersList'],
    }),
  }),
});

export const {
  useMeAccountQuery,
  useGetUsersListQuery,
  useAddOrEditUserMutation,
  useDeleteUserMutation,
} = UserApi;
