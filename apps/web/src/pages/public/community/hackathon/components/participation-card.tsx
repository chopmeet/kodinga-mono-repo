import { CalendarClock, CircleCheck, Clock, Hourglass, LogIn, Settings, Users, XCircle } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@kodinga-mono-repo/ui';
import { formatDateTime } from '@/pages/community-space/hackathons/hackathon-labels';
import type { HackathonPage } from '../form/UseHackathonPage';
import ApplyModal from './apply-modal';

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section aria-label="Ma participation" className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="mt-3 flex flex-col gap-3 text-sm text-slate-600">{children}</div>
    </section>
  );
}

/** Withdraws in two clicks: the application is lost (one may apply again while it is open) */
function WithdrawButton({ page }: { page: HackathonPage }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="self-start text-xs font-semibold text-slate-500 underline-offset-2 hover:text-red-600 hover:underline">
        Retirer ma candidature
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 p-2 text-xs text-red-800">
      <span>Retirer votre candidature ?</span>
      <Button size="sm" variant="danger" isLoading={page.isWithdrawing} onClick={() => page.withdraw().then(() => setConfirming(false))}>
        Confirmer
      </Button>
      <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>
        Annuler
      </Button>
    </div>
  );
}

/** What the user can do now: sign in, join, apply, wait, take part */
function ParticipationCard({ page }: { page: HackathonPage }) {
  const [applying, setApplying] = useState(false);
  const h = page.hackathon;
  if (!h) return null;
  const status = h.user_status;
  const notOpenYet = new Date(h.registration_start).getTime() > Date.now();

  const card = (() => {
    switch (page.participation) {
      case 'visitor':
        return (
          <Card icon={<LogIn className="size-5 text-blue-900" />} title="Envie de participer ?">
            <p>Connectez-vous pour candidater à ce hackathon.</p>
            <Button asChild>
              <Link to={page.loginUrl}>Se connecter</Link>
            </Button>
          </Card>
        );
      case 'not_member':
        return (
          <Card icon={<Users className="size-5 text-blue-900" />} title="Réservé aux membres">
            <p>Rejoignez {page.community?.name ?? 'la communauté'} pour candidater à ses hackathons.</p>
            <Button asChild>
              <Link to={`/communities/${page.slug}`}>Rejoindre la communauté</Link>
            </Button>
          </Card>
        );
      case 'can_apply':
        return (
          <Card icon={<CalendarClock className="size-5 text-blue-900" />} title="Candidatures ouvertes">
            <p>Jusqu’au {formatDateTime(h.registration_end)}.</p>
            {status?.application_status === 'rejected' && <p className="text-amber-700">Votre précédente candidature n’a pas été retenue : vous pouvez candidater à nouveau.</p>}
            {h.max_participants && typeof h.participants_count === 'number' ? (
              <p>
                {h.participants_count} / {h.max_participants} places prises
              </p>
            ) : null}
            <Button onClick={() => setApplying(true)}>Candidater</Button>
          </Card>
        );
      case 'pending':
        return (
          <Card icon={<Hourglass className="size-5 text-amber-600" />} title="Candidature en cours d’examen">
            <p>Les organisateurs vont l’examiner : vous serez notifié de leur décision.</p>
            <WithdrawButton page={page} />
          </Card>
        );
      case 'waitlisted':
        return (
          <Card icon={<Clock className="size-5 text-sky-600" />} title="Sur liste d’attente">
            <p>Une place peut se libérer : vous serez notifié si votre candidature est acceptée.</p>
            <WithdrawButton page={page} />
          </Card>
        );
      case 'rejected':
        return (
          <Card icon={<XCircle className="size-5 text-red-600" />} title="Candidature non retenue">
            {page.application?.rejection_reason ? <p>Motif : {page.application.rejection_reason}</p> : <p>Les organisateurs n’ont pas retenu votre candidature.</p>}
          </Card>
        );
      case 'withdrawn':
        return (
          <Card icon={<XCircle className="size-5 text-slate-400" />} title="Candidature retirée">
            <p>Les candidatures sont closes.</p>
          </Card>
        );
      case 'accepted':
        return (
          <Card icon={<CircleCheck className="size-5 text-emerald-600" />} title="Vous participez !">
            <ul className="flex flex-col gap-1.5">
              {h.allow_teams && <li>Équipe : {status?.team_name ? <strong className="text-slate-900">{status.team_name}</strong> : 'pas encore d’équipe'}</li>}
              <li>
                Projet :{' '}
                {status?.submission_is_final ? (
                  <strong className="text-emerald-700">soumis</strong>
                ) : status?.has_submission ? (
                  'brouillon'
                ) : (
                  'pas encore commencé'
                )}
              </li>
              <li>Date limite : {formatDateTime(h.submission_deadline)}</li>
            </ul>
            <Button onClick={() => page.openTab('space')}>Ouvrir mon espace</Button>
            {!status?.submission_is_final && h.is_registration_open && <WithdrawButton page={page} />}
          </Card>
        );
      default:
        return (
          <Card icon={<CalendarClock className="size-5 text-slate-400" />} title={notOpenYet ? 'Candidatures bientôt ouvertes' : 'Candidatures closes'}>
            {notOpenYet ? (
              <p>Ouverture le {formatDateTime(h.registration_start)}.</p>
            ) : (
              <>
                <p className="font-medium text-slate-900">Les candidatures ne sont plus acceptées.</p>
                <p>Clôture le {formatDateTime(h.registration_end)}.</p>
              </>
            )}
          </Card>
        );
    }
  })();

  return (
    <div className="flex flex-col gap-4">
      {card}
      {status?.is_manager && (
        <Button asChild variant="outline">
          <Link to={`/c/${page.slug}/hackathons/${page.hackathonSlug}`}>
            <Settings /> Gérer le hackathon
          </Link>
        </Button>
      )}
      <ApplyModal page={page} open={applying} onClose={() => setApplying(false)} />
    </div>
  );
}

export default ParticipationCard;
