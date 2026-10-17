import type { CourseLevel, LessonType } from '@/utils/api/course/course.type';

export const courseLevelLabel: Record<CourseLevel, string> = {
  all_levels: 'Tous niveaux',
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  advanced: 'Avancé',
};

export const lessonTypeLabel: Record<LessonType, string> = {
  text: 'Texte',
  article: 'Article',
  code: 'Exercice de code',
  quiz: 'Quiz',
  video: 'Vidéo',
  hybrid: 'Mixte',
};

/** 5400 -> "1 h 30", 600 -> "10 min", 0 -> "" */
export function formatDuration(seconds: number) {
  if (!seconds) return '';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}
