import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { ApiBaseUrl } from '@/utils/http';
import { prepareHeaders } from '../user/user.api';
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
      invalidatesTags: ['auth'],
    }),
    logoutUser: builder.mutation<void, void>({
      query: () => ({ url: 'auth/logout/', method: 'POST' }),
    }),
    forgotPassword: builder.mutation<void, ForgotPasswordFormData>({
      query: (body) => ({ url: 'auth/forgot-password/', method: 'POST', body }),
    }),
    resetUserPassword: builder.mutation<void, ResetPasswordFormData>({
      query: (body) => ({ url: 'auth/reset-password/', method: 'POST', body }),
    }),
  }),
});

export const {
  useLoginUserMutation,
  useLogoutUserMutation,
  useForgotPasswordMutation,
  useResetUserPasswordMutation,
} = AuthApi;
