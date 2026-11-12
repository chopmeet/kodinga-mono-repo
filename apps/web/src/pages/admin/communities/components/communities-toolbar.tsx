import {
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kodinga/ui';
import type { CommunityCategory, CommunityPricing, CommunityPrivacy } from '@/utils/api/community/community.type';

// Radix Select forbids an empty value: 'all' means "no filter"
export const ALL = 'all';

export type CommunityFilters = {
  search: string;
  category: string;
  privacy: CommunityPrivacy | typeof ALL;
  pricing: CommunityPricing | typeof ALL;
};

type Props = {
  filters: CommunityFilters;
  categories: CommunityCategory[];
  onChange: (patch: Partial<CommunityFilters>) => void;
};

function FilterSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger aria-label={label} className="h-10 w-full rounded-full bg-card whitespace-nowrap sm:w-auto sm:min-w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CommunitiesToolbar({ filters, categories, onChange }: Props) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <SearchInput
        id="admin-communities-search"
        size="md"
        className="lg:max-w-sm"
        label="Rechercher une communauté"
        clearLabel="Effacer la recherche"
        placeholder="Nom, slug, description…"
        value={filters.search}
        onValueChange={(search) => onChange({ search })}
      />
      <div className="grid grid-cols-1 gap-3 sm:flex">
        <FilterSelect
          label="Catégorie"
          value={filters.category}
          onValueChange={(category) => onChange({ category })}
          options={[{ value: ALL, label: 'Toutes les catégories' }, ...categories.map((c) => ({ value: c.slug, label: c.name }))]}
        />
        <FilterSelect
          label="Confidentialité"
          value={filters.privacy}
          onValueChange={(privacy) => onChange({ privacy: privacy as CommunityFilters['privacy'] })}
          options={[
            { value: ALL, label: 'Toute confidentialité' },
            { value: 'public', label: 'Publiques' },
            { value: 'private', label: 'Privées' },
            { value: 'secret', label: 'Secrètes' },
          ]}
        />
        <FilterSelect
          label="Tarif"
          value={filters.pricing}
          onValueChange={(pricing) => onChange({ pricing: pricing as CommunityFilters['pricing'] })}
          options={[
            { value: ALL, label: 'Tous les tarifs' },
            { value: 'free', label: 'Gratuites' },
            { value: 'paid', label: 'Payantes' },
          ]}
        />
      </div>
    </div>
  );
}

export default CommunitiesToolbar;
