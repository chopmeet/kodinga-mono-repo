// Community AI (apps/ai)

/** CommunityWeeklyDigestSerializer (GET communities/<slug>/ai/weekly-digest/) */
export type WeeklyDigest = {
  id: string;
  week_identifier: string;
  headline: string;
  /** Written by the AI, or a plain template when it is out of order */
  summary_markdown: string;
  top_debates: { id: string; title: string; author: string; comments_count: number; post_type: string }[];
  highlighted_project: { id: string; title: string; slug: string; owner: string; tagline: string } | null;
  upcoming_events: { id: string; title: string; slug: string; start_date: string | null; host: string }[];
  kpis_snapshot: { new_members?: number; posts_created?: number; comments_posted?: number };
  created_at: string;
};

export type ChurnRiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** MemberChurnRiskItemSerializer */
export type ChurnRisk = {
  id: string;
  member_id: string;
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  risk_level: ChurnRiskLevel;
  risk_score: number;
  signals: { days_inactive?: number; total_recent_interactions?: number; activity_trend?: 'declining' | 'stable' };
  /** Empty for a low risk */
  suggested_nudge: string;
  status: string;
  nudge_sent_at: string | null;
};

/** GET communities/<slug>/ai/churn-dashboard/ (the 50 highest risks, the low ones included) */
export type ChurnDashboard = { community: string; total_at_risk: number; members: ChurnRisk[] };

/** PeerMatchItemSerializer (GET communities/<slug>/ai/peer-matches/) */
export type PeerMatch = {
  id: string;
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  match_reasons: string[];
  status: 'suggested' | 'accepted' | 'declined';
};

export type AIDifficulty = 'beginner' | 'intermediate' | 'advanced';

/** QuizQuestionItemSerializer: one right answer, by its position */
export type GeneratedQuizQuestion = { question: string; options: string[]; correct_index: number; explanation: string };

/** false: a template of the api because its AI failed, not a proposal for this lesson */
export type GeneratedQuiz = { questions: GeneratedQuizQuestion[]; is_ai_generated: boolean };

/** CodeExerciseGeneratedSerializer */
export type GeneratedExercise = {
  title: string;
  instructions_markdown: string;
  starter_code: string;
  solution_code: string;
  test_cases: { input: string; expected_output: string }[];
  language: string;
};

export type GeneratedExerciseResult = { exercise: GeneratedExercise; is_ai_generated: boolean };

/** POST communities/<slug>/ai/hackathon-suggestions/ (a list, without the envelope) */
export type TeammateSuggestion = {
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  match_reasons: string[];
};

/** POST communities/<slug>/ai/semantic-search/: posts and lessons close in meaning to the query */
export type SemanticSearchResult = {
  query: string;
  count: number;
  results: { 
    id: string; 
    content_type: 'post' | 'lesson' | 'event'; 
    title: string; 
    similarity_score: number; 
    url: string; 
    snippet: string; 
  }[];
};

/** POST communities/<slug>/ai/check-duplicates/: questions already asked, close to a draft */
export type DuplicateCheck = {
  has_duplicates: boolean;
  count: number;
  duplicates: { id: string; title: string; similarity_score: number; url: string; snippet: string; is_solved: boolean }[];
};

/** GET posts/<id>/help-assistance/: what the question lacks, and members who know its subject */
export type HelpAssistance = {
  post_id: string;
  matching_skills: string[];
  ai_comment_draft: string;
  suggested_mentors: { user_id: string; username: string; first_name: string; last_name: string; avatar_url: string | null; matching_skills: string[]; reputation_score: number }[];
  /** "notified" once mentors were told */
  status: string;
};
