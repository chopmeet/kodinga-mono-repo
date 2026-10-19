import { createApi } from '@reduxjs/toolkit/query/react';

import { unwrap } from '../api.type';
import type { SystemSetting, SystemSettingWrite } from './admin.type';
import { authBaseQuery } from '../authBaseQuery';

/** Platform administration (super-admins only, IsPlatformAdmin) */
export const AdminApi = createApi({
  reducerPath: 'adminApi',
  tagTypes: ['settings'],
  baseQuery: authBaseQuery,
  endpoints: (builder) => ({
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

export const { useGetSystemSettingsQuery, useUpdateSystemSettingMutation } = AdminApi;
