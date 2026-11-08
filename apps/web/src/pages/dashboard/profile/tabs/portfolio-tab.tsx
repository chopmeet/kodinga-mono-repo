import { Code2, ExternalLink, FolderKanban, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button, Loader } from '@kodinga/ui';
import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import type { PortfolioProject } from '@/utils/api/profile/profile.type';
import UseProfileEntries from '../form/UseProfileEntries';
import ProjectModal from '../modals/project-modal';

/** /dashboard/profile/portfolio — the projects shown on the public profile, featured ones first */
function PortfolioTab() {
  const entries = UseProfileEntries();
  const [target, setTarget] = useState<{ project: PortfolioProject | null } | null>(null);
  const projects = [...(entries.profile?.portfolio_projects ?? [])].sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || a.order - b.order);

  if (entries.isLoading) return <Loader inline size="sm" message="Chargement…" />;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Vos réalisations : apps, sites, contributions open source, projets de hackathon…</p>
        <Button size="sm" onClick={() => setTarget({ project: null })}>
          <Plus /> Ajouter un projet
        </Button>
      </div>
      {projects.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center">
          <FolderKanban className="size-8 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-900">Votre portfolio est vide</p>
          <p className="mt-1 text-sm text-slate-500">Montrez ce que vous avez construit : c’est ce que les recruteurs regardent en premier.</p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2" aria-label="Portfolio">
          {projects.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="relative h-32">
                {p.thumbnail_url ? <img src={p.thumbnail_url} alt="" className="absolute inset-0 size-full object-cover" /> : <GlassBackdrop fade={false} />}
                {p.is_featured && (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    <Star className="size-3 fill-amber-400 text-amber-400" /> À la une
                  </span>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">{p.title}</h3>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" aria-label={`Modifier ${p.title}`} onClick={() => setTarget({ project: p })} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800">
                      <Pencil className="size-4" />
                    </button>
                    <button type="button" aria-label={`Supprimer ${p.title}`} onClick={() => entries.deleteProject(p.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
                {p.description && <p className="mt-1 line-clamp-3 text-sm text-slate-600">{p.description}</p>}
                {p.technologies.length > 0 && <p className="mt-2 text-xs text-slate-500">{p.technologies.map((t) => t.name).join(' · ')}</p>}
                <p className="mt-3 flex gap-4 text-sm">
                  {p.project_url && (
                    <a href={p.project_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-blue-900 hover:underline">
                      <ExternalLink className="size-3.5" /> Démo
                    </a>
                  )}
                  {p.repo_url && (
                    <a href={p.repo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-blue-900 hover:underline">
                      <Code2 className="size-3.5" /> Code
                    </a>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ProjectModal entries={entries} target={target} onClose={() => setTarget(null)} />
    </div>
  );
}

export default PortfolioTab;
