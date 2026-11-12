import { ArrowLeft, BadgeCheck, Bell, BellOff, Check, ChevronDown, Copy, Link2, LogOut, Radio, Settings, ShieldCheck, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { customToast, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@kodinga/ui';
import { CommunityAvatar } from '@/pages/shared/community-avatar';
import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import { useSetCommunityNotificationsMutation } from '@/utils/api/community/community.api';
import type { CommunityDetail } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';
import i18n from '@/utils/i18n';
import { entryPriceLabel, formatCompact, memberRoleLabel } from '@/utils/Utils';
import type { CommunityPage } from '../form/UseCommunityPage';
import { LeaveDialog, MembershipActions } from './community-sidebar';

/** "Accès gratuit", "Sur demande", or the entry price of a paid one ("À partir de 5 000 FCFA / mois"): the badge next to the name */
export function accessBadge(community: CommunityDetail) {
  if (community.pricing_type === 'paid') {
    return { label: entryPriceLabel(community.subscription_plans) ?? i18n.t('community.hero.paidAccess'), className: 'border-border bg-card/80 text-body' };
  }
  if (community.settings?.require_approval_to_join) return { label: i18n.t('community.hero.onRequest'), className: 'border-amber-200 bg-amber-50 text-amber-800' };
  return { label: i18n.t('community.hero.freeAccess'), className: 'border-brand-muted bg-brand-subtle text-brand-strong' };
}

async function copyPageLink() {
  try {
    await navigator.clipboard.writeText(window.location.href.split('?')[0]);
    customToast.success({ message: i18n.t('community.hero.linkCopied') });
    return true;
  } catch {
    customToast.error({ message: i18n.t('community.hero.copyFailed') });
    return false;
  }
}

/** Member: the notifications of this community reach them, or not */
function NotificationsBell({ page }: { page: CommunityPage }) {
  const { t } = useTranslation();
  const [setNotifications, { isLoading }] = useSetCommunityNotificationsMutation();
  const enabled = !!page.community?.notifications_enabled;
  const Icon = enabled ? Bell : BellOff;

  const toggle = async () => {
    try {
      await setNotifications({ slug: page.slug, enabled: !enabled }).unwrap();
      customToast.success({ message: enabled ? t('community.hero.notificationsOff') : t('community.hero.notificationsOn') });
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  const label = enabled ? t('community.hero.muteLabel') : t('community.hero.unmuteLabel');
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isLoading}
      aria-pressed={enabled}
      aria-label={label}
      title={label}
      className={`flex size-11 items-center justify-center rounded-lg border border-border bg-card/90 shadow-2xs transition-colors hover:bg-card disabled:opacity-60 ${enabled ? 'text-brand-strong' : 'text-muted-foreground'}`}
    >
      <Icon className="size-5" />
    </button>
  );
}

/** Member: role menu (manage, copy the link, leave) */
function MemberMenu({ page }: { page: CommunityPage }) {
  const { t } = useTranslation();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const community = page.community;
  if (!community) return null;
  const role = page.role ?? 'member';
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t('community.hero.yourRole', { role: memberRoleLabel[role] })}
            className="flex h-11 items-center gap-2 rounded-lg border border-border bg-card/90 px-4 text-sm font-medium text-foreground shadow-2xs hover:text-foreground"
          >
            <ShieldCheck className="size-4" />
            {memberRoleLabel[role]}
            <ChevronDown className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {page.isTeam && (
            <DropdownMenuItem asChild>
              <Link to={`/c/${community.slug}/dashboard`}>
                <Settings /> {t('community.hero.manage')}
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => copyPageLink()}>
            <Link2 /> {t('community.hero.copyLink')}
          </DropdownMenuItem>
          {role !== 'owner' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600 focus:text-red-700" onSelect={() => setConfirmLeave(true)}>
                <LogOut /> {t('community.hero.leave')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <LeaveDialog page={page} open={confirmLeave} onClose={() => setConfirmLeave(false)} />
    </>
  );
}

/** Banner of the page: back link, logo, name, then the access (visitors) or the member's tools */
export function CommunityHero({ page }: { page: CommunityPage }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const community = page.community;
  if (!community) return null;
  const isMember = page.membership === 'member';
  const badge = accessBadge(community);
  const n = community.members_count;

  const copy = async () => {
    if (await copyPageLink()) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <section aria-labelledby="community-name" className="relative overflow-hidden border-b border-border bg-subtle">
      {community.banner_url ? (
        <>
          <img src={community.banner_url} alt="" className="absolute inset-0 size-full object-cover" />
          {/* Keeps the text readable on any photo */}
          <div className="absolute inset-0 bg-linear-to-r from-white via-white/90 to-white/40 dark:from-background dark:via-background/90 dark:to-background/40" />
        </>
      ) : (
        <GlassBackdrop />
      )}

      <div className="relative mx-auto max-w-285 px-4 pt-6 pb-10 sm:px-6 lg:px-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-soft hover:text-foreground">
          <ArrowLeft className="size-4" />
          {t('community.hero.back')}
        </Link>

        <div className="mt-8 flex flex-wrap items-start gap-5 sm:gap-6">
          <CommunityAvatar community={community} className="size-16 rounded-xl text-xl shadow-sm sm:size-20 sm:text-2xl" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-soft uppercase">{isMember ? t('community.hero.yourSpace') : t('community.hero.kodingaCommunities')}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <h1 id="community-name" className="text-3xl font-bold tracking-tight break-words text-foreground sm:text-4xl">
                {community.name}
              </h1>
              {community.is_verified && <BadgeCheck className="size-6 shrink-0 text-brand" aria-label={t('community.hero.verified')} />}
              {community.active_live && (
                <Link
                  to={`/communities/${community.slug}/events/${community.active_live.id}/live`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-md shadow-red-600/30 hover:bg-red-500 transition-all hover:scale-105 animate-pulse"
                >
                  <Radio className="size-3.5" />
                  {t('community.hero.live')} {community.active_live.is_public ? '' : t('community.hero.membersOnly')}
                </Link>
              )}
              {!isMember && <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold tracking-wide uppercase ${badge.className}`}>{badge.label}</span>}
            </div>
            {isMember ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-soft">
                <Users className="size-4" /> {t('community.hero.members', { count: n, formatted: formatCompact(n) })}
              </p>
            ) : (
              community.tagline && <p className="mt-3 text-soft">{community.tagline}</p>
            )}
            {!isMember && (
              <div className="mt-5 lg:hidden">
                {community.pricing_type === 'paid' ? (
                  <a href="#formules" className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-900 px-5 text-sm font-semibold text-white">
                    {t('community.hero.seePlans')}
                  </a>
                ) : (
                  <MembershipActions page={page} className="w-full sm:w-auto" />
                )}
              </div>
            )}
          </div>

          {isMember ? (
            // Phones: on their own row under the name (the name column keeps its width)
            <div className="flex w-full items-center gap-3 sm:w-auto">
              <NotificationsBell page={page} />
              <MemberMenu page={page} />
            </div>
          ) : (
            <button
              type="button"
              onClick={copy}
              aria-label={t('community.hero.copyCommunityLink')}
              title={t('community.hero.copyLink')}
              className="hidden size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-body shadow-2xs hover:text-foreground sm:flex"
            >
              {copied ? <Check className="size-5 text-emerald-600" /> : <Copy className="size-5" />}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
