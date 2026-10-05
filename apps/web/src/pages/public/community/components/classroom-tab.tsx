import { Clock, Lock, PlayCircle } from 'lucide-react';

import { cn } from '@kodinga-mono-repo/ui';
import type { CommunityDetails } from '@/data/community.data';

const formatDuration = (min: number) =>
  min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60}` : ''}`;

export function ClassroomTab({ community }: { community: CommunityDetails }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {community.modules.map((module, i) => (
        <article key={module.id} className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div
            className={cn(
              'relative flex h-28 items-center justify-center bg-gradient-to-br',
              community.coverClassName,
              !module.preview && 'opacity-80 grayscale-[35%]'
            )}
          >
            <span className="absolute top-3 left-3 rounded bg-black/40 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
              MODULE {i + 1}
            </span>
            {module.preview ? (
              <PlayCircle className="size-10 text-white/90" />
            ) : (
              <Lock className="size-8 text-white/80" />
            )}
          </div>
          <div className="flex flex-1 flex-col p-4">
            <h3 className="font-bold text-slate-900">{module.title}</h3>
            <p className="mt-1 flex items-center gap-3 text-xs text-slate-500">
              <span>{module.lessons} leçons</span>
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" /> {formatDuration(module.durationMin)}
              </span>
            </p>
            <p className={cn('mt-3 text-xs font-semibold', module.preview ? 'text-emerald-700' : 'text-slate-400')}>
              {module.preview ? 'Aperçu gratuit' : 'Réservé aux membres'}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
