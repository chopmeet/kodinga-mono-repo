import { useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';

import { getAdminCommunity } from '@/data/admin-community-details.data';
import type { CommunityListItem } from '@/utils/api/community/community.type';

const FAKE_LATENCY_MS = 250;

/** Community of the :slug route param (mock; with the api: GET communities/<slug>/) */
export function UseCommunityFromParams() {
  const { slug } = useParams();
  const [loadedSlug, setLoadedSlug] = useState<string | undefined>();

  useEffect(() => {
    const timer = setTimeout(() => setLoadedSlug(slug), FAKE_LATENCY_MS);
    return () => clearTimeout(timer);
  }, [slug]);

  return { community: getAdminCommunity(slug), isLoading: loadedSlug !== slug };
}

/** Tabs read the community loaded by the details page through the <Outlet> context */
export const useDetailsCommunity = () => useOutletContext<{ community: CommunityListItem }>().community;
