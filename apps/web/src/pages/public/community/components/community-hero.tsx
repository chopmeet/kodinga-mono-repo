import { ArrowLeft, BadgeCheck, Bell, Check, ChevronDown, Copy, Link2, LogOut, Radio, Settings, ShieldCheck, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { customToast, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@kodinga-mono-repo/ui';
import { memberRoleLabel } from '@/pages/shared/community-labels';
import { CommunityAvatar } from '@/pages/shared/community-avatar';
import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import type { CommunityDetail } from '@/utils/api/community/community.type';
import { formatCompact } from '@/utils/Utils';
import type { CommunityPage } from '../form/UseCommunityPage';
import { LeaveDialog, MembershipActions } from './community-sidebar';

/** "Accès gratuit", "Sur demande", "Payante": the badge next to the name */
export function accessBadge(community: CommunityDetail) {
  if (community.pricing_type === 'paid') return { label: 'Accès payant', className: 'border-slate-200 bg-white/80 text-slate-700' };
  if (community.settings?.require_approval_to_join) return { label: 'Sur demande', className: 'border-amber-200 bg-amber-50 text-amber-800' };
  return { label: 'Accès gratuit', className: 'border-blue-100 bg-blue-50 text-blue-800' };
}

async function copyPageLink() {
  try {
    await navigator.clipboard.writeText(window.location.href.split('?')[0]);
    customToast.success({ message: 'Lien de la communauté copié.' });
    return true;
  } catch {
    customToast.error({ message: 'Copie impossible : copiez l’adresse de la page.' });
    return false;
  }
}

/** Member: role menu (manage, copy the link, leave) */
function MemberMenu({ page }: { page: CommunityPage }) {
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
            aria-label={`Votre rôle : ${memberRoleLabel[role]}`}
            className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white/90 px-4 text-sm font-medium text-slate-800 shadow-2xs hover:text-slate-950"
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
                <Settings /> Gérer la communauté
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => copyPageLink()}>
            <Link2 /> Copier le lien
          </DropdownMenuItem>
          {role !== 'owner' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600 focus:text-red-700" onSelect={() => setConfirmLeave(true)}>
                <LogOut /> Quitter la communauté
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
    <section aria-labelledby="community-name" className="relative overflow-hidden border-b border-slate-200 bg-slate-50">
      {community.banner_url ? (
        <>
          <img src={community.banner_url} alt="" className="absolute inset-0 size-full object-cover" />
          {/* Keeps the text readable on any photo */}
          <div className="absolute inset-0 bg-linear-to-r from-white via-white/90 to-white/40" />
        </>
      ) : (
        <GlassBackdrop />
      )}

      <div className="relative mx-auto max-w-285 px-4 pt-6 pb-10 sm:px-6 lg:px-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="size-4" />
          Explorer les communautés
        </Link>

        <div className="mt-8 flex flex-wrap items-start gap-5 sm:gap-6">
          <CommunityAvatar community={community} className="size-16 rounded-xl text-xl shadow-sm sm:size-20 sm:text-2xl" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-600 uppercase">{isMember ? 'Votre espace communauté' : 'Les communautés Kodinga'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <h1 id="community-name" className="text-3xl font-bold tracking-tight break-words text-slate-900 sm:text-4xl">
                {community.name}
              </h1>
              {community.is_verified && <BadgeCheck className="size-6 shrink-0 text-brand" aria-label="Communauté vérifiée" />}
              {community.active_live && (
                <Link
                  to={`/communities/${community.slug}/events/${community.active_live.id}/live`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-md shadow-red-600/30 hover:bg-red-500 transition-all hover:scale-105 animate-pulse"
                >
                  <Radio className="size-3.5" />
                  En direct {community.active_live.is_public ? '' : '🔒 Membres'}
                </Link>
              )}
              {!isMember && <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold tracking-wide uppercase ${badge.className}`}>{badge.label}</span>}
            </div>
            {isMember ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <Users className="size-4" /> {formatCompact(n)} membre{n > 1 ? 's' : ''}
              </p>
            ) : (
              community.tagline && <p className="mt-3 text-slate-600">{community.tagline}</p>
            )}
            {!isMember && (
              <div className="mt-5 lg:hidden">
                {community.pricing_type === 'paid' ? (
                  <a href="#formules" className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-900 px-5 text-sm font-semibold text-white">
                    Voir les formules
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
              {/* Notifications of the community: not in the api yet */}
              <button
                type="button"
                disabled
                title="Notifications : bientôt disponible"
                aria-label="Notifications (bientôt disponible)"
                className="flex size-11 cursor-not-allowed items-center justify-center rounded-lg border border-slate-200 bg-white/90 text-slate-400 shadow-2xs"
              >
                <Bell className="size-5" />
              </button>
              <MemberMenu page={page} />
            </div>
          ) : (
            <button
              type="button"
              onClick={copy}
              aria-label="Copier le lien de la communauté"
              title="Copier le lien"
              className="hidden size-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-2xs hover:text-slate-900 sm:flex"
            >
              {copied ? <Check className="size-5 text-emerald-600" /> : <Copy className="size-5" />}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
