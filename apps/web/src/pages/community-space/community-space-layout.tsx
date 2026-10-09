import { Navigate, useParams } from 'react-router-dom';

import { getMyCommunity } from '@/data/community-space.data';
import DashboardLayout from '@/layouts/dashboard-layout';
import { CommunitySpaceContext } from './community-space-context';

/**
 * /c/:slug — guard + context of a community space. Only the owner, admins and moderators
 * of that community get in; anyone else is sent back to /c (their own communities).
 * Mock: memberships come from data/community-space.data.ts (api: user_membership).
 */
function CommunitySpaceLayout() {
  const { slug } = useParams();
  const space = getMyCommunity(slug);

  if (!space) return <Navigate to="/c" replace state={{ deniedSlug: slug }} />;

  return (
    <CommunitySpaceContext.Provider value={space}>
      <DashboardLayout />
    </CommunitySpaceContext.Provider>
  );
}

export default CommunitySpaceLayout;
