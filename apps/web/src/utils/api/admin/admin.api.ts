import { createApi } from '@reduxjs/toolkit/query/react';

import { unwrap } from '../api.type';
import type {
  AdminDashboardSummary,
  EngagementAnalytics,
  FinancialAnalytics,
  MonthlyGrowthPoint,
  SystemSetting,
  SystemSettingWrite,
} from './admin.type';
import { authBaseQuery } from '../authBaseQuery';

/** Platform administration (super-admins only, IsPlatformAdmin) */
export const AdminApi = createApi({
  reducerPath: 'adminApi',
  tagTypes: ['settings'],
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
    // Creates or updates one key (traced in the audit log by the api)
    updateSystemSetting: builder.mutation<SystemSetting, SystemSettingWrite>({
      query: (body) => ({ url: 'admin/settings/', method: 'PATCH', body }),
      transformResponse: unwrap<SystemSetting>,
      invalidatesTags: ['settings'],
    }),
  }),
});

export const {
  useGetAdminDashboardQuery,
  useGetFinancialAnalyticsQuery,
  useGetEngagementAnalyticsQuery,
  useGetMonthlyGrowthAnalyticsQuery,
  useGetSystemSettingsQuery,
  useUpdateSystemSettingMutation,
} = AdminApi;
