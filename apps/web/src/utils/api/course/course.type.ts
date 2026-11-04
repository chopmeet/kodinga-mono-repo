// Mirrors apps/classroom (models/*.py, serializers/course.py, module.py, lesson.py)

export type CourseLevel = 'beginner' | 'intermediate' | 'advanced' | 'all_levels';
export type LessonType = 'text' | 'video' | 'hybrid' | 'article' | 'code' | 'quiz';

export type QuizQuestionType = 'single_choice' | 'multiple_choice';

/** is_correct: only for those who manage the course (the api hides it from the learners) */
export type QuizOption = { id: string; text: string; is_correct?: boolean };

export type QuizQuestion = {
  id: string;
  question: string;
  question_type: QuizQuestionType;
  points: number;
  options: QuizOption[];
  explanation?: string;
};

/** quiz_data of a lesson (LessonDetailSerializer); {} without a quiz */
export type QuizData = { title?: string; description?: string; passing_score?: number; questions?: QuizQuestion[] };

/** Result of a quiz: POST .../quiz/submit/, and user_quiz_result (the last attempt) of the lesson */
export type QuizResult = {
  score_percent: number;
  passing_score: number;
  passed: boolean;
  earned_points: number;
  total_points: number;
  correct_questions_count: number;
  total_questions_count: number;
  submitted_at: string;
  question_results: {
    question_id: string;
    question: string;
    question_type: QuizQuestionType;
    selected_option_ids: string[];
    correct_option_ids: string[];
    is_correct: boolean;
    explanation: string;
  }[];
  /** Answer of the submit only */
  just_completed_course?: boolean;
};

/** One block of code of a lesson (a code exercise: ids "starter", "solution", "test_cases") */
export type LessonCodeBlock = { id: string; language: string; title: string; code: string };

/** Lesson video on a platform: played in its own player (video_embed_url) */
export type VideoProvider = 'youtube' | 'vimeo' | 'dailymotion' | 'direct' | 'mux' | 'uploadthing' | '';

/** LessonSerializer (list) — LessonDetailSerializer adds content, images, attachments */
export type CourseLesson = {
  id: string;
  module: string;
  title: string;
  slug: string;
  lesson_type: LessonType;
  content_format: 'markdown' | 'html' | 'json';
  cover_image_url: string;
  duration_seconds: number;
  estimated_duration_display: string;
  has_video: boolean;
  order: number;
  is_free_preview: boolean;
  content?: string;
  /** Signed-in learner: done, or not reachable yet (sequential course) */
  is_completed?: boolean;
  is_locked?: boolean;
  reading_time_minutes?: number;
  video_hls_url?: string;
  video_source_url?: string;
  video_thumbnail_url?: string;
  /** Mux: waiting, preparing (encoding), ready, errored */
  video_status?: 'waiting' | 'preparing' | 'ready' | 'errored' | 'deleted' | '';
  video_provider?: VideoProvider;
  video_embed_url?: string;
  code_language?: string;
  /** Detail: the starting code of a code exercise */
  code_snippet?: string;
  code_blocks?: LessonCodeBlock[];
  /** Detail */
  quiz_data?: QuizData;
  user_quiz_result?: QuizResult | null;
  quiz_passed?: boolean;
  quiz_attempts_count?: number;
  attachments?: { name?: string; file_name?: string; url?: string; file_url?: string }[];
};

export type CourseModule = {
  id: string;
  title: string;
  description: string;
  order: number;
  lessons_count: number;
  lessons: CourseLesson[];
};

/** CourseSerializer — CourseDetailSerializer adds the modules (with their lessons) */
export type Course = {
  id: string;
  title: string;
  slug: string;
  description: string;
  level: CourseLevel;
  thumbnail_url: string;
  is_published: boolean;
  is_sequential: boolean;
  order: number;
  modules_count: number;
  lessons_count: number;
  duration_seconds: number;
  duration_minutes: number;
  created_at: string;
  modules?: CourseModule[];
  /** Signed-in user: progress (0-100) and enrollment */
  user_progress_percent?: number;
  user_is_enrolled?: boolean;
};

export type CourseWriteData = {
  title: string;
  description?: string;
  level: CourseLevel;
  thumbnail_url?: string;
  is_published?: boolean;
  is_sequential?: boolean;
};

export type ModuleWriteData = { title: string; description?: string; order?: number };

export type LessonWriteData = {
  title: string;
  lesson_type: LessonType;
  content?: string;
  content_format?: 'markdown';
  cover_image_url?: string;
  duration_seconds?: number;
  order?: number;
  is_free_preview?: boolean;
  code_language?: string;
  code_snippet?: string;
  code_blocks?: LessonCodeBlock[];
  quiz_data?: QuizData;
};
