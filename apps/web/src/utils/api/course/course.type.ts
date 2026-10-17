// Mirrors apps/classroom (models/*.py, serializers/course.py, module.py, lesson.py)

export type CourseLevel = 'beginner' | 'intermediate' | 'advanced' | 'all_levels';
export type LessonType = 'text' | 'video' | 'hybrid' | 'article' | 'code' | 'quiz';

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
};
