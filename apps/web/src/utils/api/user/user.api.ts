import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { ApiBaseUrl } from '@/utils/http';
import { AppStorage } from '@/utils/storage';
import { type ApiSuccess, unwrap } from '../api.type';
import type { AuthState, User, UserFormData } from './user.type';

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
  tagTypes: ['user'],
  baseQuery: fetchBaseQuery({ baseUrl: ApiBaseUrl, prepareHeaders }),
  endpoints: (builder) => ({
    meAccount: builder.query<User, void>({
      query: () => 'users/me/',
      transformResponse: unwrap<User>,
      providesTags: ['user'],
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
  
} = UserApi;
