import { Globe, Lock } from 'lucide-react';

import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import type { CommunityCategory } from '@/utils/api/community/community.type';
import { nameInitials } from '@/utils/Utils';
import type { CommunityValues } from '../form/UseCreateCommunity';

type Props = {
  values: CommunityValues;
  slug: string;
  category?: CommunityCategory;
  /** Chosen file or link of the logo / banner */
  images: { avatar: string | null; banner: string | null };
};

/** Live card of the community being created, as it will look in "Toutes les communautés" */
export function CommunityPreview({ values, slug, category, images }: Props) {
  const isPrivate = values.privacy_type !== 'public';
  const name = values.name.trim() || 'Nom de votre communauté';
  const access =
    values.pricing_type === 'paid'
      ? { label: 'Payante', className: 'border-slate-200 bg-slate-50 text-slate-700' }
      : isPrivate
        ? { label: 'Sur demande', className: 'border-amber-200 bg-amber-50 text-amber-800' }
        : { label: 'Accès gratuit', className: 'border-blue-100 bg-blue-50 text-blue-800' };
  const tags = [category?.name ?? 'Thème', 'Nouvelle'];

  return (
    <figure aria-label="Aperçu de la communauté" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="relative h-52 overflow-hidden">
        {images.banner ? <img src={images.banner} alt="" className="absolute inset-0 size-full object-cover" /> : <GlassBackdrop fade={false} />}
        <span className="relative m-4 inline-flex items-center gap-1.5 rounded-md bg-white/95 px-2.5 py-1 text-xs font-semibold tracking-wide text-slate-700 uppercase shadow-2xs">
          {isPrivate ? <Lock className="size-3.5" /> : <Globe className="size-3.5" />}
          {isPrivate ? 'Privée' : 'Communauté'}
        </span>
      </div>
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          {images.avatar ? (
            <img src={images.avatar} alt="" className="size-12 rounded-lg object-cover" />
          ) : (
            <span
              aria-hidden
              className="flex size-12 items-center justify-center rounded-lg text-base font-bold text-white transition-colors duration-300"
              style={{ backgroundColor: values.brand_color }}
            >
              {nameInitials(values.name, 'K')}
            </span>
          )}
          <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold tracking-wide uppercase ${access.className}`}>{access.label}</span>
        </div>
        <p className={`mt-4 text-xl font-bold break-words ${values.name.trim() ? 'text-slate-900' : 'text-slate-900/90'}`}>{name}</p>
        <p className="mt-2 text-[15px] break-words text-slate-600">{values.tagline.trim() || 'Votre description apparaîtra ici.'}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
              {tag}
            </span>
          ))}
        </div>
        <figcaption className="mt-6 truncate border-t border-slate-100 pt-4 text-sm text-slate-600">
          kodinga.com/communities/<span className="text-slate-900">{slug || '…'}</span>
        </figcaption>
      </div>
    </figure>
  );
}
