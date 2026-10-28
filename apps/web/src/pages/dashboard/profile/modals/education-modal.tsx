import { useEffect, useState } from 'react';

import type { ProfileEducation } from '@/utils/api/profile/profile.type';
import { fromMonth, type ProfileEntries, toMonth } from '../form/UseProfileEntries';
import { EntryModal, Field } from './entry-modal';

type Target = { education: ProfileEducation | null } | null;

/** Add or edit a degree, a bootcamp, a certification */
function EducationModal({ entries, target, onClose }: { entries: ProfileEntries; target: Target; onClose: () => void }) {
  const e = target?.education ?? null;
  const [v, setV] = useState({ institution: '', degree: '', field_of_study: '', start: '', end: '', is_current: false, description: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setV({
      institution: e?.institution ?? '',
      degree: e?.degree ?? '',
      field_of_study: e?.field_of_study ?? '',
      start: toMonth(e?.start_date),
      end: toMonth(e?.end_date),
      is_current: e?.is_current ?? false,
      description: e?.description ?? '',
    });
    setError(null);
  }, [target, e]);

  const set = (changes: Partial<typeof v>) => setV((current) => ({ ...current, ...changes }));

  const save = async () => {
    if (!v.institution.trim() || !v.degree.trim()) return setError('L’établissement et le diplôme sont obligatoires.');
    if (!v.start) return setError('Indiquez le mois de début.');
    if (!v.is_current && v.end && v.end < v.start) return setError('La fin ne peut pas précéder le début.');
    const ok = await entries.saveEducation(e?.id ?? null, {
      institution: v.institution.trim(),
      degree: v.degree.trim(),
      field_of_study: v.field_of_study.trim(),
      start_date: fromMonth(v.start) as string,
      end_date: v.is_current ? null : fromMonth(v.end),
      is_current: v.is_current,
      description: v.description,
    });
    if (ok) onClose();
  };

  return (
    <EntryModal open={!!target} title={e ? 'Modifier la formation' : 'Ajouter une formation'} busy={entries.isSaving} error={error} onClose={onClose} onSubmit={save}>
      <Field label="Établissement" value={v.institution} onChange={(x) => set({ institution: x.target.value })} placeholder="ESP Dakar, Simplon, OpenClassrooms…" />
      <Field label="Diplôme" value={v.degree} onChange={(x) => set({ degree: x.target.value })} placeholder="Master, Bootcamp, Certification…" />
      <Field label="Spécialité" wide value={v.field_of_study} onChange={(x) => set({ field_of_study: x.target.value })} placeholder="Génie logiciel" />
      <Field label="Début" type="month" value={v.start} onChange={(x) => set({ start: x.target.value })} />
      <Field label="Fin" type="month" value={v.end} disabled={v.is_current} onChange={(x) => set({ end: x.target.value })} />
      <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
        <input type="checkbox" checked={v.is_current} onChange={(x) => set({ is_current: x.target.checked })} className="size-4 accent-(--primary)" />
        En cours
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="custom-form-label">Description</span>
        <textarea rows={3} value={v.description} onChange={(x) => set({ description: x.target.value })} className="custom-form-control bg-background px-3 py-2" />
      </label>
    </EntryModal>
  );
}

export default EducationModal;
