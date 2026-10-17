import { createContext, useContext } from 'react';

import type { MyCommunity, SpaceRole } from '@/data/community-space.data';

/** Sections of the space; what each role may open */
export type SpaceSection = 'dashboard' | 'members' | 'posts' | 'events' | 'hackathons' | 'courses' | 'opportunities' | 'leaderboard' | 'projects' | 'payments' | 'settings' | 'danger';

const ACCESS: Record<SpaceSection, SpaceRole[]> = {
  dashboard: ['owner', 'admin', 'moderator'],
  members: ['owner', 'admin', 'moderator'],
  posts: ['owner', 'admin', 'moderator'],
  // Everyone of the team sees them; managing them is for the owner and admins (canManageEvents)
  events: ['owner', 'admin', 'moderator'],
  hackathons: ['owner', 'admin', 'moderator'],
  courses: ['owner', 'admin', 'moderator'],
  opportunities: ['owner', 'admin', 'moderator'],
  leaderboard: ['owner', 'admin', 'moderator'],
  projects: ['owner', 'admin', 'moderator'],
  payments: ['owner'],
  // Same as the api: owner and admins edit the community, only the owner deletes or transfers it
  settings: ['owner', 'admin'],
  danger: ['owner'],
};

export const canAccess = ({ community, role }: MyCommunity, section: SpaceSection) =>
  ACCESS[section].includes(role) && (section !== 'payments' || community.pricing_type === 'paid');

/** Same rule as the api (EventService.check_is_manager): the owner and the admins create and run events */
export const canManageEvents = ({ role }: MyCommunity) => role === 'owner' || role === 'admin';

/** HackathonSelector.is_community_manager: same rule (owner and admins) */
export const canManageHackathons = canManageEvents;

/** ClassroomService.check_manager_permission: same rule (owner and admins) */
export const canManageCourses = canManageEvents;

/**
 * The api lets any signed-in user post an offer for a community (no check on community_id);
 * here only the owner and admins publish. Editing, closing and the applications stay with the
 * poster (OpportunityService: poster or staff).
 */
export const canPublishOpportunities = canManageEvents;

export const CommunitySpaceContext = createContext<MyCommunity | null>(null);

/** Community + role of the current /c/:slug page (set by CommunitySpaceLayout) */
export function useCommunitySpace() {
  const space = useContext(CommunitySpaceContext);
  if (!space) throw new Error('useCommunitySpace must be used inside CommunitySpaceLayout');
  return space;
}

/** Same, but null outside of a community space (the shared dashboard sidebar uses it) */
export const useOptionalCommunitySpace = () => useContext(CommunitySpaceContext);
