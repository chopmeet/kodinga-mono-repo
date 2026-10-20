import { useEffect, useState } from 'react';

import { employmentLabel } from '@/pages/shared/profile-labels';
import { TechnologyPicker } from '@/pages/shared/technology-picker';
import type { EmploymentType, ProfileExperience } from '@/utils/api/profile/profile.type';
import { fromMonth, type ProfileEntries, toMonth } from '../form/UseProfileEntries';
import { EntryModal, Field } from './entry-modal';

type Target = { experience: ProfileExperience | null } | null;

/** Add or edit an experience (month precision, technologies of the catalog) */
function ExperienceModal({ entries, target, onClose }: { entries: ProfileEntries; target: Target; onClose: () => void }) {
  const e = target?.experience ?? null;
  const [v, setV] = useState({ title: '', company_name: '', company_url: '', location: '', employment_type: 'full_time' as EmploymentType, is_remote: false, start: '', end: '', is_current: false, description: '' });
  const [techs, setTechs] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setV({
      title: e?.title ?? '',
      company_name: e?.company_name ?? '',
      company_url: e?.company_url ?? '',
      location: e?.location ?? '',
      employment_type: e?.employment_type ?? 'full_time',
      is_remote: e?.is_remote ?? false,
      start: toMonth(e?.start_date),
      end: toMonth(e?.end_date),
      is_current: e?.is_current ?? false,
      description: e?.description ?? '',
    });
    setTechs(e?.technologies.map((t) => ({ id: t.id, name: t.name })) ?? []);
    setError(null);
  }, [target, e]);

  const set = (changes: Partial<typeof v>) => setV((current) => ({ ...current, ...changes }));

  const save = async () => {
    if (!v.title.trim() || !v.company_name.trim()) return setError('Le poste et l’entreprise sont obligatoires.');
    if (!v.start) return setError('Indiquez le mois de début.');
    if (!v.is_current && v.end && v.end < v.start) return setError('La fin ne peut pas précéder le début.');
    if (v.company_url && !/^https?:\/\/\S+\.\S+/.test(v.company_url.trim())) return setError('Lien de l’entreprise invalide (https://…).');
    const ok = await entries.saveExperience(e?.id ?? null, {
      title: v.title.trim(),
      company_name: v.company_name.trim(),
      company_url: v.company_url.trim(),
      location: v.location.trim(),
      employment_type: v.employment_type,
      is_remote: v.is_remote,
      start_date: fromMonth(v.start) as string,
      end_date: v.is_current ? null : fromMonth(v.end),
      is_current: v.is_current,
      description: v.description,
      technology_ids: techs.map((t) => t.id),
    });
    if (ok) onClose();
  };

  return (
    <EntryModal open={!!target} title={e ? 'Modifier l’expérience' : 'Ajouter une expérience'} busy={entries.isSaving} error={error} onClose={onClose} onSubmit={save}>
      <Field label="Poste" value={v.title} onChange={(x) => set({ title: x.target.value })} placeholder="Développeur backend" />
      <Field label="Entreprise" value={v.company_name} onChange={(x) => set({ company_name: x.target.value })} />
      <label className="flex flex-col gap-1">
        <span className="custom-form-label">Type de contrat</span>
        <select value={v.employment_type} onChange={(x) => set({ employment_type: x.target.value as EmploymentType })} className="custom-form-control bg-background px-3 py-2">
          {(Object.keys(employmentLabel) as EmploymentType[]).map((t) => (
            <option key={t} value={t}>
              {employmentLabel[t]}
            </option>
          ))}
        </select>
      </label>
      <Field label="Lieu" value={v.location} onChange={(x) => set({ location: x.target.value })} placeholder="Abidjan, Côte d’Ivoire" />
      <Field label="Début" type="month" value={v.start} onChange={(x) => set({ start: x.target.value })} />
      <Field label="Fin" type="month" value={v.end} disabled={v.is_current} onChange={(x) => set({ end: x.target.value })} />
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700 sm:col-span-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={v.is_current} onChange={(x) => set({ is_current: x.target.checked })} className="size-4 accent-(--primary)" />
          J’occupe ce poste actuellement
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={v.is_remote} onChange={(x) => set({ is_remote: x.target.checked })} className="size-4 accent-(--primary)" />
          En télétravail
        </label>
      </div>
      <Field label="Site de l’entreprise" wide type="url" value={v.company_url} onChange={(x) => set({ company_url: x.target.value })} placeholder="https://…" />
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="custom-form-label">Missions et réalisations</span>
        <textarea rows={4} value={v.description} onChange={(x) => set({ description: x.target.value })} className="custom-form-control bg-background px-3 py-2" />
      </label>
      <TechnologyPicker id="experience-tech" value={techs} onAdd={(t) => setTechs((c) => [...c, { id: t.id, name: t.name }])} onRemove={(id) => setTechs((c) => c.filter((t) => t.id !== id))} />
    </EntryModal>
  );
}

export default ExperienceModal;
