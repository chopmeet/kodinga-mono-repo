import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';

import { canAccess, type SpaceSection, useCommunitySpace } from './community-space-context';

/** Sends a role that may not open this section back to the space dashboard */
function SectionGuard({ section, children }: { section: SpaceSection; children: ReactElement }) {
  const space = useCommunitySpace();
  if (!canAccess(space, section)) return <Navigate to={`/c/${space.community.slug}/dashboard`} replace />;
  return children;
}

export default SectionGuard;
