import { Globe, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import type { CommunityCategory } from '@/utils/api/community/community.type';
import { nameInitials } from '@/utils/Utils';
import type { CommunityValues } from '../form/UseCreateCommunity';
import { entryPriceLabel } from '@/utils/Utils';

type Props = {
  values: CommunityValues;
  slug: string;
  category?: CommunityCategory;
  /** Chosen file or link of the logo / banner */
  images: { avatar: string | null; banner: string | null };
};

/** Live card of the community being created, as it will look in "Toutes les communautés" */
export function CommunityPreview({ values, slug, category, images }: Props) {
  const { t } = useTranslation();
  const isPrivate = values.privacy_type !== 'public';
  const name = values.name.trim() || t('create.preview.namePlaceholder');
  const access =
    values.pricing_type === 'paid'
      ? {
          // The price set at the access step, once valid
          label: Number(values.membership_price) > 0 ? (entryPriceLabel([{ price: values.membership_price, billing_interval: values.membership_interval }]) ?? t('create.preview.paid')) : t('create.preview.paid'),
          className: 'border-border bg-subtle text-body',
        }
      : isPrivate
        ? { label: t('create.preview.onRequest'), className: 'border-amber-200 bg-amber-50 text-amber-800' }
        : { label: t('create.preview.freeAccess'), className: 'border-brand-muted bg-brand-subtle text-brand-strong' };
  const tags = [category?.name ?? t('create.preview.theme'), t('create.preview.new')];

  return (
    <figure aria-label={t('create.preview.label')} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="relative h-52 overflow-hidden">
        {images.banner ? <img src={images.banner} alt="" className="absolute inset-0 size-full object-cover" /> : <GlassBackdrop fade={false} />}
        <span className="relative m-4 inline-flex items-center gap-1.5 rounded-md bg-card/95 px-2.5 py-1 text-xs font-semibold tracking-wide text-body uppercase shadow-2xs">
          {isPrivate ? <Lock className="size-3.5" /> : <Globe className="size-3.5" />}
          {isPrivate ? t('create.preview.private') : t('create.preview.community')}
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
        <p className={`mt-4 text-xl font-bold break-words ${values.name.trim() ? 'text-foreground' : 'text-foreground/90'}`}>{name}</p>
        <p className="mt-2 text-[15px] break-words text-soft">{values.tagline.trim() || t('create.preview.descriptionPlaceholder')}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="rounded-md border border-border bg-subtle px-2.5 py-1 text-xs text-soft">
              {tag}
            </span>
          ))}
        </div>
        <figcaption className="mt-6 truncate border-t border-border-soft pt-4 text-sm text-soft">
          kodinga.com/communities/<span className="text-foreground">{slug || '…'}</span>
        </figcaption>
      </div>
    </figure>
  );
}
