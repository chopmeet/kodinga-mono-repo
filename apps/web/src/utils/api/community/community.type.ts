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
