// What the signed-in user can do on a member, by role. Mirrors the api
// (memberships/services/membership_service.py): moderators and above moderate,
// only the owner sanctions an admin, nobody touches the owner.
import type { SpaceRole } from '@/data/community-space.data';
import type { CommunityRole, MembershipStatus } from '@/utils/api/community/community.type';

/** Any member shape (api member, mock member) */
type Target = { role: CommunityRole; status: MembershipStatus };

/** Approve / refuse a join request */
export const canReviewRequest = (_actor: SpaceRole, target: Target) => target.status === 'pending';

/** Suspend, ban or reactivate */
export const canSanction = (actor: SpaceRole, target: Target) =>
  target.status !== 'pending' && target.role !== 'owner' && (target.role !== 'admin' || actor === 'owner');

/**
 * Roles the actor can give to the target. Owner: up to admin. Admin: up to moderator, and not on
 * another admin (stricter than the api, which lets an admin demote an admin). Ownership transfer
 * belongs to the settings page.
 */
export function assignableRoles(actor: SpaceRole, target: Target): Exclude<CommunityRole, 'owner'>[] {
  if (target.status !== 'active' || target.role === 'owner') return [];
  if (actor === 'owner') return (['admin', 'moderator', 'member'] as const).filter((r) => r !== target.role);
  if (actor === 'admin' && target.role !== 'admin') return (['moderator', 'member'] as const).filter((r) => r !== target.role);
  return [];
}

/**
 * Invitations: the owner and the admins (the api also lets members invite when allow_member_invites
 * is on, but only the owner and admins list the invitations).
 */
export const canInvite = (actor: SpaceRole) => actor === 'owner' || actor === 'admin';

/**
 * Roles an invitation may give. The api does not check it yet (anyone can invite as admin or owner):
 * here the same rule as the role changes, the owner up to admin, an admin up to moderator.
 */
export const invitableRoles = (actor: SpaceRole): Exclude<CommunityRole, 'owner'>[] =>
  actor === 'owner' ? ['member', 'moderator', 'admin'] : actor === 'admin' ? ['member', 'moderator'] : [];
