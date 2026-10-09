import { createContext, useContext } from 'react';

import type { MyCommunity, SpaceRole } from '@/data/community-space.data';

/** Sections of the space; what each role may open */
export type SpaceSection = 'dashboard' | 'members' | 'posts' | 'payments' | 'settings' | 'danger';

const ACCESS: Record<SpaceSection, SpaceRole[]> = {
  dashboard: ['owner', 'admin', 'moderator'],
  members: ['owner', 'admin', 'moderator'],
  posts: ['owner', 'admin', 'moderator'],
  payments: ['owner'],
  // Same as the api: owner and admins edit the community, only the owner deletes or transfers it
  settings: ['owner', 'admin'],
  danger: ['owner'],
};

export const canAccess = ({ community, role }: MyCommunity, section: SpaceSection) =>
  ACCESS[section].includes(role) && (section !== 'payments' || community.pricing_type === 'paid');

export const CommunitySpaceContext = createContext<MyCommunity | null>(null);

/** Community + role of the current /c/:slug page (set by CommunitySpaceLayout) */
export function useCommunitySpace() {
  const space = useContext(CommunitySpaceContext);
  if (!space) throw new Error('useCommunitySpace must be used inside CommunitySpaceLayout');
  return space;
}

/** Same, but null outside of a community space (the shared dashboard sidebar uses it) */
export const useOptionalCommunitySpace = () => useContext(CommunitySpaceContext);
