import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { ArrowLeft, Briefcase, CalendarDays, Copy, FolderKanban, MapPin, MessageCircle, Pencil, UserRound, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Button, cn, customToast } from '@kodinga-mono-repo/ui';
import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import { useGetPublicProfileQuery } from '@/utils/api/user/user.api';
import { nameInitials, useUser } from '@/utils/Utils';
import { MessageButton } from '@/pages/public/messages/components/message-button';
import { ActivityHeatmap } from './components/activity-heatmap';
import { ProfileAbout, ProfileAvailability, ProfileCareer, ProfileLinks, ProfilePortfolio } from './components/profile-details';

type TabId = 'about' | 'career' | 'portfolio' | 'communities' | 'contributions';

const joinedFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

// Followers and contributions have no api yet: shown, without a made-up number
const STATS = ['Contributions', 'Abonnés', 'Abonnements'];

function Banner({ imageUrl }: { imageUrl?: string }) {
  return (
    <div className="relative isolate h-56 overflow-hidden border-b border-slate-200 sm:h-60">
      {imageUrl ? <img src={imageUrl} alt="" className="absolute inset-0 -z-10 size-full object-cover" /> : <GlassBackdrop className="-z-10" />}
      <div className="mx-auto flex h-full max-w-[1440px] flex-col justify-between px-4 py-8 sm:px-6 lg:px-8">
        <Link to="/" className="flex w-fit items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="size-4" />
          Explorer les communautés
        </Link>
        <p className="self-end pb-6 text-xs font-semibold tracking-[0.2em] text-slate-600 uppercase">Les personnes derrière le code</p>
      </div>
    </div>
  );
}

/** /profiles/:username — public developer profile */
function PublicProfile() {
  const { username = '' } = useParams();
  const { data: profile, isLoading, error } = useGetPublicProfileQuery(username, { skip: !username });
  const me = useUser();
  const [tab, setTab] = useState<TabId>('about');
  const year = new Date().getFullYear();

  if (isLoading) {
    return (
      <div aria-busy="true" aria-label="Chargement du profil">
        <Banner />
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <div className="relative z-10 -mt-20 size-40 animate-pulse rounded-full border-4 border-white bg-slate-100" />
          <div className="mt-6 h-7 w-64 animate-pulse rounded bg-slate-100" />
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
          <h1 className="text-2xl font-bold text-slate-900">{notFound ? 'Profil introuvable' : 'Profil indisponible'}</h1>
          <p className="mt-2 text-slate-500">
            {notFound ? "Ce profil n'existe pas ou n'est pas public." : 'Impossible de charger ce profil pour le moment.'}
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
        customToast.success({ message: 'Lien du profil copié.' });
      }
    } catch {
      // Share sheet dismissed: nothing to do
    }
  };

  return (
    <div className="bg-slate-50 pb-16">
      <Banner imageUrl={profile.banner_url || undefined} />

      <div className="mx-auto grid max-w-[1440px] gap-12 px-4 sm:px-6 lg:grid-cols-[22rem_1fr] lg:px-8">
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

          <p className="mt-8 flex items-center gap-1.5 text-xs font-medium tracking-wide text-slate-500 uppercase">
            <UserRound className="size-3.5" aria-hidden />
            Profil public
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{name}</h1>
          <p className="mt-2 text-sm text-slate-500">@{profile.user.username}</p>
          {profile.headline && <p className="mt-5 text-slate-700">{profile.headline}</p>}
          <ProfileAvailability profile={profile} />

          <ul className="mt-5 space-y-2 text-sm text-slate-600">
            {profile.location && (
              <li className="flex items-center gap-2">
                <MapPin className="size-4 text-slate-400" aria-hidden />
                {profile.location}
              </li>
            )}
            <li className="flex items-center gap-2">
              <CalendarDays className="size-4 text-slate-400" aria-hidden />
              Inscrit le {joinedFormat.format(new Date(profile.user.date_joined))}
            </li>
          </ul>
          <ProfileLinks profile={profile} />

          <dl className="mt-8 grid grid-cols-3 divide-x divide-slate-200 border-y border-slate-200 py-5 text-center">
            {STATS.map((label) => (
              <div key={label} title="Bientôt disponible">
                <dd className="text-2xl font-bold text-slate-900">—</dd>
                <dt className="mt-1 text-xs text-slate-500">{label}</dt>
              </div>
            ))}
          </dl>

          <div className="mt-8 flex flex-col gap-3">
            <MessageButton userId={profile.user.id} size="lg" className="h-13 w-full text-base" />
            {me?.id === profile.user.id && (
              <Button asChild size="lg" className="h-13 w-full text-base">
                <Link to="/dashboard/profile">
                  <Pencil /> Modifier mon profil
                </Link>
              </Button>
            )}
            <button
              type="button"
              onClick={share}
              className="flex h-13 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white font-semibold text-slate-900 shadow-2xs transition-colors hover:bg-slate-50"
            >
              <Copy className="size-4.5" />
              Partager le profil
            </button>
          </div>
        </aside>

        {/* Activity */}
        <section className="pt-12" aria-labelledby="activity-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-slate-600 uppercase">Un peu chaque jour</p>
              <h2 id="activity-title" className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                Activité
              </h2>
              <p className="mt-4 text-slate-600">L'historique des contributions arrive bientôt.</p>
            </div>
            <label className="sr-only" htmlFor="activity-year">
              Année
            </label>
            <select
              id="activity-year"
              value={year}
              onChange={() => undefined}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900"
            >
              <option value={year}>{year}</option>
            </select>
          </div>

          <div className="mt-8">
            <ActivityHeatmap year={year} />
          </div>

          <div className="no-scrollbar mt-12 flex gap-2 overflow-x-auto border-b border-slate-200" role="tablist">
            {(
              [
                { id: 'about', label: 'À propos', icon: UserRound },
                { id: 'career', label: 'Parcours', icon: Briefcase },
                { id: 'portfolio', label: 'Portfolio', icon: FolderKanban },
                { id: 'communities', label: 'Communautés', icon: Users },
                { id: 'contributions', label: 'Contributions', icon: MessageCircle },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-1 py-3 font-medium transition-colors sm:px-3',
                  tab === id ? 'border-primary text-primary' : 'border-transparent text-slate-700 hover:text-slate-900'
                )}
              >
                <Icon className="size-4.5" aria-hidden />
                {label}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {tab === 'about' && <ProfileAbout profile={profile} name={name} />}
            {tab === 'career' && <ProfileCareer profile={profile} name={name} />}
            {tab === 'portfolio' && <ProfilePortfolio profile={profile} name={name} />}
            {(tab === 'communities' || tab === 'contributions') && (
              <div className="flex flex-col items-center py-14 text-center">
                <span className="flex size-12 items-center justify-center rounded-xl bg-blue-50 text-primary" aria-hidden>
                  {tab === 'communities' ? <Users className="size-6" /> : <MessageCircle className="size-6" />}
                </span>
                <p className="mt-4 font-semibold text-slate-900">
                  {tab === 'communities' ? 'Communautés bientôt visibles' : 'Contributions bientôt visibles'}
                </p>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  {tab === 'communities'
                    ? `Les communautés de ${name} apparaîtront ici.`
                    : `Les publications et réponses de ${name} apparaîtront ici.`}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default PublicProfile;
