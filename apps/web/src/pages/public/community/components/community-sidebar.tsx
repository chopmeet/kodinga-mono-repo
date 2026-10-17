import { ArrowRight, ArrowUpRight, Ban, CalendarDays, Check, ChevronRight, Clock, Globe, Lock, LogOut, Settings, ShieldCheck, Trophy } from 'lucide-react';
import { useState } from 'react';
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
} from '@kodinga-mono-repo/ui';
import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import { useGetCommunityLeaderboardQuery, useGetCommunityPlansQuery } from '@/utils/api/community/community.api';
import type { BillingInterval, CommunityPlan } from '@/utils/api/billing/billing.type';
import { formatCompact, nameInitials } from '@/utils/Utils';
import type { CommunityPage } from '../form/UseCommunityPage';

const intervalLabel: Record<BillingInterval, string> = { month: '/ mois', year: '/ an', one_time: 'accès à vie' };

const price = (p: CommunityPlan) =>
  `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(p.price))} ${p.currency === 'XOF' ? 'FCFA' : p.currency}`;

/** Formulas of a paid community, each with its PayDunya checkout */
function Plans({ page }: { page: CommunityPage }) {
  const { data: plans = [], isLoading } = useGetCommunityPlansQuery(page.slug);
  const [chosen, setChosen] = useState<string | null>(null);

  if (isLoading) return <p className="text-center text-sm text-slate-500">Chargement des formules…</p>;
  if (plans.length === 0) return <p className="text-center text-sm text-slate-500">Les formules d'adhésion ne sont pas encore ouvertes.</p>;

  return (
    <ul className="space-y-3" aria-label="Formules d'adhésion">
      {plans.map((plan) => (
        <li key={plan.id} className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-semibold text-slate-900">{plan.name}</p>
            <p className="text-right text-sm whitespace-nowrap">
              <span className="font-bold text-slate-900">{price(plan)}</span>{' '}
              <span className="text-slate-500">{intervalLabel[plan.billing_interval]}</span>
            </p>
          </div>
          {plan.description && <p className="mt-1 text-xs text-slate-500">{plan.description}</p>}
          {plan.features.length > 0 && (
            <ul className="mt-2 space-y-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-1.5 text-xs text-slate-600">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                  {f}
                </li>
              ))}
            </ul>
          )}
          {page.membership === 'visitor' ? (
            <Button asChild size="sm" className="mt-3 w-full">
              <Link to={page.loginUrl}>Se connecter pour s'abonner</Link>
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
              S'abonner — {plan.name}
            </Button>
          )}
        </li>
      ))}
      <li className="text-center text-[11px] text-slate-500">Paiement sécurisé par PayDunya : Orange Money, Wave, MTN MoMo, Moov Money ou carte.</li>
    </ul>
  );
}

