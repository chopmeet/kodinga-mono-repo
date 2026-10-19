import type { User } from '../user/user.type';

// Mirrors apps/profiles (serializers/profile.py DeveloperProfileDetailSerializer, serializers/skill.py)

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type AvailabilityStatus = 'available' | 'open_to_offers' | 'busy' | 'unavailable';
export type EmploymentType = 'full_time' | 'part_time' | 'freelance' | 'contract' | 'internship' | 'apprenticeship';
type ProfileTechnology = { id: string; name: string; slug?: string; icon_url?: string };

export type ProfileSkill = {
  id: string;
  technology: ProfileTechnology;
  level: SkillLevel;
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
  gitlab_username?: string;
  open_to_freelance?: boolean;
  open_to_remote?: boolean;
  open_to_relocation?: boolean;
  experiences?: ProfileExperience[];
  educations?: ProfileEducation[];
  portfolio_projects?: PortfolioProject[];
};

export type ProfileExperience = {
  id: string;
  title: string;
  company_name: string;
  company_url: string;
  location: string;
  employment_type: EmploymentType;
  is_remote: boolean;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string;
  technologies: ProfileTechnology[];
};

export type ProfileEducation = {
  id: string;
  institution: string;
  degree: string;
  field_of_study: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string;
};

export type PortfolioProject = {
  id: string;
  title: string;
  description: string;
  project_url: string;
  repo_url: string;
  thumbnail_url: string;
  is_featured: boolean;
  order: number;
  technologies: ProfileTechnology[];
};

/** GET profiles/me/ (DeveloperProfileDetailSerializer, private fields included) */
export type MyProfile = Omit<PublicProfile, 'availability_status'> & {
  availability_status: AvailabilityStatus;
  preferred_language: string;
  gitlab_username: string;
  youtube_url: string;
  discord_handle: string;
  custom_links: { title: string; url: string }[];
  hourly_rate: string | null;
  currency: string;
  is_public: boolean;
  open_to_freelance: boolean;
  open_to_relocation: boolean;
  open_to_remote: boolean;
  completion_percentage: number;
  experiences: ProfileExperience[];
  educations: ProfileEducation[];
  portfolio_projects: PortfolioProject[];
};

/** PATCH profiles/me/ (DeveloperProfileUpdateSerializer) */
export type ProfileWriteData = Partial<
  Pick<
    MyProfile,
    | 'headline'
    | 'bio'
    | 'avatar_url'
    | 'banner_url'
    | 'location'
    | 'website_url'
    | 'github_username'
    | 'gitlab_username'
    | 'linkedin_url'
    | 'twitter_handle'
    | 'youtube_url'
    | 'discord_handle'
    | 'years_of_experience'
    | 'availability_status'
    | 'is_public'
    | 'is_mentor'
    | 'open_to_freelance'
    | 'open_to_relocation'
    | 'open_to_remote'
  >
>;

export type SkillWriteData = { technology_id?: string; technology_name?: string; level: SkillLevel; years_of_experience: number; is_highlighted?: boolean };
export type ExperienceWriteData = Omit<ProfileExperience, 'id' | 'technologies'> & { technology_ids?: string[] };
export type EducationWriteData = Omit<ProfileEducation, 'id'>;
export type PortfolioWriteData = Omit<PortfolioProject, 'id' | 'technologies' | 'order'> & { technology_ids?: string[] };

/** GET auth/sessions/ (UserSessionSerializer) */
export type UserSession = {
  id: string;
  device_name: string;
  ip_address: string | null;
  user_agent: string;
  last_seen_at: string | null;
  expires_at: string;
  is_active: boolean;
  revoked_at: string | null;
  created_at: string;
};
