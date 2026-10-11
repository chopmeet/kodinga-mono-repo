import { EyeOff, Globe, Lock, Users } from 'lucide-react';

import type { CommunityCategory } from '@/utils/api/community/community.type';
import type { CommunityValues } from '../form/UseCreateCommunity';

const privacy = {
  public: { label: 'Publique', icon: Globe },
  private: { label: 'Privée', icon: Lock },
  secret: { label: 'Secrète', icon: EyeOff },
} as const;

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'K';

type Props = { values: CommunityValues; slug: string; category?: CommunityCategory };

/** Live card of the community being created: what visitors will see in the directory */
export function CommunityPreview({ values, slug, category }: Props) {
  const { label: privacyLabel, icon: PrivacyIcon } = privacy[values.privacy_type];
  const name = values.name.trim() || 'Votre communauté';

  return (
    <figure aria-label="Aperçu de la communauté" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div
        className="h-24 transition-colors duration-300"
        style={{ background: `linear-gradient(135deg, ${values.brand_color}, ${values.brand_color}99)` }}
      />
      <div className="px-5 pb-5">
        <div
          className="-mt-8 flex size-16 items-center justify-center rounded-2xl border-4 border-white text-xl font-bold text-white shadow-sm transition-colors duration-300"
          style={{ backgroundColor: values.brand_color }}
          aria-hidden
        >
          {initials(values.name)}
        </div>
        <p className={`mt-3 text-lg font-bold break-words ${values.name.trim() ? 'text-slate-900' : 'text-slate-400'}`}>{name}</p>
        <p className={`mt-1 text-sm break-words ${values.tagline.trim() ? 'text-slate-600' : 'text-slate-400'}`}>
          {values.tagline.trim() || 'Votre accroche apparaîtra ici.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
          {category && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{category.name}</span>}
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
            <PrivacyIcon className="size-3" />
            {privacyLabel}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 ${values.pricing_type === 'paid' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}
          >
            {values.pricing_type === 'paid' ? 'Payante' : 'Gratuite'}
          </span>
        </div>
        <p className="mt-4 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <Users className="size-3.5" />1 membre · vous, fondateur
        </p>
      </div>
      <figcaption className="truncate border-t border-slate-100 bg-slate-50 px-5 py-2.5 font-mono text-xs text-slate-500">
        kodinga.com/communities/<span className="text-slate-900">{slug || 'votre-communaute'}</span>
      </figcaption>
    </figure>
  );
}
