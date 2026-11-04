import { BookOpen, Clock, Layers, PartyPopper, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@kodinga-mono-repo/ui';
import { Logo } from '@/layouts/components/header';
import { formatDuration } from '@/pages/community-space/courses/course-labels';
import type { CoursePlayer } from './form/UseCoursePlayer';

function Figure({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-slate-50 px-3 py-3">
      <span className="text-blue-900" aria-hidden>
        {icon}
      </span>
      <span className="text-lg font-bold text-slate-900 tabular-nums">{value}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}

/**
 * Congratulations once the api has confirmed the course done: its name, what was achieved (lessons,
 * modules, time, the points it gave), then another course
 */
export function CourseCompletedDialog({ player }: { player: CoursePlayer }) {
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
          <DialogTitle className="text-2xl">Félicitations !</DialogTitle>
          <DialogDescription>
            Vous avez terminé la formation <strong className="text-slate-900">« {course.title} »</strong>.
          </DialogDescription>
        </DialogHeader>

        <div role="group" aria-label="Ce que vous avez accompli" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Figure icon={<BookOpen className="size-5" />} value={String(player.lessons.length)} label={player.lessons.length > 1 ? 'leçons suivies' : 'leçon suivie'} />
          <Figure icon={<Layers className="size-5" />} value={String(course.modules_count)} label={course.modules_count > 1 ? 'modules' : 'module'} />
          {duration && <Figure icon={<Clock className="size-5" />} value={duration} label="de contenu" />}
          {player.earnedPoints > 0 && <Figure icon={<Sparkles className="size-5" />} value={`+${player.earnedPoints}`} label={player.earnedPoints > 1 ? 'points gagnés' : 'point gagné'} />}
        </div>
        <div className="h-2 rounded-full bg-emerald-100" role="progressbar" aria-label="Progression de la formation" aria-valuenow={100} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full w-full rounded-full bg-emerald-600" />
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button asChild className="w-full">
            <Link to={`/communities/${player.slug}?tab=classroom`}>Suivre une autre formation</Link>
          </Button>
          <Button variant="outline" className="w-full" onClick={player.closeCongratulations}>
            Revoir la formation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
