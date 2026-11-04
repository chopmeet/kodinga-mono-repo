// Mirrors apps/hackathons (models/*.py, serializers/hackathon.py, serializers/application.py)

export type HackathonFormat = 'online' | 'in_person' | 'hybrid';
export type HackathonStatus =
  | 'draft'
  | 'published'
  | 'registration_open'
  | 'registration_closed'
  | 'in_progress'
  | 'submission_closed'
  | 'judging'
  | 'completed'
  | 'cancelled';
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'waitlisted' | 'withdrawn';
export type ParticipationMode = 'individual' | 'team';

export type HackathonPrize = {
  id: string;
  title: string;
  description: string;
  reward_amount: string | null;
  reward_currency: string;
  reward_description: string;
  rank: number;
};

export type HackathonCriterion = {
  id: string;
  name: string;
  description: string;
  min_score: string;
  max_score: string;
  weight: string;
};

/** HackathonListSerializer */
export type HackathonListItem = {
  id: string;
  community: { id: string; name: string; slug: string };
  organizer: { id: string; username: string; full_name?: string } | null;
  title: string;
  slug: string;
  tagline: string;
  cover_image_url: string;
  format: HackathonFormat;
  venue_city: string;
  venue_country: string;
  theme: string;
  main_language: string;
  registration_start: string;
  registration_end: string;
  start_time: string;
  submission_deadline: string;
  judging_end: string;
  results_announced_at: string | null;
  timezone: string;
  status: HackathonStatus;
  is_registration_open: boolean;
  is_submission_open: boolean;
  results_published: boolean;
  prizes_count: number;
  participants_count: number;
  created_at: string;
};

/** HackathonDetailSerializer */
export type Hackathon = HackathonListItem & {
  description: string;
  venue_name: string;
  venue_address: string;
  location_url: string;
  target_audience: string;
  prerequisites: string;
  rules_url: string;
  terms_and_conditions: string;
  is_member_only: boolean;
  allow_teams: boolean;
  min_team_size: number;
  max_team_size: number;
  max_participants: number | null;
  auto_accept_applications: boolean;
  require_demo_url: boolean;
  require_video_url: boolean;
  require_repo_url: boolean;
  results_published_at: string | null;
  prizes: HackathonPrize[];
  criteria: HackathonCriterion[];
  judges: HackathonJudge[];
  custom_registration_questions?: HackathonQuestion[];
  custom_submission_questions?: HackathonQuestion[];
  allowed_file_types?: string[];
  max_file_size_mb?: number;
  max_files_count?: number;
  /** Signed-in user (null for a visitor) */
  user_status?: HackathonUserStatus | null;
};

/** A question of the organizers (free-form JSON on the api: the usual keys are read) */
export type HackathonQuestion = { id?: string; key?: string; label?: string; question?: string; required?: boolean; type?: string };

/** HackathonDetailSerializer.get_user_status */
export type HackathonUserStatus = {
  has_applied: boolean;
  application_status: ApplicationStatus | null;
  team_id: string | null;
  team_name: string | null;
  has_submission: boolean;
  submission_id: string | null;
  submission_is_final: boolean;
  is_judge: boolean;
  is_manager: boolean;
};

/** POST apply/ */
export type HackathonApplyData = {
  participation_mode: ParticipationMode;
  team_name?: string;
  answers?: Record<string, string>;
  accept_terms: boolean;
};

/** PATCH submissions/my-project/ (HackathonSubmissionUpdateSerializer) */
export type HackathonSubmissionWriteData = Partial<{
  title: string;
  tagline: string;
  description: string;
  problem_statement: string;
  solution_statement: string;
  target_audience: string;
  demo_url: string;
  video_url: string;
  repository_url: string;
  gitlab_url: string;
  custom_answers: Record<string, string>;
}>;

export type SubmissionFileType = 'presentation_pdf' | 'screenshot' | 'technical_doc' | 'archive' | 'other';

