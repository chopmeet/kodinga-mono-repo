// Mock data for the community space (/c/:slug), seen by the signed-in user.
// With the api: GET communities/my/ (+ user_membership.role of each community).
import type { CommunityListItem } from '@/utils/api/community/community.type';
import { getCommunityMembers, getCommunityPayments, getCommunityPosts } from './admin-community-details.data';
import { adminCommunities } from './admin-communities.data';

/** Roles that open the community space (plain members do not manage anything) */
export type SpaceRole = 'owner' | 'admin' | 'moderator';

export type MyCommunity = { community: CommunityListItem; role: SpaceRole };

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

export type CommunityDashboard = {
  newMembers30d: number;
  posts30d: number;
  pendingRequests: number;
  lockedPosts: number;
  revenue30d: number;
  monthlyNewMembers: { month: string; newMembers: number }[];
  topPosts: { id: string; title: string; author: string; reactions: number; comments: number }[];
};

const MONTHS = ['Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct'];

export function getCommunityDashboard(community: CommunityListItem): CommunityDashboard {
  const members = getCommunityMembers(community);
  const posts = getCommunityPosts(community);
  const base = Math.max(20, Math.round(community.members_count / 40));
  // Steady growth with a small seasonal dip, derived from the community size
  const monthlyNewMembers = MONTHS.map((month, i) => ({
    month,
    newMembers: Math.round(base * (0.6 + i * 0.07) * (i === 1 || i === 9 ? 0.85 : 1)),
  }));
  const thirtyDaysAgo = Date.UTC(2026, 9, 9) - 30 * 86_400_000;

  return {
    newMembers30d: monthlyNewMembers[monthlyNewMembers.length - 1].newMembers,
    posts30d: Math.round(community.posts_count / 14),
    pendingRequests: members.filter((m) => m.status === 'pending').length,
    lockedPosts: posts.filter((p) => p.is_locked).length,
    revenue30d: getCommunityPayments(community)
      .filter((p) => p.status === 'PAID' && new Date(p.created_at).getTime() >= thirtyDaysAgo)
      .reduce((sum, p) => sum + p.amount, 0),
    monthlyNewMembers,
    topPosts: [...posts]
      .sort((a, b) => b.reactions_count - a.reactions_count)
      .slice(0, 4)
      .map((p) => ({ id: p.id, title: p.title, author: p.author, reactions: p.reactions_count, comments: p.comments_count })),
  };
}
