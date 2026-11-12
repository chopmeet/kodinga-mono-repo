import { createApi } from '@reduxjs/toolkit/query/react';

import { unwrap } from '../api.type';
import type { AdminPayoutsResponse, CommunityPayout } from '../billing/billing.type';
import type {
  AdminDashboardSummary,
  EngagementAnalytics,
  FinancialAnalytics,
  MonthlyGrowthPoint,
  SystemSetting,
  SystemSettingWrite,
} from './admin.type';
import { authBaseQuery } from '../authBaseQuery';

export type AdminPayoutsFilterParams = {
  status?: string;
  community?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
};

/** Platform administration (super-admins only, IsPlatformAdmin) */
export const AdminApi = createApi({
  reducerPath: 'adminApi',
  tagTypes: ['settings', 'payouts'],
  baseQuery: authBaseQuery,
  endpoints: (builder) => ({
    // Key figures + 10 latest audit log entries
    getAdminDashboard: builder.query<AdminDashboardSummary, void>({
      query: () => 'admin/dashboard/',
      transformResponse: unwrap<AdminDashboardSummary>,
    }),
    getFinancialAnalytics: builder.query<FinancialAnalytics, void>({
      query: () => 'analytics/financial/',
      transformResponse: unwrap<FinancialAnalytics>,
    }),
    getEngagementAnalytics: builder.query<EngagementAnalytics, void>({
      query: () => 'analytics/engagement/',
      transformResponse: unwrap<EngagementAnalytics>,
    }),
    getMonthlyGrowthAnalytics: builder.query<MonthlyGrowthPoint[], void>({
      query: () => 'analytics/growth/',
      transformResponse: unwrap<MonthlyGrowthPoint[]>,
    }),
    getSystemSettings: builder.query<SystemSetting[], void>({
      query: () => 'admin/settings/',
      transformResponse: unwrap<SystemSetting[]>,
      providesTags: ['settings'],
    }),
    // The is_public settings, for everyone (no admin rights): e.g. who may create a community
    getPublicSettings: builder.query<SystemSetting[], void>({
      query: () => 'system/settings/public/',
      transformResponse: unwrap<SystemSetting[]>,
      providesTags: ['settings'],
    }),
    // Creates or updates one key (traced in the audit log by the api)
    updateSystemSetting: builder.mutation<SystemSetting, SystemSettingWrite>({
      query: (body) => ({ url: 'admin/settings/', method: 'PATCH', body }),
      transformResponse: unwrap<SystemSetting>,
      invalidatesTags: ['settings'],
    }),
    // Payout requests management (Backoffice superadmin)
    getAdminPayouts: builder.query<AdminPayoutsResponse, AdminPayoutsFilterParams | void>({
      query: (params) => ({
        url: 'billing/admin/payouts/',
        params: params || {},
      }),
      providesTags: ['payouts'],
    }),
    approveAdminPayout: builder.mutation<CommunityPayout, { payoutId: string; admin_note?: string }>({
      query: ({ payoutId, ...body }) => ({
        url: `billing/admin/payouts/${payoutId}/approve/`,
        method: 'POST',
        body,
      }),
      transformResponse: unwrap<CommunityPayout>,
      invalidatesTags: ['payouts'],
    }),
    rejectAdminPayout: builder.mutation<CommunityPayout, { payoutId: string; reason: string; admin_note?: string }>({
      query: ({ payoutId, ...body }) => ({
        url: `billing/admin/payouts/${payoutId}/reject/`,
        method: 'POST',
        body,
      }),
      transformResponse: unwrap<CommunityPayout>,
      invalidatesTags: ['payouts'],
    }),
    disburseAdminPayout: builder.mutation<CommunityPayout, { payoutId: string; admin_note?: string }>({
      query: ({ payoutId, ...body }) => ({
        url: `billing/admin/payouts/${payoutId}/disburse/`,
        method: 'POST',
        body,
      }),
      transformResponse: unwrap<CommunityPayout>,
      invalidatesTags: ['payouts'],
    }),
  }),
});

export const {
  useGetAdminDashboardQuery,
  useGetFinancialAnalyticsQuery,
  useGetEngagementAnalyticsQuery,
  useGetMonthlyGrowthAnalyticsQuery,
  useGetSystemSettingsQuery,
  useGetPublicSettingsQuery,
  useUpdateSystemSettingMutation,
  useGetAdminPayoutsQuery,
  useApproveAdminPayoutMutation,
  useRejectAdminPayoutMutation,
  useDisburseAdminPayoutMutation,
} = AdminApi;
