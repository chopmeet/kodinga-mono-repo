import { LoaderCircle } from 'lucide-react';
import { Navigate, useParams } from 'react-router-dom';

import { getMyCommunity, type MyCommunity, type SpaceRole } from '@/data/community-space.data';
import DashboardLayout from '@/layouts/dashboard-layout';
import { useGetCommunityQuery } from '@/utils/api/community/community.api';
import type { CommunityDetail } from '@/utils/api/community/community.type';
import { useUser } from '@/utils/Utils';
import { CommunitySpaceContext } from './community-space-context';

const SPACE_ROLES: SpaceRole[] = ['owner', 'admin', 'moderator'];

/** The signed-in user's role, when it opens the space (active owner / admin / moderator) */
function spaceFromApi(detail: CommunityDetail | undefined): MyCommunity | undefined {
  const membership = detail?.user_membership;
  const role = membership?.role as SpaceRole | null | undefined;
  if (!detail || !membership?.is_member || !role || !SPACE_ROLES.includes(role)) return undefined;
  return { community: detail, role };
}

/**
 * /c/:slug — guard + context of a community space. Only the owner, admins and moderators
 * of that community get in; anyone else is sent back to /c (their own communities).
 * Mock communities (data/community-space.data.ts) first, then the api (user_membership),
 * e.g. a community just created with the creation flow.
 */
function CommunitySpaceLayout() {
  const { slug = '' } = useParams();
  const user = useUser();
  const mock = getMyCommunity(slug);
  const { data, isLoading, isFetching } = useGetCommunityQuery(slug, { skip: !!mock || !user || !slug });
  const space = mock ?? spaceFromApi(data);

  if (!mock && (isLoading || (isFetching && !space))) {
    return (
      <div className="flex min-h-svh items-center justify-center gap-3 text-slate-600" role="status">
        <LoaderCircle className="size-5 animate-spin text-brand" />
        Chargement de votre espace…
      </div>
    );
  }

  if (!space) return <Navigate to="/c" replace state={{ deniedSlug: slug }} />;

  return (
    <CommunitySpaceContext.Provider value={space}>
      <DashboardLayout />
    </CommunitySpaceContext.Provider>
  );
}

export default CommunitySpaceLayout;
