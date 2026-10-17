import { Ban, Check, Clock, LogOut, Settings } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import {
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
import { useGetCommunityPlansQuery } from '@/utils/api/community/community.api';
import type { BillingInterval, CommunityPlan } from '@/utils/api/billing/billing.type';
import { formatCompact } from '@/utils/Utils';
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

/** Join / leave / subscribe, depending on where the user stands */
export function MembershipActions({ page, className }: { page: CommunityPage; className?: string }) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  const community = page.community;
  if (!community) return null;
  const needsApproval = !!community.settings?.require_approval_to_join;
  const joinLabel = needsApproval ? 'Demander à rejoindre' : 'Rejoindre';

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
          <Dialog open={confirmLeave} onOpenChange={(open) => !open && !page.isLeaving && setConfirmLeave(false)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Quitter {community.name} ?</DialogTitle>
                <DialogDescription>
                  {community.pricing_type === 'paid'
                    ? 'Vous perdez l’accès au contenu. Votre abonnement n’est pas remboursé.'
                    : 'Vous pourrez la rejoindre à nouveau plus tard.'}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmLeave(false)} disabled={page.isLeaving}>
                  Rester
                </Button>
                <Button
                  variant="danger"
                  isLoading={page.isLeaving}
                  onClick={async () => {
                    if (await page.leave()) setConfirmLeave(false);
                  }}
                >
                  <LogOut /> Quitter
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
        <Button asChild className={cn('w-full', className)}>
          <Link to={page.loginUrl}>{joinLabel}</Link>
        </Button>
      ) : (
        <Button className={cn('w-full', className)} onClick={page.join} isLoading={page.isJoining}>
          {joinLabel}
        </Button>
      );
  }
}

export function CommunitySidebar({ page }: { page: CommunityPage }) {
  const community = page.community;
  if (!community) return null;
  const stats = [
    { label: 'Membres', value: formatCompact(community.members_count) },
    { label: 'Publications', value: formatCompact(community.posts_count) },
    { label: 'Formations', value: formatCompact(community.courses_count) },
  ];
  const access =
    community.pricing_type === 'paid'
      ? 'Communauté payante'
      : community.settings?.require_approval_to_join
        ? 'Gratuite · sur validation'
        : 'Gratuite · accès immédiat';

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
      <div className="relative h-28" style={community.banner_url ? undefined : { backgroundColor: community.brand_color || '#1D4ED8' }}>
        {community.banner_url ? <img src={community.banner_url} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" /> : <GlassBackdrop fade={false} />}
      </div>
      <div className="p-5">
        <h2 className="font-bold text-slate-900">{community.name}</h2>
        <p className="mt-0.5 font-mono text-xs text-slate-400">kodinga.africa/{community.slug}</p>
        {community.tagline && <p className="mt-3 text-sm leading-relaxed text-slate-600">{community.tagline}</p>}

        <dl className="mt-4 grid grid-cols-3 divide-x divide-slate-100 border-y border-slate-100 py-3 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <dd className="font-bold text-slate-900">{s.value}</dd>
              <dt className="text-[11px] text-slate-500">{s.label}</dt>
            </div>
          ))}
        </dl>

        <MembershipActions page={page} className="mt-4" />
        {page.membership !== 'member' && <p className="mt-2 text-center font-mono text-[11px] text-slate-500">{access}</p>}
      </div>
    </div>
  );
}
