import { useEffect, useState } from 'react';

import { TechnologyPicker } from '@/pages/shared/technology-picker';
import type { PortfolioProject } from '@/utils/api/profile/profile.type';
import type { ProfileEntries } from '../form/UseProfileEntries';
import { EntryModal, Field } from './entry-modal';

type Target = { project: PortfolioProject | null } | null;
const isUrl = (v: string) => !v.trim() || /^https?:\/\/\S+\.\S+/.test(v.trim());

/** Add or edit a project of the portfolio */
function ProjectModal({ entries, target, onClose }: { entries: ProfileEntries; target: Target; onClose: () => void }) {
  const p = target?.project ?? null;
  const [v, setV] = useState({ title: '', description: '', project_url: '', repo_url: '', thumbnail_url: '', is_featured: false });
  const [techs, setTechs] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setV({
      title: p?.title ?? '',
      description: p?.description ?? '',
      project_url: p?.project_url ?? '',
      repo_url: p?.repo_url ?? '',
      thumbnail_url: p?.thumbnail_url ?? '',
      is_featured: p?.is_featured ?? false,
    });
    setTechs(p?.technologies.map((t) => ({ id: t.id, name: t.name })) ?? []);
    setError(null);
  }, [target, p]);

  const set = (changes: Partial<typeof v>) => setV((current) => ({ ...current, ...changes }));

  const save = async () => {
    if (!v.title.trim()) return setError('Donnez un titre au projet.');
    if (![v.project_url, v.repo_url, v.thumbnail_url].every(isUrl)) return setError('Un des liens est invalide (https://…).');
    const ok = await entries.saveProject(p?.id ?? null, {
      title: v.title.trim(),
      description: v.description,
      project_url: v.project_url.trim(),
      repo_url: v.repo_url.trim(),
      thumbnail_url: v.thumbnail_url.trim(),
      is_featured: v.is_featured,
      technology_ids: techs.map((t) => t.id),
    });
    if (ok) onClose();
  };

  return (
    <EntryModal open={!!target} title={p ? 'Modifier le projet' : 'Ajouter un projet'} busy={entries.isSaving} error={error} onClose={onClose} onSubmit={save}>
      <Field label="Titre" wide value={v.title} onChange={(x) => set({ title: x.target.value })} placeholder="Wari Pay, une app de tontine" />
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="custom-form-label">Présentation</span>
        <textarea rows={4} value={v.description} onChange={(x) => set({ description: x.target.value })} placeholder="Le problème, la solution, votre rôle…" className="custom-form-control bg-background px-3 py-2" />
      </label>
      <Field label="Démo en ligne" type="url" value={v.project_url} onChange={(x) => set({ project_url: x.target.value })} placeholder="https://…" />
      <Field label="Dépôt du code" type="url" value={v.repo_url} onChange={(x) => set({ repo_url: x.target.value })} placeholder="https://github.com/…" />
      <Field label="Image (lien)" wide type="url" value={v.thumbnail_url} onChange={(x) => set({ thumbnail_url: x.target.value })} placeholder="https://…/capture.png" />
      <TechnologyPicker id="project-tech" value={techs} onAdd={(t) => setTechs((c) => [...c, { id: t.id, name: t.name }])} onRemove={(id) => setTechs((c) => c.filter((t) => t.id !== id))} />
      <label className="flex items-center gap-2 text-sm text-body sm:col-span-2">
        <input type="checkbox" checked={v.is_featured} onChange={(x) => set({ is_featured: x.target.checked })} className="size-4 accent-(--primary)" />
        Mettre en avant en tête du portfolio
      </label>
    </EntryModal>
  );
}

export default ProjectModal;
