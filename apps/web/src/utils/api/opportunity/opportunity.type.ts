// Opportunities (apps/opportunities): job offers and bounties, optionally tied to a community.
// These views answer the serializer data as is (no { success, data } envelope).

export type OpportunityType = 'full_time' | 'part_time' | 'contract' | 'freelance' | 'internship' | 'bounty';
export type WorkplaceType = 'remote' | 'hybrid' | 'onsite';
export type ExperienceLevel = 'all' | 'junior' | 'mid' | 'senior' | 'lead';
export type OpportunityStatus = 'open' | 'closed' | 'draft';
export type OpportunityApplicationStatus = 'pending' | 'reviewing' | 'shortlisted' | 'accepted' | 'rejected';

export type OpportunityPerson = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  avatar_url: string;
};

export type OpportunityTechnology = { id: string; name: string; slug: string; icon_url: string };

/** OpportunitySerializer (lists) */
export type OpportunityListItem = {
  id: string;
  title: string;
  slug: string;
  company_name: string;
  company_logo_url: string;
  company_website: string;
  opportunity_type: OpportunityType;
  workplace_type: WorkplaceType;
  location: string;
  /** Decimals, as strings */
  salary_min: string | null;
  salary_max: string | null;
  currency: string;
  experience_level: ExperienceLevel;
  status: OpportunityStatus;
  views_count: number;
  applications_count: number;
  expires_at: string | null;
  has_applied: boolean;
  poster: OpportunityPerson;
  technologies: OpportunityTechnology[];
  created_at: string;
};

/** OpportunityDetailSerializer */
export type Opportunity = OpportunityListItem & {
  description: string;
  requirements: string;
  apply_url: string;
  apply_email: string;
  community_id: string | null;
  updated_at: string;
};

/** CreateOpportunitySerializer (PATCH takes any subset) */
export type OpportunityWriteData = {
  title: string;
  company_name: string;
  company_logo_url: string;
  company_website: string;
  opportunity_type: OpportunityType;
  workplace_type: WorkplaceType;
  location: string;
  salary_min: string | null;
  salary_max: string | null;
  currency: string;
  experience_level: ExperienceLevel;
  description: string;
  requirements: string;
  apply_url: string;
  apply_email: string;
  status: OpportunityStatus;
  community_id: string | null;
  technology_ids: string[];
};

export type OpportunitiesQuery = {
  community: string;
  type?: OpportunityType;
  workplace?: WorkplaceType;
  experience?: ExperienceLevel;
  search?: string;
};

/**
 * GET opportunities/ without a community: the open offers the viewer may see (no private or paid
 * community offer unless member). The api ignores type and workplace: filter those on the page.
 */
export type GlobalOpportunitiesQuery = { search?: string; experience?: ExperienceLevel; tech?: string };

/** OpportunityApplicationSerializer */
export type OpportunityApplication = {
  id: string;
  opportunity: OpportunityListItem;
  applicant: OpportunityPerson;
  resume_url: string;
  cover_letter: string;
  portfolio_url: string;
  status: OpportunityApplicationStatus;
  created_at: string;
  updated_at: string;
};

/** GET profiles/technologies/ (enveloped) */
export type Technology = { id: string; name: string; slug: string; icon_url?: string; category?: string };
