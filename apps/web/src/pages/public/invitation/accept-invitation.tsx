import { MailOpen, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button, Loader } from '@kodinga/ui';
import { formatNumber } from '@/utils/format';
import { CommunityAvatar } from '@/pages/shared/community-avatar';
import UseAcceptInvitation from './form/UseAcceptInvitation';

/** /invitations/:code and /invite/:code (sent by email) — join a community with an invitation */
function AcceptInvitation() {
  const { t } = useTranslation();
  const { community, invitedTo, invitedEmail, closed, isLoading, isSignedIn, alreadyMember, loginUrl, registerUrl, memberUrl, isJoining, accept, canDecline, isDeclining, decline } = UseAcceptInvitation();
  const name = community?.name ?? invitedTo?.name;

  return (
    <div className="mx-auto flex min-h-[60svh] max-w-lg items-center px-4 py-12">
      <section aria-labelledby="invitation-title" className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xs">
        {isLoading ? (
          <Loader inline size="sm" className="py-4" message={t('inbox.invitation.loading')} />
        ) : (
          <>
            {community ? (
              <CommunityAvatar community={community} className="mx-auto size-16 rounded-2xl text-xl" />
            ) : invitedTo?.avatar_url ? (
              <img src={invitedTo.avatar_url} alt="" className="mx-auto size-16 rounded-2xl object-cover" />
            ) : (
              <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-900" aria-hidden>
                <MailOpen className="size-7" />
              </span>
            )}
            <p className="mt-5 text-sm font-medium text-slate-500">{t('inbox.invitation.invited')}</p>
            <h1 id="invitation-title" className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {name ?? t('inbox.invitation.aCommunity')}
            </h1>
            {invitedEmail && <p className="mt-2 text-sm text-slate-500">{t('inbox.invitation.sentTo', { email: invitedEmail })}</p>}
            {community?.tagline && <p className="mt-2 text-slate-600">{community.tagline}</p>}
            {community && (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-slate-500">
                <Users className="size-4" aria-hidden />
                {t('inbox.invitation.members', { count: community.members_count, formatted: formatNumber(community.members_count) })}
              </p>
            )}

            <div className="mt-8">
              {closed ? (
                <>
                  <p role="alert" className="mb-4 text-sm text-amber-800">
                    {closed}
                  </p>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/">{t('inbox.invitation.discover')}</Link>
                  </Button>
                </>
              ) : !isSignedIn ? (
                <>
                  <Button asChild className="w-full">
                    <Link to={loginUrl}>{t('inbox.invitation.loginToJoin')}</Link>
                  </Button>
                  <p className="mt-4 text-sm text-slate-600">
                    {t('inbox.invitation.noAccount')}{' '}
                    <Link to={registerUrl} className="font-semibold text-brand hover:underline">
                      {t('inbox.invitation.create')}
                    </Link>
                    {t('inbox.invitation.thenReopen')}
                  </p>
                </>
              ) : alreadyMember ? (
                <>
                  <p className="mb-4 text-sm text-slate-600">{t('inbox.invitation.alreadyMember')}</p>
                  <Button asChild variant="outline" className="w-full">
                    <Link to={memberUrl}>{t('inbox.invitation.open')}</Link>
                  </Button>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button className="w-full" onClick={accept} isLoading={isJoining} disabled={isDeclining}>
                    {t('inbox.invitation.join', { name: name ?? t('inbox.invitation.theCommunity') })}
                  </Button>
                  {canDecline && (
                    <Button variant="outline" className="w-full" onClick={decline} isLoading={isDeclining} disabled={isJoining}>
                      {t('inbox.invitation.decline')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default AcceptInvitation;
