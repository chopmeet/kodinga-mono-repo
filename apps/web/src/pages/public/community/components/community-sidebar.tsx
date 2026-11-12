import { ArrowRight, ArrowUpRight, Ban, CalendarDays, Check, ChevronRight, Clock, Globe, Lock, LogOut, Settings, ShieldCheck, Trophy } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kodinga/ui';
import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import { useGetCommunityLeaderboardQuery, useGetCommunityPlansQuery } from '@/utils/api/community/community.api';
import type { BillingInterval, CommunityPlan } from '@/utils/api/billing/billing.type';
import { numberFormat } from '@/utils/format';
import i18n from '@/utils/i18n';
import { formatCompact, nameInitials } from '@/utils/Utils';
import type { CommunityPage } from '../form/UseCommunityPage';

const intervalKey: Record<BillingInterval, 'perMonth' | 'perYear' | 'lifetime'> = { month: 'perMonth', year: 'perYear', one_time: 'lifetime' };
const intervalLabel = (interval: BillingInterval) => i18n.t(`community.sidebar.${intervalKey[interval]}`);

const price = (p: CommunityPlan) => `${numberFormat({ maximumFractionDigits: 0 }).format(Number(p.price))} ${p.currency === 'XOF' ? 'FCFA' : p.currency}`;

/** Formulas of a paid community, each with its PayDunya checkout */
function Plans({ page }: { page: CommunityPage }) {
  // The detail carries the plans; billing/plans/ only when it does not
  const fromDetail = page.community?.subscription_plans;
  const query = useGetCommunityPlansQuery(page.slug, { skip: !!fromDetail });
  const plans = fromDetail ?? query.data ?? [];
  const isLoading = !fromDetail && query.isLoading;
  const [chosen, setChosen] = useState<string | null>(null);
  const { t } = useTranslation();

  if (isLoading) return <p className="text-center text-sm text-muted-foreground">{t('community.sidebar.loadingPlans')}</p>;
  if (plans.length === 0) return <p className="text-center text-sm text-muted-foreground">{t('community.sidebar.noPlans')}</p>;

  return (
    <ul id="formules" className="scroll-mt-40 space-y-3" aria-label={t('community.sidebar.plansLabel')}>
      {plans.map((plan) => (
        <li key={plan.id} className="rounded-xl border border-border p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-semibold text-foreground">{plan.name}</p>
            <p className="text-right text-sm whitespace-nowrap">
              <span className="font-bold text-foreground">{price(plan)}</span>{' '}
              <span className="text-muted-foreground">{intervalLabel(plan.billing_interval)}</span>
            </p>
          </div>
          {plan.description && <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>}
          {plan.features.length > 0 && (
            <ul className="mt-2 space-y-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-1.5 text-xs text-soft">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                  {f}
                </li>
              ))}
            </ul>
          )}
          {page.membership === 'visitor' ? (
            <Button asChild size="sm" className="mt-3 w-full">
              <Link to={page.loginUrl}>{t('community.sidebar.loginToSubscribe')}</Link>
            </Button>
          ) : (
            <Button
              size="sm"
              className="mt-3 w-full"
              isLoading={page.isCheckingOut && chosen === plan.id}
              disabled={page.isCheckingOut}
              onClick={() => {
                setChosen(plan.id);
                page.subscribe(plan.id);
              }}
            >
              {t('community.sidebar.subscribe', { plan: plan.name })}
            </Button>
          )}
        </li>
      ))}
      <li className="text-center text-[11px] text-muted-foreground">{t('community.sidebar.securedBy')}</li>
    </ul>
  );
}

