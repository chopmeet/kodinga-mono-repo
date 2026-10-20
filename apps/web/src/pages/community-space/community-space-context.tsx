import { createContext, useContext } from 'react';

import type { MyCommunity, SpaceRole } from '@/data/community-space.data';
import type { RolePermissionKey } from '@/utils/api/community/community.type';

/** Sections of the space; what each role may open */
export type SpaceSection = 'dashboard' | 'members' | 'posts' | 'events' | 'hackathons' | 'courses' | 'opportunities' | 'leaderboard' | 'projects' | 'payments' | 'settings' | 'roles' | 'danger';

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
  roles: ['owner'],
  danger: ['owner'],
};

export const canAccess = ({ community, role }: MyCommunity, section: SpaceSection) =>
  ACCESS[section].includes(role) && (section !== 'payments' || community.pricing_type === 'paid');

/** The owner and the admins (HackathonSelector.is_community_manager and the like: a fixed rule on the api) */
export const isCommunityManager = ({ role }: MyCommunity) => role === 'owner' || role === 'admin';

/**
 * A permission of the role of the user, as set by the owner in Paramètres > Rôles
 * (settings.all_role_permissions of the community; has_community_permission on the api). The owner
 * has them all; without the settings, the former rule (owner and admins) applies.
 */
export function hasSpacePermission(space: MyCommunity, permission: RolePermissionKey) {
  if (space.role === 'owner') return true;
  const granted = space.community.settings?.all_role_permissions?.[space.role]?.[permission];
  return granted ?? isCommunityManager(space);
}

/** EventService.check_is_manager: the owner, and the roles allowed to manage the events */
export const canManageEvents = (space: MyCommunity) => hasSpacePermission(space, 'can_manage_events');

/** HackathonSelector.is_community_manager: owner and admins (not configurable on the api yet) */
export const canManageHackathons = isCommunityManager;

/** ClassroomService.check_manager_permission: the owner, and the roles allowed to manage the courses */
export const canManageCourses = (space: MyCommunity) => hasSpacePermission(space, 'can_manage_courses');

/**
 * The api lets any signed-in user post an offer for a community (no check on community_id);
 * here only the owner and admins publish. Editing, closing and the applications stay with the
 * poster (OpportunityService: poster or staff).
 */
export const canPublishOpportunities = isCommunityManager;

export const CommunitySpaceContext = createContext<MyCommunity | null>(null);

/** Community + role of the current /c/:slug page (set by CommunitySpaceLayout) */
export function useCommunitySpace() {
  const space = useContext(CommunitySpaceContext);
  if (!space) throw new Error('useCommunitySpace must be used inside CommunitySpaceLayout');
  return space;
}

/** Same, but null outside of a community space (the shared dashboard sidebar uses it) */
export const useOptionalCommunitySpace = () => useContext(CommunitySpaceContext);
