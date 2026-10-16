import type { User } from '../user/user.type';

// Mirrors apps/profiles (serializers/profile.py DeveloperProfileDetailSerializer, serializers/skill.py)

export type ProfileSkill = {
  id: string;
  technology: { id: string; name: string; slug?: string; icon_url?: string };
  level: string;
  years_of_experience: number | null;
  is_highlighted: boolean;
};

/** GET profiles/<username>/ (public profiles only, 404 otherwise) */
export type PublicProfile = {
  id: string;
  user: User;
  display_name: string;
  headline: string;
  bio: string;
  avatar_url: string;
  banner_url: string;
  location: string;
  country_code: string;
  website_url: string;
  github_username: string;
  linkedin_url: string;
  twitter_handle: string;
  years_of_experience: number | null;
  availability_status: string;
  is_mentor: boolean;
  views_count: number;
  reputation_points: number;
  skills: ProfileSkill[];
};
