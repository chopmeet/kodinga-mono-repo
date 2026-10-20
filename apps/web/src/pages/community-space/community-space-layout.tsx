import { Navigate, useParams } from 'react-router-dom';

import { Loader } from '@kodinga-mono-repo/ui';
import type { MyCommunity, SpaceRole } from '@/data/community-space.data';
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
 * The role comes from the api (user_membership of GET communities/<slug>/).
 */
function CommunitySpaceLayout() {
  const { slug = '' } = useParams();
  const user = useUser();
  const { data, isLoading, isFetching } = useGetCommunityQuery(slug, { skip: !user || !slug });
  const space = spaceFromApi(data);

  if (isLoading || (isFetching && !space)) {
    return <Loader inline size="lg" className="min-h-svh" message="Chargement de votre espace…" />;
  }

  if (!space) return <Navigate to="/c" replace state={{ deniedSlug: slug }} />;

  return (
    <CommunitySpaceContext.Provider value={space}>
      <DashboardLayout />
    </CommunitySpaceContext.Provider>
  );
}

export default CommunitySpaceLayout;
