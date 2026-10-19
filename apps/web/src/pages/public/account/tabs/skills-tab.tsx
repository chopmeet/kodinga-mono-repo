import { Star, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button, cn, Loader } from '@kodinga-mono-repo/ui';
import { skillLevelLabel } from '@/pages/shared/profile-labels';
import { TechnologyPicker } from '@/pages/shared/technology-picker';
import type { Technology } from '@/utils/api/opportunity/opportunity.type';
import type { SkillLevel } from '@/utils/api/profile/profile.type';
import UseProfileEntries from '../form/UseProfileEntries';

const levelStyle: Record<SkillLevel, string> = {
  beginner: 'bg-slate-100 text-slate-600',
  intermediate: 'bg-sky-50 text-sky-800',
  advanced: 'bg-blue-50 text-blue-900',
  expert: 'bg-amber-50 text-amber-800',
};

/** /account/skills — the stack of the developer, with a level for each technology */
function SkillsTab() {
  const entries = UseProfileEntries();
  const [tech, setTech] = useState<Technology | null>(null);
  const [level, setLevel] = useState<SkillLevel>('intermediate');
  const [years, setYears] = useState('1');
  const [highlighted, setHighlighted] = useState(false);
  const skills = entries.profile?.skills ?? [];

  const add = async () => {
    if (!tech) return;
    const ok = await entries.addSkill({ technology_id: tech.id, level, years_of_experience: Number(years) || 0, is_highlighted: highlighted });
    if (ok) {
      setTech(null);
      setYears('1');
      setHighlighted(false);
    }
  };

  if (entries.isLoading) return <Loader inline size="sm" message="Chargement…" />;

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="add-skill" className="rounded-xl border border-slate-200 p-5">
        <h2 id="add-skill" className="font-semibold text-slate-900">
          Ajouter une compétence
        </h2>
        <div className="mt-4 grid gap-x-4 sm:grid-cols-2">
          <TechnologyPicker
            id="skill-technology"
            label="Technologie"
            value={tech ? [tech] : []}
            onAdd={(picked) => setTech(picked)}
            onRemove={() => setTech(null)}
          />
          <label className="mb-3 flex flex-col gap-1">
            <span className="custom-form-label">Niveau</span>
            <select value={level} onChange={(e) => setLevel(e.target.value as SkillLevel)} className="custom-form-control bg-background px-3 py-2">
              {(Object.keys(skillLevelLabel) as SkillLevel[]).map((l) => (
                <option key={l} value={l}>
                  {skillLevelLabel[l]}
                </option>
              ))}
            </select>
          </label>
          <label className="mb-3 flex flex-col gap-1">
            <span className="custom-form-label">Années de pratique</span>
            <input value={years} inputMode="numeric" onChange={(e) => setYears(e.target.value.replace(/\D/g, '').slice(0, 2))} className="custom-form-control bg-background px-3 py-2" />
          </label>
          <label className="mb-3 flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
            <input type="checkbox" checked={highlighted} onChange={(e) => setHighlighted(e.target.checked)} className="size-4 accent-(--primary)" />
            Mettre en avant sur mon profil
          </label>
        </div>
        <Button onClick={add} disabled={!tech} isLoading={entries.isAddingSkill}>
          Ajouter {tech ? tech.name : 'la compétence'}
        </Button>
      </section>

      <section aria-labelledby="my-skills">
        <h2 id="my-skills" className="font-semibold text-slate-900">
          Mes compétences ({skills.length})
        </h2>
        {skills.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Aucune compétence pour le moment : ajoutez votre stack pour être trouvé par les recruteurs et les équipes.</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2" aria-label="Mes compétences">
            {skills.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-medium text-slate-900">
                    {s.is_highlighted && <Star className="size-4 fill-amber-400 text-amber-400" aria-label="Mise en avant" />}
                    {s.technology.name}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className={cn('rounded-full px-2 py-0.5 font-semibold', levelStyle[s.level] ?? levelStyle.intermediate)}>{skillLevelLabel[s.level] ?? s.level}</span>
                    {s.years_of_experience ? <span className="text-slate-500">{s.years_of_experience} an{s.years_of_experience > 1 ? 's' : ''}</span> : null}
                  </p>
                </div>
                <button type="button" aria-label={`Retirer ${s.technology.name}`} onClick={() => entries.deleteSkill(s.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600">
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default SkillsTab;
