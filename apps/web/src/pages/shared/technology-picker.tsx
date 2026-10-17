import { Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Input } from '@kodinga-mono-repo/ui';
import { useGetTechnologiesQuery } from '@/utils/api/community/community.api';
import type { Technology } from '@/utils/api/opportunity/opportunity.type';

type Picked = Pick<Technology, 'id' | 'name'>;

/** Chips of the chosen technologies (offers, projects) + a search on the catalog (GET profiles/technologies/?search=) */
export function TechnologyPicker({
  id,
  value,
  onAdd,
  onRemove,
}: {
  id: string;
  value: Picked[];
  onAdd: (tech: Technology) => void;
  onRemove: (id: string) => void;
}) {
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearch(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);

  const { data = [], isFetching } = useGetTechnologiesQuery(search, { skip: search.length < 2 });
  const suggestions = search.length < 2 ? [] : data.filter((t) => !value.some((v) => v.id === t.id)).slice(0, 8);

  return (
    <div className="sm:col-span-2">
      <Input
        id={id}
        label="Technologies"
        placeholder="Rechercher : React, Python, Docker…"
        autoComplete="off"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {suggestions.length > 0 && (
        <ul className="-mt-1 mb-3 flex flex-wrap gap-2" aria-label="Suggestions de technologies">
          {suggestions.map((tech) => (
            <li key={tech.id}>
              <button
                type="button"
                className="flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:border-primary hover:text-primary"
                onClick={() => {
                  onAdd(tech);
                  setText('');
                }}
              >
                <Plus className="size-3.5" aria-hidden />
                {tech.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {search.length >= 2 && !isFetching && suggestions.length === 0 && (
        <p className="-mt-1 mb-3 text-sm text-slate-500">Aucune technologie trouvée pour « {search} ».</p>
      )}
      {value.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2" aria-label="Technologies choisies">
          {value.map((tech) => (
            <li key={tech.id} className="flex items-center gap-1 rounded-full bg-blue-50 py-1 pr-1.5 pl-3 text-sm font-medium text-blue-800">
              {tech.name}
              <button type="button" className="rounded-full p-0.5 hover:bg-blue-100" aria-label={`Retirer ${tech.name}`} onClick={() => onRemove(tech.id)}>
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
