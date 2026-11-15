import { ArrowUpRight, BadgeCheck, Lock, Radio, Star, Users } from 'lucide-react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';

import { CommunityAvatar } from '@/pages/shared/community-avatar';
import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import type { CommunityListItem } from '@/utils/api/community/community.type';
import type { CommunityPlan } from '@/utils/api/billing/billing.type';
import { entryPriceLabel, formatCompact, planPrice, xof } from '@/utils/Utils';

/** Formats the community pricing formulas (monthly, one-time, yearly, or entry price) */
export function formatCommunityPricing(plans: CommunityPlan[] | undefined, t: TFunction): string | null {
  const active = (plans ?? []).filter((p) => Number(p.price) > 0 && p.is_active !== false);
  if (!active.length) return null;

  const monthly = active.find((p) => p.billing_interval === 'month');
  const oneTime = active.find((p) => p.billing_interval === 'one_time');
  const yearly = active.find((p) => p.billing_interval === 'year');

  if (monthly && oneTime) {
    return `${planPrice(monthly)} · ${xof(Number(oneTime.price))} ${t('home.card.oneTimePayment')}`;
  }
  if (monthly) {
    return planPrice(monthly);
  }
  if (oneTime) {
    return `${xof(Number(oneTime.price))} · ${t('home.card.oneTimePayment')}`;
  }
  if (yearly) {
    return planPrice(yearly);
  }
  return entryPriceLabel(active);
}

/** Free + public: join right away. Paid: pricing formula or PAID MEMBER. Private / secret: request reviewed or FREE MEMBER */
export function accessOf(community: CommunityListItem, t: TFunction) {
  const isPaidMember = Boolean(community.has_paid || (community.pricing_type === 'paid' && community.is_member));
  const isFreeMember = Boolean(community.is_member && !isPaidMember);

  if (isPaidMember) {
    return {
      label: t('home.card.paidMember', 'PAID MEMBER'),
      className: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-600/40 font-bold',
    };
  }

  if (isFreeMember) {
    return {
      label: t('home.card.freeMember', 'FREE MEMBER'),
      className: 'border-blue-500/40 bg-blue-500/15 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-600/40 font-bold',
    };
  }

  if (community.pricing_type === 'paid') {
    const pricing = formatCommunityPricing(community.subscription_plans, t);
    return {
      label: pricing ?? t('home.card.paid'),
      className: 'border-border bg-subtle text-foreground font-semibold',
    };
  }

  if (community.privacy_type !== 'public') {
    return {
      label: t('home.card.onRequest'),
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    };
  }

  return {
    label: t('home.card.freeAccess'),
    className: 'border-brand-muted bg-brand-subtle text-brand-strong',
  };
}

export function CommunityCard({ community }: { community: CommunityListItem }) {
  const { t } = useTranslation();
  const access = accessOf(community, t);
  const href = `/communities/${community.slug}`;
  const isPrivate = community.privacy_type !== 'public';
  const isPaidMember = Boolean(community.has_paid || (community.pricing_type === 'paid' && community.is_member));
  const isFreeMember = Boolean(community.is_member && !isPaidMember);

  const pricingTag = isPaidMember
    ? t('home.card.paidMember', 'PAID MEMBER')
    : isFreeMember
      ? t('home.card.freeMember', 'FREE MEMBER')
      : community.pricing_type === 'paid'
        ? (formatCommunityPricing(community.subscription_plans, t) ?? t('home.card.paid'))
        : t('home.card.free');

  const tags = [community.category?.name, pricingTag].filter(Boolean) as string[];
  const activeLive = community.active_live;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xs transition-all hover:border-border-strong hover:shadow-md">
      <div className="relative h-52 w-full overflow-hidden">
        {community.banner_url ? (
          <img
            src={community.banner_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <GlassBackdrop fade={false} />
        )}
        <div className="relative flex items-start justify-between gap-2 p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1.5 rounded-md bg-card/95 px-2.5 py-1 text-xs font-semibold tracking-wide text-body uppercase shadow-2xs">
              {isPrivate ? <Lock className="size-3.5" /> : <Users className="size-3.5" />}
              {isPrivate ? t('home.card.private') : t('home.card.community')}
            </span>
            {activeLive && (
              <span className="flex items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1 text-xs font-bold tracking-wide text-white uppercase shadow-md animate-pulse">
                <span className="size-1.5 rounded-full bg-card animate-ping" />
                Live {activeLive.is_public ? '' : '🔒'}
              </span>
            )}
          </div>
          {community.is_featured && (
            <span className="flex shrink-0 items-center gap-1 rounded-md bg-amber-400/95 px-2 py-1 text-xs font-semibold text-amber-950">
              <Star className="size-3.5" />
              {t('home.card.featured')}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <CommunityAvatar community={community} className="size-12 rounded-lg text-base" />
          <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold tracking-wide uppercase ${access.className}`}>{access.label}</span>
        </div>

        <h3 className="mt-4 flex items-center gap-1.5 text-xl leading-tight font-bold text-foreground">
          {/* Stretched link: the whole card opens the community */}
          <Link to={href} className="after:absolute after:inset-0 group-hover:text-primary">
            {community.name}
          </Link>
          {community.is_verified && <BadgeCheck className="size-5 shrink-0 text-primary" aria-label={t('home.card.verified')} />}
        </h3>
        {community.tagline && <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-soft">{community.tagline}</p>}

        {tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="rounded-md border border-border bg-subtle px-2.5 py-1 text-xs text-soft">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Keeps the footers aligned on a row of cards */}
        <div className="flex-1" />
        <div className="mt-6 flex items-center justify-between border-t border-border-soft pt-4 text-sm">
          <span className="flex items-center gap-2 text-soft">
            <Users className="size-4.5 text-muted-foreground" />
            {t('home.card.members', { count: community.members_count, formatted: formatCompact(community.members_count) })}
          </span>
          {activeLive ? (
            <Link
              to={`/communities/${community.slug}/events/${activeLive.id}/live`}
              className="relative z-10 flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-red-600/30 hover:bg-red-500 transition-all hover:scale-102"
            >
              <Radio className="size-3.5 animate-pulse" />
              {t('home.card.joinLive')}
            </Link>
          ) : (
            <NavLink
              to={href}
              className="relative z-10 flex items-center gap-1.5 rounded-lg px-2 py-1 font-semibold text-foreground transition-colors hover:text-primary"
            >
              {community.is_member ? t('home.card.open') : t('home.card.discover')}
              <ArrowUpRight className="size-4.5" />
            </NavLink>
          )}
        </div>
      </div>
    </article>
  );
}

/** `count` placeholders with the shape of a CommunityCard, shown while the directory loads */
export function CommunityCardSkeleton({ count = 4 }: { count?: number }) {
  return Array.from({ length: count }, (_, i) => (
    <div key={i} className="overflow-hidden rounded-xl border border-border bg-card" aria-hidden>
      <div className="h-52 animate-pulse bg-muted" />
      <div className="space-y-4 p-6">
        <div className="size-12 animate-pulse rounded-lg bg-muted" />
        <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
      </div>
    </div>
  ));
}
