import type { CourseLevel, LessonType } from '@/utils/api/course/course.type';
import { translatedLabels } from '@/utils/translated';

/** Texts in locales/<lang>/labels.ts, read in the current language */
export const courseLevelLabel = translatedLabels<CourseLevel>('labels.courseLevel.', ['all_levels', 'beginner', 'intermediate', 'advanced']);

export const lessonTypeLabel = translatedLabels<LessonType>('labels.lessonType.', ['text', 'article', 'code', 'quiz', 'video', 'hybrid']);

/** 5400 -> "1 h 30", 600 -> "10 min", 0 -> "" */
export function formatDuration(seconds: number) {
  if (!seconds) return '';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}
