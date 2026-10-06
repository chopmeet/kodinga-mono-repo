import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { ApiBaseUrl } from '@/utils/http';
import { type ApiSuccess, unwrap } from '../api.type';
import { prepareHeaders } from '../user/user.api';
import type { User } from '../user/user.type';
import type {
  ForgotPasswordFormData,
  LoginFormData,
  LoginResult,
  ResetPasswordFormData,
} from './auth.type';

export const AuthApi = createApi({
  reducerPath: 'authApi',
  tagTypes: ['auth'],
  baseQuery: fetchBaseQuery({ baseUrl: ApiBaseUrl, prepareHeaders }),
  endpoints: (builder) => ({
    loginUser: builder.mutation<LoginResult, LoginFormData>({
      query: (body) => ({ url: 'auth/login/', method: 'POST', body }),
      transformResponse: unwrap<LoginResult>,
      invalidatesTags: ['auth'],
    }),
    logoutUser: builder.mutation<void, { refresh?: string | null }>({
      query: (body) => ({ url: 'auth/logout/', method: 'POST', body, timeout: 5000 }),
    }),
    // Always answers 200 (no account enumeration): the email arrives only if the account exists
    forgotPassword: builder.mutation<ApiSuccess<undefined>, ForgotPasswordFormData>({
      query: (body) => ({ url: 'auth/password/reset/', method: 'POST', body }),
    }),
    resetUserPassword: builder.mutation<User, ResetPasswordFormData>({
      query: (body) => ({ url: 'auth/password/reset/confirm/', method: 'POST', body }),
      transformResponse: unwrap<User>,
    }),
  }),
});

export const {
  useLoginUserMutation,
  useLogoutUserMutation,
  useForgotPasswordMutation,
  useResetUserPasswordMutation,
} = AuthApi;
