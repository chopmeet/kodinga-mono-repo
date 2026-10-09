// What the signed-in user can do on a member, by role. Mirrors the api
// (memberships/services/membership_service.py): moderators and above moderate,
// only the owner sanctions an admin, nobody touches the owner.
import type { AdminMember, MemberRole } from '@/data/admin-community-details.data';
import type { SpaceRole } from '@/data/community-space.data';

/** Approve / refuse a join request */
export const canReviewRequest = (_actor: SpaceRole, target: AdminMember) => target.status === 'pending';

/** Suspend, ban or reactivate */
export const canSanction = (actor: SpaceRole, target: AdminMember) =>
  target.status !== 'pending' && target.role !== 'owner' && (target.role !== 'admin' || actor === 'owner');

/**
 * Roles the actor can give to the target. Owner: up to admin. Admin: up to moderator, and not on
 * another admin (stricter than the api, which lets an admin demote an admin). Ownership transfer
 * belongs to the settings page.
 */
export function assignableRoles(actor: SpaceRole, target: AdminMember): Exclude<MemberRole, 'owner'>[] {
  if (target.status !== 'active' || target.role === 'owner') return [];
  if (actor === 'owner') return (['admin', 'moderator', 'member'] as const).filter((r) => r !== target.role);
  if (actor === 'admin' && target.role !== 'admin') return (['moderator', 'member'] as const).filter((r) => r !== target.role);
  return [];
}
