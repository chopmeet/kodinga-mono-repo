import { BookOpen, Clock, Layers, PartyPopper, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@kodinga/ui';
import { Logo } from '@/layouts/components/header';
import { formatDuration } from '@/pages/community-space/courses/course-labels';
import type { CoursePlayer } from './form/UseCoursePlayer';

function Figure({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-subtle px-3 py-3">
      <span className="text-brand-strong" aria-hidden>
        {icon}
      </span>
      <span className="text-lg font-bold text-foreground tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * Congratulations once the api has confirmed the course done: its name, what was achieved (lessons,
 * modules, time, the points it gave), then another course
 */
export function CourseCompletedDialog({ player }: { player: CoursePlayer }) {
  const { t } = useTranslation();
  const course = player.course;
  if (!course) return null;
  const duration = formatDuration(course.duration_seconds);

  return (
    <Dialog open={player.justFinished} onOpenChange={(open) => !open && player.closeCongratulations()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto text-center sm:max-w-md">
        <Logo variant="full" link={false} className="mx-auto" />
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-amber-50 text-amber-600" aria-hidden>
          <PartyPopper className="size-8" />
        </span>
        <DialogHeader className="items-center text-center sm:text-center">
          <DialogTitle className="text-2xl">{t('course.completed.title')}</DialogTitle>
          <DialogDescription>
            {t('course.completed.text')} <strong className="text-foreground">« {course.title} »</strong>.
          </DialogDescription>
        </DialogHeader>

        <div role="group" aria-label={t('course.completed.achieved')} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Figure icon={<BookOpen className="size-5" />} value={String(player.lessons.length)} label={t('course.completed.lessons', { count: player.lessons.length })} />
          <Figure icon={<Layers className="size-5" />} value={String(course.modules_count)} label={t('course.completed.modules', { count: course.modules_count })} />
          {duration && <Figure icon={<Clock className="size-5" />} value={duration} label={t('course.completed.content')} />}
          {player.earnedPoints > 0 && <Figure icon={<Sparkles className="size-5" />} value={`+${player.earnedPoints}`} label={t('course.completed.points', { count: player.earnedPoints })} />}
        </div>
        <div className="h-2 rounded-full bg-emerald-100" role="progressbar" aria-label={t('course.progressLabel')} aria-valuenow={100} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full w-full rounded-full bg-emerald-600" />
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button asChild className="w-full">
            <Link to={`/communities/${player.slug}?tab=classroom`}>{t('course.completed.another')}</Link>
          </Button>
          <Button variant="outline" className="w-full" onClick={player.closeCongratulations}>
            {t('course.completed.review')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
