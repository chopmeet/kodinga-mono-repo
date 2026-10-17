import { ArrowBigUp, Eye, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn } from '@kodinga-mono-repo/ui';
import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import { personName } from '@/pages/shared/person';
import { type RowAction, RowActions } from '@/pages/shared/row-actions';
import type { ProjectListItem } from '@/utils/api/project/project.type';

/** A project of the grid: cover, title, tagline, owner, votes / views, technologies */
export function ProjectCard({ project: p, href, actions, mine }: { project: ProjectListItem; href: string; actions: RowAction[]; mine: boolean }) {
  return (
    <li className="group relative flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="relative h-32 shrink-0">
        {p.cover_image_url ? <img src={p.cover_image_url} alt="" className="absolute inset-0 size-full object-cover" /> : <GlassBackdrop fade={false} />}
        {p.is_featured && (
          <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-amber-950">
            <Star className="size-3" aria-hidden />
            En avant
          </span>
        )}
        {actions.length > 0 && (
          <div className="absolute top-2 right-2 z-10 rounded-lg bg-white/90">
            <RowActions label={`Actions pour ${p.title}`} actions={actions} />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <Link to={href} className="font-semibold text-slate-900 after:absolute after:inset-0 hover:text-primary">
          {p.title}
        </Link>
        {p.tagline && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{p.tagline}</p>}
        <p className="mt-2 text-xs text-slate-500">
          par {personName(p.owner)}
          {mine && <span className="ml-1 font-semibold text-brand">(vous)</span>}
        </p>
        {p.technologies.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Technologies">
            {p.technologies.slice(0, 4).map((t) => (
              <li key={t.id} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {t.name}
              </li>
            ))}
            {p.technologies.length > 4 && <li className="px-1 text-xs text-slate-500">+{p.technologies.length - 4}</li>}
          </ul>
        )}
        <div className="mt-auto flex items-center gap-4 pt-4 text-sm text-slate-600">
          <span className={cn('flex items-center gap-1', p.is_upvoted && 'font-semibold text-brand')}>
            <ArrowBigUp className="size-4" aria-hidden />
            {p.upvotes_count} vote{p.upvotes_count > 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="size-4 text-slate-400" aria-hidden />
            {p.views_count} vue{p.views_count > 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </li>
  );
}
