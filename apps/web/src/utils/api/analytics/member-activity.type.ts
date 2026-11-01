// Activity of the signed-in member (apps/analytics/serializers/member_activity.py): what they did in
// the events, courses, opportunities and hackathons, across Kodinga or in one community

/** MinimalCommunitySerializer */
export type ActivityCommunity = { id: string; name: string; slug: string; logo_url: string };

export type HackathonResult = 'won' | 'podium' | 'submitted' | 'in_progress' | 'pending' | 'rejected' | 'withdrawn' | 'failed';

export type MemberHackathonKpis = {
  total_participated: number;
  successful_count: number;
  failed_count: number;
  in_progress_count: number;
  prizes_won_count: number;
  submissions_count: number;
  /** 0 to 100 */
  success_rate: number;
};

export type MemberHackathon = {
  id: string;
  title: string;
  slug: string;
  tagline: string;
  banner_url: string | null;
  status: string;
  status_display: string;
  start_time: string;
  end_time: string;
  community: ActivityCommunity | null;
  participation_mode: 'individual' | 'team';
  team: { id: string; name: string; slug: string; role: string; is_leader: boolean } | null;
  submission: { id: string; title: string; slug: string; status: string; is_final: boolean; rank: number | null } | null;
  member_result: HackathonResult;
  is_winner: boolean;
  is_podium: boolean;
};

export type MemberEventKpis = {
  total_registered: number;
  attended_count: number;
  upcoming_count: number;
  completed_count: number;
  missed_count: number;
  /** 0 to 100 */
  attendance_rate: number;
};

export type MemberEvent = {
  id: string;
  title: string;
  slug: string;
  event_type: string;
  event_type_display: string;
  format: string;
  format_display: string;
  status: string;
  status_display: string;
  start_time: string;
  end_time: string;
  community: ActivityCommunity | null;
  rsvp_status: string;
  rsvp_status_display: string;
  is_checked_in: boolean;
  is_upcoming: boolean;
  is_in_progress: boolean;
  is_completed: boolean;
};

export type MemberOpportunityKpis = {
  total_applied: number;
  accepted_count: number;
  rejected_count: number;
  in_review_count: number;
  /** 0 to 100 */
  success_rate: number;
};

export type MemberApplication = {
  id: string;
  status: 'pending' | 'reviewing' | 'shortlisted' | 'accepted' | 'rejected';
  status_display: string;
  applied_at: string;
  is_successful: boolean;
  is_failed: boolean;
  is_in_review: boolean;
  opportunity: { id: string; title: string; slug: string; company_name: string; company_logo_url: string; opportunity_type_display: string };
};

export type MemberCourseKpis = {
  total_enrolled: number;
  completed_count: number;
  in_progress_count: number;
  total_lessons_completed: number;
  /** 0 to 100 */
  average_progress_percent: number;
};

export type MemberCourse = {
  id: string;
  course_id: string;
  title: string;
  slug: string;
  level_display: string;
  thumbnail_url: string;
  community: ActivityCommunity | null;
  enrolled_at: string;
  completed_at: string | null;
  /** 0 to 100 */
  overall_progress_percent: number;
  total_lessons: number;
  completed_lessons: number;
  is_completed: boolean;
};

/**
 * MemberActivityDashboardResponseSerializer: GET analytics/member/dashboard/ (all communities) or
 * communities/<slug>/me/dashboard/ (one community). The highlights are the 3 latest of each module.
 */
export type MemberActivity = {
  kpis: {
    hackathons: MemberHackathonKpis;
    events: MemberEventKpis;
    opportunities: MemberOpportunityKpis;
    courses: MemberCourseKpis;
  };
  highlights: {
    recent_hackathons: MemberHackathon[];
    upcoming_or_recent_events: MemberEvent[];
    recent_opportunity_applications: MemberApplication[];
    active_courses: MemberCourse[];
  };
};
