import { Briefcase, GraduationCap, Pencil, Plus, Trash2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { Button, Loader } from '@kodinga-mono-repo/ui';
import type { ProfileEducation, ProfileExperience } from '@/utils/api/profile/profile.type';
import UseProfileEntries, { period } from '../form/UseProfileEntries';
import EducationModal from '../modals/education-modal';
import ExperienceModal, { employmentLabel } from '../modals/experience-modal';

function Entry({ title, subtitle, meta, children, onEdit, onDelete, label }: { title: string; subtitle: string; meta: string; children?: ReactNode; onEdit: () => void; onDelete: () => void; label: string }) {
  return (
    <li className="flex items-start justify-between gap-3 py-4">
      <div className="min-w-0">
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="text-sm text-slate-700">{subtitle}</p>
        <p className="text-sm text-slate-500">{meta}</p>
        {children}
      </div>
      <div className="flex shrink-0 gap-1">
        <button type="button" aria-label={`Modifier ${label}`} onClick={onEdit} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800">
          <Pencil className="size-4" />
        </button>
        <button type="button" aria-label={`Supprimer ${label}`} onClick={onDelete} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600">
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}

/** /account/career — experiences and educations, most recent first */
function CareerTab() {
  const entries = UseProfileEntries();
  const [experience, setExperience] = useState<{ experience: ProfileExperience | null } | null>(null);
  const [education, setEducation] = useState<{ education: ProfileEducation | null } | null>(null);
  const byStart = <T extends { start_date: string }>(list: T[]) => [...list].sort((a, b) => b.start_date.localeCompare(a.start_date));
  const experiences = byStart(entries.profile?.experiences ?? []);
  const educations = byStart(entries.profile?.educations ?? []);

  if (entries.isLoading) return <Loader inline size="sm" message="Chargement…" />;

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="experiences">
        <div className="flex items-center justify-between gap-3">
          <h2 id="experiences" className="flex items-center gap-2 font-semibold text-slate-900">
            <Briefcase className="size-5 text-blue-900" /> Expériences
          </h2>
          <Button size="sm" variant="outline" onClick={() => setExperience({ experience: null })}>
            <Plus /> Ajouter une expérience
          </Button>
        </div>
        {experiences.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Aucune expérience renseignée.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100" aria-label="Expériences">
            {experiences.map((x) => (
              <Entry
                key={x.id}
                label={x.title}
                title={x.title}
                subtitle={`${x.company_name} · ${employmentLabel[x.employment_type] ?? x.employment_type}`}
                meta={[period(x.start_date, x.end_date, x.is_current), x.is_remote ? 'Télétravail' : x.location].filter(Boolean).join(' · ')}
                onEdit={() => setExperience({ experience: x })}
                onDelete={() => entries.deleteExperience(x.id)}
              >
                {x.technologies.length > 0 && <p className="mt-1 text-xs text-slate-500">{x.technologies.map((t) => t.name).join(' · ')}</p>}
              </Entry>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="educations">
        <div className="flex items-center justify-between gap-3">
          <h2 id="educations" className="flex items-center gap-2 font-semibold text-slate-900">
            <GraduationCap className="size-5 text-blue-900" /> Formations
          </h2>
          <Button size="sm" variant="outline" onClick={() => setEducation({ education: null })}>
            <Plus /> Ajouter une formation
          </Button>
        </div>
        {educations.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Aucune formation renseignée.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100" aria-label="Formations">
            {educations.map((x) => (
              <Entry
                key={x.id}
                label={x.degree}
                title={x.degree}
                subtitle={[x.institution, x.field_of_study].filter(Boolean).join(' · ')}
                meta={period(x.start_date, x.end_date, x.is_current)}
                onEdit={() => setEducation({ education: x })}
                onDelete={() => entries.deleteEducation(x.id)}
              />
            ))}
          </ul>
        )}
      </section>

      <ExperienceModal entries={entries} target={experience} onClose={() => setExperience(null)} />
      <EducationModal entries={entries} target={education} onClose={() => setEducation(null)} />
    </div>
  );
}

export default CareerTab;
