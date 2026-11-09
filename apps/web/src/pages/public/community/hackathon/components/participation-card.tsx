import { CalendarClock, CircleCheck, Clock, Hourglass, LogIn, Settings, Users, XCircle } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@kodinga/ui';
import { formatDateTime } from '@/pages/community-space/hackathons/hackathon-labels';
import type { HackathonPage } from '../form/UseHackathonPage';
import ApplyModal from './apply-modal';

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <section aria-label={t('hackathon.participation.label')} className="rounded-xl border border-slate-200 bg-white p-5">
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
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="self-start text-xs font-semibold text-slate-500 underline-offset-2 hover:text-red-600 hover:underline">
        {t('hackathon.participation.withdraw')}
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 p-2 text-xs text-red-800">
      <span>{t('hackathon.participation.withdrawConfirm')}</span>
      <Button size="sm" variant="danger" isLoading={page.isWithdrawing} onClick={() => page.withdraw().then(() => setConfirming(false))}>
        {t('hackathon.participation.confirm')}
      </Button>
      <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>
        {t('common.actions.cancel')}
      </Button>
    </div>
  );
}

/** What the user can do now: sign in, join, apply, wait, take part */
function ParticipationCard({ page }: { page: HackathonPage }) {
  const { t } = useTranslation();
  const [applying, setApplying] = useState(false);
  const h = page.hackathon;
  if (!h) return null;
  const status = h.user_status;
  const notOpenYet = new Date(h.registration_start).getTime() > Date.now();

  const card = (() => {
    switch (page.participation) {
      case 'visitor':
        return (
          <Card icon={<LogIn className="size-5 text-blue-900" />} title={t('hackathon.participation.wantIn')}>
            <p>{t('hackathon.participation.loginToApply')}</p>
            <Button asChild>
              <Link to={page.loginUrl}>{t('hackathon.participation.login')}</Link>
            </Button>
          </Card>
        );
      case 'not_member':
        return (
          <Card icon={<Users className="size-5 text-blue-900" />} title={t('hackathon.participation.membersOnly')}>
            <p>{t('hackathon.participation.joinToApply', { name: page.community?.name ?? t('hackathon.participation.theCommunity') })}</p>
            <Button asChild>
              <Link to={`/communities/${page.slug}`}>{t('hackathon.participation.joinCommunity')}</Link>
            </Button>
          </Card>
        );
      case 'can_apply':
        return (
          <Card icon={<CalendarClock className="size-5 text-blue-900" />} title={t('hackathon.participation.open')}>
            <p>{t('hackathon.participation.until', { date: formatDateTime(h.registration_end) })}</p>
            {status?.application_status === 'rejected' && <p className="text-amber-700">{t('hackathon.participation.reapply')}</p>}
            {h.max_participants && typeof h.participants_count === 'number' ? (
              <p>{t('hackathon.participation.seats', { taken: h.participants_count, max: h.max_participants })}</p>
            ) : null}
            <Button onClick={() => setApplying(true)}>{t('hackathon.participation.apply')}</Button>
          </Card>
        );
      case 'pending':
        return (
          <Card icon={<Hourglass className="size-5 text-amber-600" />} title={t('hackathon.participation.pendingTitle')}>
            <p>{t('hackathon.participation.pendingText')}</p>
            <WithdrawButton page={page} />
          </Card>
        );
      case 'waitlisted':
        return (
          <Card icon={<Clock className="size-5 text-sky-600" />} title={t('hackathon.participation.waitlistTitle')}>
            <p>{t('hackathon.participation.waitlistText')}</p>
            <WithdrawButton page={page} />
          </Card>
        );
      case 'rejected':
        return (
          <Card icon={<XCircle className="size-5 text-red-600" />} title={t('hackathon.participation.rejectedTitle')}>
            {page.application?.rejection_reason ? (
              <p>{t('hackathon.participation.reason', { reason: page.application.rejection_reason })}</p>
            ) : (
              <p>{t('hackathon.participation.rejectedText')}</p>
            )}
          </Card>
        );
      case 'withdrawn':
        return (
          <Card icon={<XCircle className="size-5 text-slate-400" />} title={t('hackathon.participation.withdrawnTitle')}>
            <p>{t('hackathon.participation.closedText')}</p>
          </Card>
        );
      case 'accepted':
        return (
          <Card icon={<CircleCheck className="size-5 text-emerald-600" />} title={t('hackathon.participation.acceptedTitle')}>
            <ul className="flex flex-col gap-1.5">
              {h.allow_teams && <li>
                  {t('hackathon.participation.team')}{' '}
                  {status?.team_name ? <strong className="text-slate-900">{status.team_name}</strong> : t('hackathon.participation.noTeam')}
                </li>}
              <li>
                {t('hackathon.participation.project')}{' '}
                {status?.submission_is_final ? (
                  <strong className="text-emerald-700">{t('hackathon.participation.submitted')}</strong>
                ) : status?.has_submission ? (
                  t('hackathon.participation.draft')
                ) : (
                  t('hackathon.participation.notStarted')
                )}
              </li>
              <li>{t('hackathon.participation.deadline', { date: formatDateTime(h.submission_deadline) })}</li>
            </ul>
            <Button onClick={page.openSpace}>{t('hackathon.participation.openSpace')}</Button>
            {!status?.submission_is_final && h.is_registration_open && <WithdrawButton page={page} />}
          </Card>
        );
      default:
        return (
          <Card icon={<CalendarClock className="size-5 text-slate-400" />} title={notOpenYet ? t('hackathon.participation.soon') : t('hackathon.participation.closed')}>
            {notOpenYet ? (
              <p>{t('hackathon.participation.opensOn', { date: formatDateTime(h.registration_start) })}</p>
            ) : (
              <>
                <p className="font-medium text-slate-900">{t('hackathon.participation.noLonger')}</p>
                <p>{t('hackathon.participation.closedOn', { date: formatDateTime(h.registration_end) })}</p>
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
            <Settings /> {t('hackathon.participation.manage')}
          </Link>
        </Button>
      )}
      <ApplyModal page={page} open={applying} onClose={() => setApplying(false)} />
    </div>
  );
}

export default ParticipationCard;
