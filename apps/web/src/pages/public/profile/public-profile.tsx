import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { ArrowLeft, Briefcase, CalendarDays, Copy, FolderKanban, MapPin, MessageCircle, Pencil, UserRound, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { Button, cn, customToast } from '@kodinga/ui';
import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import { useGetPublicProfileQuery } from '@/utils/api/user/user.api';
import { dateFormat } from '@/utils/format';
import { formatCompact, nameInitials, useUser } from '@/utils/Utils';
import { MessageButton } from '@/pages/public/messages/components/message-button';
import { ActivityHeatmap } from './components/activity-heatmap';
import { FollowButton } from './components/follow-button';
import { ProfileFollows } from './components/profile-follows';
import UseProfileActivity from './form/UseProfileActivity';
import { ProfileAbout, ProfileAvailability, ProfileCareer, ProfileCommunities, ProfileContributions, ProfileLinks, ProfilePortfolio } from './components/profile-details';

type TabId = 'about' | 'career' | 'portfolio' | 'communities' | 'contributions';

function Banner({ imageUrl }: { imageUrl?: string }) {
  const { t } = useTranslation();
  return (
    <div className="relative isolate h-56 overflow-hidden border-b border-border sm:h-60">
      {imageUrl ? <img src={imageUrl} alt="" className="absolute inset-0 -z-10 size-full object-cover" /> : <GlassBackdrop className="-z-10" />}
      <div className="mx-auto flex h-full max-w-[1440px] flex-col justify-between px-4 py-8 sm:px-6 lg:px-8">
        <Link to="/" className="flex w-fit items-center gap-2 text-sm text-soft hover:text-foreground">
          <ArrowLeft className="size-4" />
          {t('profile.backExplore')}
        </Link>
        <p className="hidden self-end pb-6 text-xs font-semibold sm:block tracking-[0.2em] text-soft uppercase">{t('profile.bannerTagline')}</p>
      </div>
    </div>
  );
}

/** /profiles/:username — public developer profile */
function PublicProfile() {
  const { t } = useTranslation();
  const { username = '' } = useParams();
  const { data: profile, isLoading, error } = useGetPublicProfileQuery(username, { skip: !username });
  const me = useUser();
  const [tab, setTab] = useState<TabId>('about');
  const activity = UseProfileActivity(username, profile?.user.date_joined);

  if (isLoading) {
    return (
      <div aria-busy="true" aria-label={t('profile.loading')}>
        <Banner />
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <div className="relative z-10 -mt-20 size-40 animate-pulse rounded-full border-4 border-white bg-muted" />
          <div className="mt-6 h-7 w-64 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!profile) {
    const notFound = (error as FetchBaseQueryError | undefined)?.status === 404;
    return (
      <div>
        <Banner />
        <div className="mx-auto max-w-[1440px] px-4 py-16 text-center sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-foreground">{notFound ? t('profile.notFound') : t('profile.unavailable')}</h1>
          <p className="mt-2 text-muted-foreground">
            {notFound ? t('profile.notFoundText') : t('profile.unavailableText')}
          </p>
        </div>
      </div>
    );
  }

  const name = profile.display_name || profile.user.full_name || profile.user.username;
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: name, url });
      else {
        await navigator.clipboard.writeText(url);
        customToast.success({ message: t('profile.linkCopied') });
      }
    } catch {
      // Share sheet dismissed: nothing to do
    }
  };

  return (
    <div className="bg-subtle pb-16">
      <Banner imageUrl={profile.banner_url || undefined} />

      <div className="mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)] gap-12 px-4 sm:px-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:px-8">
        {/* Identity */}
        <aside>
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="relative z-10 -mt-20 size-40 rounded-full border-4 border-white object-cover shadow-md" />
          ) : (
            <span
              aria-hidden
              className="relative z-10 -mt-20 flex size-40 items-center justify-center rounded-full border-4 border-white bg-primary text-4xl font-bold text-white shadow-md"
            >
              {nameInitials(name)}
            </span>
          )}

          <p className="mt-8 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <UserRound className="size-3.5" aria-hidden />
            {t('profile.publicProfile')}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">{name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">@{profile.user.username}</p>
          {profile.headline && <p className="mt-5 text-body">{profile.headline}</p>}
          <ProfileAvailability profile={profile} />

          <ul className="mt-5 space-y-2 text-sm text-soft">
            {profile.location && (
              <li className="flex items-center gap-2">
                <MapPin className="size-4 text-faint" aria-hidden />
                {profile.location}
              </li>
            )}
            <li className="flex items-center gap-2">
              <CalendarDays className="size-4 text-faint" aria-hidden />
              {t('profile.joined', { date: dateFormat({ day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(profile.user.date_joined)) })}
            </li>
          </ul>
          <ProfileFollows profile={profile} name={name} />
          <ProfileLinks profile={profile} />

          <dl className="mt-8 grid grid-cols-3 divide-x divide-border border-y border-border py-5 text-center">
            {(
              [
                [t('profile.stats.posts'), profile.contributions?.posts_count],
                [t('profile.stats.projects'), profile.contributions?.projects_count],
                [t('profile.stats.points'), profile.contributions?.reputation_points ?? profile.reputation_points],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dd className="text-2xl font-bold text-foreground tabular-nums">{value === undefined ? '—' : formatCompact(value)}</dd>
                <dt className="mt-1 text-xs text-muted-foreground">{label}</dt>
              </div>
            ))}
          </dl>

          <div className="mt-8 flex flex-col gap-3">
            <MessageButton userId={profile.user.id} size="lg" className="h-13 w-full text-base" />
            <FollowButton profile={profile} name={name} />
            {me?.id === profile.user.id && (
              <Button asChild size="lg" className="h-13 w-full text-base">
                <Link to="/dashboard/profile">
                  <Pencil /> {t('profile.editMine')}
                </Link>
              </Button>
            )}
            <button
              type="button"
              onClick={share}
              className="flex h-13 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card font-semibold text-foreground shadow-2xs transition-colors hover:bg-subtle"
            >
              <Copy className="size-4.5" />
              {t('profile.share')}
            </button>
          </div>
        </aside>

        {/* Activity */}
        <section className="pt-12" aria-labelledby="activity-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-soft uppercase">{t('profile.activity.eyebrow')}</p>
              <h2 id="activity-title" className="mt-3 text-3xl font-bold tracking-tight text-foreground">
                {t('profile.activity.title')}
              </h2>
              <p className="mt-4 text-soft" aria-live="polite">
                {activity.failed
                  ? t('profile.activity.failed')
                  : activity.total === undefined
                    ? t('profile.activity.loading')
                    : t('profile.activity.total', { count: activity.total, formatted: formatCompact(activity.total), year: activity.year })}
              </p>
            </div>
            <label className="sr-only" htmlFor="activity-year">
              {t('profile.activity.year')}
            </label>
            <select
              id="activity-year"
              value={activity.year}
              onChange={(e) => activity.setYear(Number(e.target.value))}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground"
            >
              {activity.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-8">
            <ActivityHeatmap year={activity.year} counts={activity.counts} />
          </div>

          <div className="no-scrollbar mt-12 flex gap-2 overflow-x-auto border-b border-border" role="tablist">
            {(
              [
                { id: 'about', icon: UserRound },
                { id: 'career', icon: Briefcase },
                { id: 'portfolio', icon: FolderKanban },
                { id: 'communities', icon: Users },
                { id: 'contributions', icon: MessageCircle },
              ] as const
            ).map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-1 py-3 font-medium transition-colors sm:px-3',
                  tab === id ? 'border-primary text-primary' : 'border-transparent text-body hover:text-foreground'
                )}
              >
                <Icon className="size-4.5" aria-hidden />
                {t(`profile.tabs.${id}`)}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {tab === 'about' && <ProfileAbout profile={profile} name={name} />}
            {tab === 'career' && <ProfileCareer profile={profile} name={name} />}
            {tab === 'portfolio' && <ProfilePortfolio profile={profile} name={name} />}
            {tab === 'communities' && <ProfileCommunities profile={profile} name={name} />}
            {tab === 'contributions' && <ProfileContributions profile={profile} name={name} />}
          </div>
        </section>
      </div>
    </div>
  );
}

export default PublicProfile;
