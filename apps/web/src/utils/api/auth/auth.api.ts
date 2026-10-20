import { createApi } from '@reduxjs/toolkit/query/react';

import { type ApiSuccess, unwrap } from '../api.type';
import type { User } from '../user/user.type';
import type {
  ForgotPasswordFormData,
  LoginFormData,
  LoginResult,
  OAuthCallbackData,
  OAuthProvider,
  OAuthStartResult,
  RegisterFormData,
  ResetPasswordFormData,
  VerifyEmailData,
} from './auth.type';
import { authBaseQuery } from '../authBaseQuery';

export const AuthApi = createApi({
  reducerPath: 'authApi',
  tagTypes: ['auth'],
  baseQuery: authBaseQuery,
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
    registerUser: builder.mutation<User, RegisterFormData>({
      query: (body) => ({ url: 'auth/register/', method: 'POST', body }),
      transformResponse: unwrap<User>,
    }),
    verifyEmail: builder.mutation<User, VerifyEmailData>({
      query: (body) => ({ url: 'auth/verify-email/', method: 'POST', body }),
      transformResponse: unwrap<User>,
    }),
    // Always answers 200 (no account enumeration), like forgotPassword
    resendVerification: builder.mutation<ApiSuccess<undefined>, ForgotPasswordFormData>({
      query: (body) => ({ url: 'auth/resend-verification/', method: 'POST', body }),
    }),
    oauthStart: builder.mutation<OAuthStartResult, { provider: OAuthProvider; redirect_uri: string }>({
      query: ({ provider, redirect_uri }) => ({ url: `auth/${provider}/start/`, params: { redirect_uri } }),
      transformResponse: unwrap<OAuthStartResult>,
    }),
    oauthCallback: builder.mutation<LoginResult, OAuthCallbackData>({
      query: ({ provider, ...body }) => ({ url: `auth/${provider}/callback/`, method: 'POST', body }),
      transformResponse: unwrap<LoginResult>,
      invalidatesTags: ['auth'],
    }),
  }),
});

export const {
  useLoginUserMutation,
  useLogoutUserMutation,
  useForgotPasswordMutation,
  useResetUserPasswordMutation,
  useRegisterUserMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useOauthStartMutation,
  useOauthCallbackMutation,
} = AuthApi;
