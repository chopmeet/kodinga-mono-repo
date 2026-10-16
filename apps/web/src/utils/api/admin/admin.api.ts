import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { ApiBaseUrl } from '@/utils/http';
import { unwrap } from '../api.type';
import { prepareHeaders } from '../user/user.api';
import type { SystemSetting, SystemSettingWrite } from './admin.type';

/** Platform administration (super-admins only, IsPlatformAdmin) */
export const AdminApi = createApi({
  reducerPath: 'adminApi',
  tagTypes: ['settings'],
  baseQuery: fetchBaseQuery({ baseUrl: ApiBaseUrl, prepareHeaders }),
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
