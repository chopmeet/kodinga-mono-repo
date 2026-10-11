import type { User } from '../user/user.type';

// Mirrors apps/communities (models/community.py, serializers/community.py, serializers/category.py)

export type CommunityPrivacy = 'public' | 'private' | 'secret';
export type CommunityPricing = 'free' | 'paid';

export type CommunityCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon_url: string;
  order: number;
  created_at: string;
};

/** CommunityListSerializer */
export type CommunityListItem = {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  avatar_url: string;
  banner_url: string;
  brand_color: string | null;
  category: CommunityCategory | null;
  owner: User;
  privacy_type: CommunityPrivacy;
  pricing_type: CommunityPricing;
  is_verified: boolean;
  is_featured: boolean;
  members_count: number;
  posts_count: number;
  courses_count: number;
  events_count: number;
  created_at: string;
};

/** Query params of GET communities/ */
export type CommunityListQuery = Partial<{
  q: string;
  category: string;
  privacy: CommunityPrivacy;
  pricing: CommunityPricing;
  is_featured: boolean;
  page: number;
  page_size: number;
}>;

export type CommunityRole = 'owner' | 'admin' | 'moderator' | 'member';

/** user_membership of the detail serializer (role of the signed-in user in this community) */
export type CommunityMembership = {
  is_member: boolean;
  role: CommunityRole | null;
  status: string | null;
};

/** CommunityDetailSerializer (GET communities/<slug>/, and the 201 of POST communities/) */
export type CommunityDetail = CommunityListItem & {
  description: string;
  user_membership: CommunityMembership;
};

/** CommunityCreateUpdateSerializer: the slug is generated from the name when omitted */
export type CommunityCreateData = {
  name: string;
  slug?: string;
  tagline?: string;
  category_id?: string | null;
  privacy_type: CommunityPrivacy;
  pricing_type: CommunityPricing;
  brand_color?: string;
  settings?: { require_approval_to_join?: boolean };
};

/** Roles that manage a community (plain members do not): they open /c/<slug> */
export type ManagedRole = Exclude<CommunityRole, 'member'>;

/** A community the signed-in user manages, with their role in it */
export type ManagedCommunity = { community: CommunityListItem; role: ManagedRole };
