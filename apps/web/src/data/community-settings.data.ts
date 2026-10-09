// Mock settings of a community, edited in /c/:slug/settings. Shapes mirror the api
// (communities/models: Community, CommunitySettings, CommunityRule).
// With the api: PATCH communities/<slug>/, PATCH .../settings/, CRUD .../rules/.
import type { CommunityListItem, CommunityPrivacy } from '@/utils/api/community/community.type';
import { getCommunityRules } from './admin-community-details.data';

export type PostPermission = 'all_members' | 'moderators_only' | 'admins_only';

export type CommunityProfile = {
  name: string;
  tagline: string;
  description: string;
  category_id: string;
  brand_color: string;
  website_url: string;
  github_url: string;
  discord_url: string;
  twitter_url: string;
};

export type CommunityAccess = {
  privacy_type: CommunityPrivacy;
  require_approval_to_join: boolean;
  allow_member_invites: boolean;
  default_post_permission: PostPermission;
  welcome_message: string;
};

export type CommunityRule = { id: string; title: string; description: string };

export function getCommunityProfile(community: CommunityListItem): CommunityProfile {
  return {
    name: community.name,
    tagline: community.tagline,
    description: `${community.tagline}\n\nRejoignez-nous pour échanger, apprendre et construire ensemble.`,
    category_id: community.category?.id ?? '',
    brand_color: community.brand_color ?? '#1D4ED8',
    website_url: '',
    github_url: `https://github.com/${community.slug}`,
    discord_url: '',
    twitter_url: '',
  };
}

export function getCommunityAccess(community: CommunityListItem): CommunityAccess {
  const { settings } = getCommunityRules(community);
  return { privacy_type: community.privacy_type, ...settings };
}

export const getCommunityRuleList = (community: CommunityListItem): CommunityRule[] =>
  getCommunityRules(community).rules.map((rule, i) => ({ id: `${community.slug}-rule${i}`, ...rule }));
