import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { useOutletContext, useParams } from 'react-router-dom';

import { useGetCommunityQuery } from '@/utils/api/community/community.api';
import type { CommunityDetail } from '@/utils/api/community/community.type';

/** Community of the :slug route param: GET communities/<slug>/ (404 = unknown or archived) */
export function UseCommunityFromParams() {
  const { slug = '' } = useParams();
  const { data, isLoading, error, refetch } = useGetCommunityQuery(slug, { skip: !slug });
  const notFound = (error as FetchBaseQueryError | undefined)?.status === 404;

  return { community: data, isLoading, notFound, error: notFound ? undefined : error, refetch };
}

/** Tabs read the community loaded by the details page through the <Outlet> context */
export const useDetailsCommunity = () => useOutletContext<{ community: CommunityDetail }>().community;