/** HackathonCreateUpdateSerializer (prizes and criteria replace the existing ones) */
export type HackathonWriteData = {
  title: string;
  tagline?: string;
  description: string;
  cover_image_url?: string;
  format: HackathonFormat;
  venue_name?: string;
  venue_address?: string;
  venue_city?: string;
  venue_country?: string;
  location_url?: string;
  main_language?: string;
  theme?: string;
  target_audience?: string;
  prerequisites?: string;
  rules_url?: string;
  registration_start: string;
  registration_end: string;
  start_time: string;
  submission_deadline: string;
  judging_end: string;
  timezone: string;
  is_member_only: boolean;
  allow_teams: boolean;
  min_team_size: number;
  max_team_size: number;
  max_participants?: number | null;
  auto_accept_applications: boolean;
  require_demo_url: boolean;
  require_video_url: boolean;
  require_repo_url: boolean;
  prizes: { title: string; reward_amount?: number | null; reward_currency?: string; reward_description?: string; rank: number }[];
  criteria: { name: string; description?: string; max_score?: number; weight?: number }[];
};

/** DashboardMetricsSerializer */
export type HackathonDashboard = {
  status: HackathonStatus;
  total_applications: number;
  accepted_applications: number;
  pending_applications: number;
  total_teams: number;
  total_submissions: number;
  final_submissions: number;
  draft_submissions: number;
  judges_count: number;
  evaluations_completed: number;
};

/** HackathonApplicationSerializer */
export type HackathonApplication = {
  id: string;
  applicant: { id: string; username: string; first_name: string; last_name: string; email: string };
  participation_mode: ParticipationMode;
  team_name: string;
  status: ApplicationStatus;
  rejection_reason: string;
  reviewed_at: string | null;
  created_at: string;
};

/** User shape of the team / submission / judge serializers */
export type HackathonPerson = { id: string; username: string; first_name: string; last_name: string; email?: string };

export type HackathonJudge = { id: string; user: HackathonPerson; user_id: string; can_evaluate_all: boolean; created_at: string };

/** HackathonTeamSerializer */
export type HackathonTeam = {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  leader: HackathonPerson;
  members: { id: string; user: HackathonPerson; role: 'leader' | 'member'; status: 'invited' | 'accepted' | 'declined' | 'left' }[];
  active_members_count: number;
  created_at: string;
};

/** HackathonSubmissionListSerializer (+ files in the detail serializer) */
export type HackathonSubmission = {
  id: string;
  team: string | null;
  team_name: string;
  applicant: HackathonPerson;
  title: string;
  slug: string;
  tagline: string;
  demo_url: string;
  video_url: string;
  repository_url: string;
  gitlab_url: string;
  status: string;
  is_final: boolean;
  submitted_at: string | null;
  total_score: string | null;
  evaluations_count: number;
  rank: number | null;
  files_count: number;
  description?: string;
  problem_statement?: string;
  solution_statement?: string;
  target_audience?: string;
  custom_answers?: Record<string, string>;
  files?: { id: string; file_name: string; file_url: string; file_size: number; file_type?: SubmissionFileType }[];
};

/** HackathonEvaluationSerializer (GET / POST judging/projects/<id>/evaluate/) */
export type HackathonEvaluation = {
  id: string;
  weighted_score: string | null;
  general_feedback: string;
  private_notes: string;
  is_submitted: boolean;
  scores: { id: string; criterion: string; criterion_name: string; score: string; comment: string }[];
};

export type EvaluationWriteData = {
  scores: { criterion_id: string; score: number; comment?: string }[];
  general_feedback?: string;
  private_notes?: string;
  /** false: saved as a draft */
  is_submitted: boolean;
};

/** LeaderboardItemSerializer (GET results/) */
export type HackathonResult = {
  id: string;
  title: string;
  slug: string;
  tagline: string;
  applicant_username: string;
  team_name: string;
  demo_url: string;
  repository_url: string;
  total_score: string | null;
  evaluations_count: number;
  rank: number | null;
  won_prizes: HackathonPrize[];
};

/** GET hackathons/teams/my-invitations/ (HackathonTeamMemberSerializer): neither the title of the hackathon nor who invites */
export type MyTeamInvitation = {
  id: string;
  team_id: string;
  team_name: string;
  hackathon_slug: string;
  community_slug: string;
  invited_at: string;
};
