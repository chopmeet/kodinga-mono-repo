// Mock data for the community space (/c/:slug), seen by the signed-in user.
// With the api: GET communities/my/ (+ user_membership.role of each community).
import type { ManagedCommunity, ManagedRole } from '@/utils/api/community/community.type';
import { adminCommunities } from './admin-communities.data';

/** Roles that open the community space (plain members do not manage anything) */
export type SpaceRole = ManagedRole;

export type MyCommunity = ManagedCommunity;

// The mock signed-in user manages these communities, with different roles to try the menus
const MY_MEMBERSHIPS: { slug: string; role: SpaceRole }[] = [
  { slug: 'lagos-ai-data', role: 'owner' },
  { slug: 'dakar-devops', role: 'owner' },
  { slug: 'frontend-francophone', role: 'admin' },
  { slug: 'python-africa-core', role: 'moderator' },
];

export const myCommunities: MyCommunity[] = MY_MEMBERSHIPS.flatMap(({ slug, role }) => {
  const community = adminCommunities.find((c) => c.slug === slug);
  return community ? [{ community, role }] : [];
});

export const getMyCommunity = (slug: string | undefined) => myCommunities.find((m) => m.community.slug === slug);

export const roleLabel: Record<SpaceRole, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  moderator: 'Modérateur',
};