/** Confirmation before leaving (the owner cannot leave) */
export function LeaveDialog({ page, open, onClose }: { page: CommunityPage; open: boolean; onClose: () => void }) {
  const community = page.community;
  if (!community) return null;
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !page.isLeaving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quitter {community.name} ?</DialogTitle>
          <DialogDescription>
            {community.pricing_type === 'paid' ? 'Vous perdez l’accès au contenu. Votre abonnement n’est pas remboursé.' : 'Vous pourrez la rejoindre à nouveau plus tard.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={page.isLeaving}>
            Rester
          </Button>
          <Button
            variant="danger"
            isLoading={page.isLeaving}
            onClick={async () => {
              if (await page.leave()) onClose();
            }}
          >
            <LogOut /> Quitter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Join / leave / subscribe, depending on where the user stands */
export function MembershipActions({ page, className }: { page: CommunityPage; className?: string }) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  const community = page.community;
  if (!community) return null;
  const needsApproval = !!community.settings?.require_approval_to_join;
  const joinLabel = needsApproval ? 'Demander à rejoindre' : 'Rejoindre la communauté';

  switch (page.membership) {
    case 'member':
      return (
        <div className={cn('space-y-2', className)}>
          <p className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-50 py-2 text-sm font-semibold text-emerald-800">
            <Check className="size-4" /> Vous êtes membre
          </p>
          {page.isTeam && (
            <Button asChild variant="outline" className="w-full">
              <Link to={`/c/${community.slug}/dashboard`}>
                <Settings /> Gérer la communauté
              </Link>
            </Button>
          )}
          {page.role !== 'owner' && (
            <Button variant="ghost" size="sm" className="w-full text-slate-500" onClick={() => setConfirmLeave(true)}>
              <LogOut /> Quitter la communauté
            </Button>
          )}
          <LeaveDialog page={page} open={confirmLeave} onClose={() => setConfirmLeave(false)} />
        </div>
      );
    case 'pending':
      return (
        <p className={cn('flex items-center justify-center gap-1.5 rounded-lg bg-amber-50 py-2.5 text-sm font-semibold text-amber-800', className)}>
          <Clock className="size-4" /> Demande en cours d'examen
        </p>
      );
    case 'banned':
      return (
        <p className={cn('flex items-center justify-center gap-1.5 rounded-lg bg-red-50 py-2.5 text-sm font-semibold text-red-700', className)}>
          <Ban className="size-4" /> Vous n'avez plus accès à cette communauté
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
  if (community.pricing_type === 'paid') return 'Paiement sécurisé par PayDunya';
  if (community.settings?.require_approval_to_join) return 'Votre demande sera validée par l’équipe';
  return 'Accès immédiat et gratuit';
}

/** Top 3 of the community (public leaderboard; the api has no weekly ranking yet) */
function HonourBoard({ slug }: { slug: string }) {
  const { data = [] } = useGetCommunityLeaderboardQuery({ slug, limit: 3 });
  if (data.length === 0) return null;
  return (
    <section aria-labelledby="honour-board">
      <h3 id="honour-board" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        <Trophy className="size-5 text-amber-600" /> Les membres à l’honneur
      </h3>
      <p className="mt-1 text-sm text-slate-500">Depuis le début</p>
      <ol className="mt-3 divide-y divide-slate-200" aria-label="Membres à l’honneur">
        {data.map((e) => (
          <li key={e.user.id} className="flex items-center gap-3 py-3">
            <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold', e.rank === 1 ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-slate-600')}>
              {e.rank}
            </span>
            <Avatar className="size-9">
              {e.user.avatar_url && <AvatarImage src={e.user.avatar_url} alt="" />}
              <AvatarFallback className="bg-blue-50 text-xs font-semibold text-blue-900">{nameInitials(e.user.name || e.user.username)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{e.user.name}</p>
              <p className="text-xs text-slate-500">Niveau {e.level}</p>
            </div>
            <span className="text-sm font-semibold text-blue-900 tabular-nums">+{formatCompact(e.points)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Member: the community card, a shortcut to the feed (or the space for the team), the top members */
function MemberSidebar({ page }: { page: CommunityPage }) {
  const community = page.community;
  if (!community) return null;
  const stats = [
    { label: 'Membres', value: community.members_count },
    { label: 'Publications', value: community.posts_count },
    { label: 'Formations', value: community.courses_count },
  ];
  return (
    <div className="flex flex-col gap-8">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="relative h-44" style={community.banner_url ? undefined : { backgroundColor: community.brand_color || '#1D4ED8' }}>
          {community.banner_url ? <img src={community.banner_url} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" /> : <GlassBackdrop fade={false} />}
        </div>
        <div className="p-6">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-600 uppercase">Les connexions qui comptent</p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">{community.name}</h2>
          {community.tagline && <p className="mt-3 leading-relaxed text-slate-600">{community.tagline}</p>}

          <dl className="mt-6 grid grid-cols-3 divide-x divide-slate-200 border-y border-slate-200 py-5 text-center">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col-reverse gap-1">
                <dt className="text-xs text-slate-500">{s.label}</dt>
                <dd className="text-lg font-semibold text-slate-900">{formatCompact(s.value)}</dd>
              </div>
            ))}
          </dl>

          <Button asChild size="lg" className="mt-6 w-full">
            {page.isTeam ? (
              <Link to={`/c/${community.slug}/dashboard`}>
                Gérer la communauté <ArrowUpRight />
              </Link>
            ) : (
              <Link to="?tab=feed" replace>
                Ouvrir le fil <ArrowUpRight />
              </Link>
            )}
          </Button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="size-3.5" /> Vous êtes membre de cette communauté
          </p>
        </div>
      </div>

      <HonourBoard slug={community.slug} />
    </div>
  );
}

export function CommunitySidebar({ page }: { page: CommunityPage }) {
  const community = page.community;
  if (!community) return null;
  if (page.membership === 'member') return <MemberSidebar page={page} />;
  const n = community.members_count;
  const isPublic = community.privacy_type === 'public';
  const note = accessNote(page);
  const stats = [
    { label: n > 1 ? 'Membres' : 'Membre', value: <span className="text-lg font-semibold">{formatCompact(n)}</span> },
    { label: isPublic ? 'Publique' : 'Privée', value: isPublic ? <Globe className="mx-auto size-5" /> : <Lock className="mx-auto size-5" /> },
    { label: 'Accès', value: <span className="text-lg font-semibold">{community.pricing_type === 'paid' ? 'Payant' : 'Gratuit'}</span> },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="relative h-44" style={community.banner_url ? undefined : { backgroundColor: community.brand_color || '#1D4ED8' }}>
          {community.banner_url ? <img src={community.banner_url} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" /> : <GlassBackdrop fade={false} />}
        </div>
        <div className="p-6">
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-slate-600 uppercase">
            <span className="size-2 rounded-full bg-brand ring-4 ring-brand/15" aria-hidden />
            Votre prochaine communauté
          </p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">{community.name}</h2>
          {community.tagline && <p className="mt-3 leading-relaxed text-slate-600">{community.tagline}</p>}

          <dl className="mt-6 grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-200 pt-5 text-center">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col-reverse gap-1">
                <dt className="text-xs text-slate-500">{s.label}</dt>
                <dd className="text-slate-900">{s.value}</dd>
              </div>
            ))}
          </dl>

          <MembershipActions page={page} className="mt-6" />
          {note && (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="size-3.5" /> {note}
            </p>
          )}
        </div>
      </div>

      <section aria-labelledby="community-connect" className="px-1">
        <CalendarDays className="size-7 text-blue-900" aria-hidden />
        <h3 id="community-connect" className="mt-3 text-lg font-semibold text-slate-900">
          Les connexions commencent ici.
        </h3>
        <p className="mt-1 text-sm text-slate-600">Une conversation aujourd’hui, une nouvelle idée demain.</p>
        <ul className="mt-4 space-y-3 text-sm font-semibold text-blue-900">
          <li>
            <Link to="?tab=feed" replace className="inline-flex items-center gap-1.5 hover:underline">
              Voir l’espace membre <ChevronRight className="size-4" />
            </Link>
          </li>
          <li>
            <Link to="/" className="inline-flex items-center gap-1.5 hover:underline">
              Explorer d’autres communautés <ChevronRight className="size-4" />
            </Link>
          </li>
        </ul>
      </section>

      <section className="border-t border-slate-200 pt-6 text-sm">
        <p className="text-slate-600">Envie de rassembler votre propre communauté ?</p>
        <Link to="/create-community" className="mt-2 inline-flex items-center gap-1.5 font-semibold text-blue-900 hover:underline">
          Lancez-vous <ArrowRight className="size-4" />
        </Link>
      </section>
    </div>
  );
}