/** Confirmation before leaving (the owner cannot leave) */
export function LeaveDialog({ page, open, onClose }: { page: CommunityPage; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const community = page.community;
  if (!community) return null;
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !page.isLeaving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('community.sidebar.leaveTitle', { name: community.name })}</DialogTitle>
          <DialogDescription>
            {community.pricing_type === 'paid' ? t('community.sidebar.leavePaid') : t('community.sidebar.leaveFree')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={page.isLeaving}>
            {t('community.sidebar.stay')}
          </Button>
          <Button
            variant="danger"
            isLoading={page.isLeaving}
            onClick={async () => {
              if (await page.leave()) onClose();
            }}
          >
            <LogOut /> {t('community.sidebar.leave')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Join / leave / subscribe, depending on where the user stands */
export function MembershipActions({ page, className }: { page: CommunityPage; className?: string }) {
  const { t } = useTranslation();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const community = page.community;
  if (!community) return null;
  const needsApproval = !!community.settings?.require_approval_to_join;
  const joinLabel = needsApproval ? t('community.sidebar.askToJoin') : t('community.sidebar.join');

  switch (page.membership) {
    case 'member':
      return (
        <div className={cn('space-y-2', className)}>
          <p className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-50 py-2 text-sm font-semibold text-emerald-800">
            <Check className="size-4" /> {t('community.sidebar.youAreMember')}
          </p>
          {page.isTeam && (
            <Button asChild variant="outline" className="w-full">
              <Link to={`/c/${community.slug}/dashboard`}>
                <Settings /> {t('community.sidebar.manage')}
              </Link>
            </Button>
          )}
          {page.role !== 'owner' && (
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setConfirmLeave(true)}>
              <LogOut /> {t('community.sidebar.leaveCommunity')}
            </Button>
          )}
          <LeaveDialog page={page} open={confirmLeave} onClose={() => setConfirmLeave(false)} />
        </div>
      );
    case 'pending':
      return (
        <p className={cn('flex items-center justify-center gap-1.5 rounded-lg bg-amber-50 py-2.5 text-sm font-semibold text-amber-800', className)}>
          <Clock className="size-4" /> {t('community.sidebar.pending')}
        </p>
      );
    case 'banned':
      return (
        <p className={cn('flex items-center justify-center gap-1.5 rounded-lg bg-red-50 py-2.5 text-sm font-semibold text-red-700', className)}>
          <Ban className="size-4" /> {t('community.sidebar.banned')}
        </p>
      );
    default:
      if (community.pricing_type === 'paid') {
        return (
          <div className={className}>
            <Plans page={page} />
          </div>
        );
      }
      return page.membership === 'visitor' ? (
        <Button asChild size="lg" className={cn('w-full', className)}>
          <Link to={page.loginUrl}>
            {joinLabel} <ArrowUpRight />
          </Link>
        </Button>
      ) : (
        <Button size="lg" className={cn('w-full', className)} onClick={page.join} isLoading={page.isJoining}>
          {joinLabel} <ArrowUpRight />
        </Button>
      );
  }
}

/** Under the button: what joining means */
function accessNote(page: CommunityPage) {
  const community = page.community;
  if (!community) return null;
  if (community.pricing_type === 'paid') return i18n.t('community.sidebar.notePaid');
  if (community.settings?.require_approval_to_join) return i18n.t('community.sidebar.noteApproval');
  return i18n.t('community.sidebar.noteFree');
}

/** Top 3 of the community (public leaderboard; the api has no weekly ranking yet) */
function HonourBoard({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const { data = [] } = useGetCommunityLeaderboardQuery({ slug, limit: 3 });
  if (data.length === 0) return null;
  return (
    <section aria-labelledby="honour-board">
      <h3 id="honour-board" className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <Trophy className="size-5 text-amber-600" /> {t('community.sidebar.honourTitle')}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{t('community.sidebar.sinceStart')}</p>
      <ol className="mt-3 divide-y divide-border" aria-label={t('community.sidebar.honourLabel')}>
        {data.map((e) => (
          <li key={e.user.id} className="flex items-center gap-3 py-3">
            <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold', e.rank === 1 ? 'bg-amber-50 text-amber-700' : 'bg-brand-subtle text-soft')}>
              {e.rank}
            </span>
            <Avatar className="size-9">
              {e.user.avatar_url && <AvatarImage src={e.user.avatar_url} alt="" />}
              <AvatarFallback className="bg-brand-subtle text-xs font-semibold text-brand-strong">{nameInitials(e.user.name || e.user.username)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{e.user.name}</p>
              <p className="text-xs text-muted-foreground">{t('community.sidebar.level', { level: e.level })}</p>
            </div>
            <span className="text-sm font-semibold text-brand-strong tabular-nums">+{formatCompact(e.points)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Member: the community card, a shortcut to the feed (or the space for the team), the top members */
function MemberSidebar({ page }: { page: CommunityPage }) {
  const { t } = useTranslation();
  const community = page.community;
  if (!community) return null;
  const stats = [
    { label: t('community.sidebar.members'), value: community.members_count },
    { label: t('community.sidebar.posts'), value: community.posts_count },
    { label: t('community.sidebar.courses'), value: community.courses_count },
  ];
  return (
    <div className="flex flex-col gap-8">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
        <div className="relative hidden h-44 lg:block" style={community.banner_url ? undefined : { backgroundColor: community.brand_color || '#1D4ED8' }}>
          {community.banner_url ? <img src={community.banner_url} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" /> : <GlassBackdrop fade={false} />}
        </div>
        <div className="p-6">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-soft uppercase">{t('community.sidebar.connections')}</p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">{community.name}</h2>
          {community.tagline && <p className="mt-3 leading-relaxed text-soft">{community.tagline}</p>}

          <dl className="mt-6 grid grid-cols-3 divide-x divide-border border-y border-border py-5 text-center">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col-reverse gap-1">
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className="text-lg font-semibold text-foreground">{formatCompact(s.value)}</dd>
              </div>
            ))}
          </dl>

          <Button asChild size="lg" className="mt-6 w-full">
            {page.isTeam ? (
              <Link to={`/c/${community.slug}/dashboard`}>
                {t('community.sidebar.manageArrow')} <ArrowUpRight />
              </Link>
            ) : (
              <Link to="?tab=feed" replace>
                {t('community.sidebar.openFeed')} <ArrowUpRight />
              </Link>
            )}
          </Button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" /> {t('community.sidebar.memberOfThis')}
          </p>
        </div>
      </div>

      <HonourBoard slug={community.slug} />
    </div>
  );
}

export function CommunitySidebar({ page }: { page: CommunityPage }) {
  const { t } = useTranslation();
  const community = page.community;
  if (!community) return null;
  if (page.membership === 'member') return <MemberSidebar page={page} />;
  const n = community.members_count;
  const isPublic = community.privacy_type === 'public';
  const note = accessNote(page);
  const stats = [
    { label: n > 1 ? t('community.sidebar.members') : t('community.sidebar.member'), value: <span className="text-lg font-semibold">{formatCompact(n)}</span> },
    { label: isPublic ? t('community.sidebar.public') : t('community.sidebar.private'), value: isPublic ? <Globe className="mx-auto size-5" /> : <Lock className="mx-auto size-5" /> },
    {
      label: t('community.sidebar.access'),
      value: <span className="text-lg font-semibold">{community.pricing_type === 'paid' ? t('community.sidebar.paid') : t('community.sidebar.free')}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
        <div className="relative hidden h-44 lg:block" style={community.banner_url ? undefined : { backgroundColor: community.brand_color || '#1D4ED8' }}>
          {community.banner_url ? <img src={community.banner_url} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" /> : <GlassBackdrop fade={false} />}
        </div>
        <div className="p-6">
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-soft uppercase">
            <span className="size-2 rounded-full bg-brand ring-4 ring-brand/15" aria-hidden />
            {t('community.sidebar.nextCommunity')}
          </p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">{community.name}</h2>
          {community.tagline && <p className="mt-3 leading-relaxed text-soft">{community.tagline}</p>}

          <dl className="mt-6 grid grid-cols-3 divide-x divide-border border-t border-border pt-5 text-center">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col-reverse gap-1">
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className="text-foreground">{s.value}</dd>
              </div>
            ))}
          </dl>

          <MembershipActions page={page} className="mt-6" />
          {note && (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" /> {note}
            </p>
          )}
        </div>
      </div>

      <section aria-labelledby="community-connect" className="px-1">
        <CalendarDays className="size-7 text-brand-strong" aria-hidden />
        <h3 id="community-connect" className="mt-3 text-lg font-semibold text-foreground">
          {t('community.sidebar.connectTitle')}
        </h3>
        <p className="mt-1 text-sm text-soft">{t('community.sidebar.connectText')}</p>
        <ul className="mt-4 space-y-3 text-sm font-semibold text-brand-strong">
          <li>
            <Link to="?tab=feed" replace className="inline-flex items-center gap-1.5 hover:underline">
              {t('community.sidebar.memberSpace')} <ChevronRight className="size-4" />
            </Link>
          </li>
          <li>
            <Link to="/" className="inline-flex items-center gap-1.5 hover:underline">
              {t('community.sidebar.exploreOthers')} <ChevronRight className="size-4" />
            </Link>
          </li>
        </ul>
      </section>

      <section className="border-t border-border pt-6 text-sm">
        <p className="text-soft">{t('community.sidebar.ownCommunity')}</p>
        <Link to="/create-community" className="mt-2 inline-flex items-center gap-1.5 font-semibold text-brand-strong hover:underline">
          {t('community.sidebar.launch')} <ArrowRight className="size-4" />
        </Link>
      </section>
    </div>
  );
}
