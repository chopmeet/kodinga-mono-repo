import { MailOpen, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button, Loader } from '@kodinga-mono-repo/ui';
import { CommunityAvatar } from '@/pages/shared/community-avatar';
import UseAcceptInvitation from './form/UseAcceptInvitation';

/** /invitations/:code and /invite/:code (sent by email) — join a community with an invitation */
function AcceptInvitation() {
  const { community, invitedTo, invitedEmail, closed, isLoading, isSignedIn, alreadyMember, loginUrl, memberUrl, isJoining, accept, canDecline, isDeclining, decline } = UseAcceptInvitation();
  const name = community?.name ?? invitedTo?.name;

  return (
    <div className="mx-auto flex min-h-[60svh] max-w-lg items-center px-4 py-12">
      <section aria-labelledby="invitation-title" className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xs">
        {isLoading ? (
          <Loader inline size="sm" className="py-4" message="Chargement de l'invitation…" />
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
            <p className="mt-5 text-sm font-medium text-slate-500">Vous êtes invité à rejoindre</p>
            <h1 id="invitation-title" className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {name ?? 'une communauté Kodinga'}
            </h1>
            {invitedEmail && <p className="mt-2 text-sm text-slate-500">Invitation adressée à {invitedEmail}</p>}
            {community?.tagline && <p className="mt-2 text-slate-600">{community.tagline}</p>}
            {community && (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-slate-500">
                <Users className="size-4" aria-hidden />
                {community.members_count.toLocaleString('fr-FR')} membre{community.members_count > 1 ? 's' : ''}
              </p>
            )}

            <div className="mt-8">
              {closed ? (
                <>
                  <p role="alert" className="mb-4 text-sm text-amber-800">
                    {closed}
                  </p>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/">Découvrir les communautés</Link>
                  </Button>
                </>
              ) : !isSignedIn ? (
                <>
                  <Button asChild className="w-full">
                    <Link to={loginUrl}>Se connecter pour rejoindre</Link>
                  </Button>
                  <p className="mt-4 text-sm text-slate-600">
                    Pas encore de compte ?{' '}
                    <Link to="/auth/register" className="font-semibold text-brand hover:underline">
                      Créez-le
                    </Link>
                    , puis rouvrez ce lien.
                  </p>
                </>
              ) : alreadyMember ? (
                <>
                  <p className="mb-4 text-sm text-slate-600">Vous faites déjà partie de cette communauté.</p>
                  <Button asChild variant="outline" className="w-full">
                    <Link to={memberUrl}>Ouvrir la communauté</Link>
                  </Button>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button className="w-full" onClick={accept} isLoading={isJoining} disabled={isDeclining}>
                    Rejoindre {name ?? 'la communauté'}
                  </Button>
                  {canDecline && (
                    <Button variant="outline" className="w-full" onClick={decline} isLoading={isDeclining} disabled={isJoining}>
                      Refuser l’invitation
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
