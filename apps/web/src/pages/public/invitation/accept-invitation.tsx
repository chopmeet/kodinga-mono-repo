import { LoaderCircle, MailOpen, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@kodinga-mono-repo/ui';
import { CommunityAvatar } from '@/pages/shared/community-avatar';
import UseAcceptInvitation from './form/UseAcceptInvitation';

/** /invitations/:code — join a community with an invitation link */
function AcceptInvitation() {
  const { community, isLoading, isSignedIn, alreadyMember, loginUrl, memberUrl, isJoining, accept } = UseAcceptInvitation();

  return (
    <div className="mx-auto flex min-h-[60svh] max-w-lg items-center px-4 py-12">
      <section aria-labelledby="invitation-title" className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xs">
        {isLoading ? (
          <p className="flex items-center justify-center gap-2 text-slate-600" role="status">
            <LoaderCircle className="size-5 animate-spin text-brand" />
            Chargement de l'invitation…
          </p>
        ) : (
          <>
            {community ? (
              <CommunityAvatar community={community} className="mx-auto size-16 rounded-2xl text-xl" />
            ) : (
              <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-900" aria-hidden>
                <MailOpen className="size-7" />
              </span>
            )}
            <p className="mt-5 text-sm font-medium text-slate-500">Vous êtes invité à rejoindre</p>
            <h1 id="invitation-title" className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {community?.name ?? 'une communauté Kodinga'}
            </h1>
            {community?.tagline && <p className="mt-2 text-slate-600">{community.tagline}</p>}
            {community && (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-slate-500">
                <Users className="size-4" aria-hidden />
                {community.members_count.toLocaleString('fr-FR')} membre{community.members_count > 1 ? 's' : ''}
              </p>
            )}

            <div className="mt-8">
              {!isSignedIn ? (
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
                <Button className="w-full" onClick={accept} isLoading={isJoining}>
                  Rejoindre {community?.name ?? 'la communauté'}
                </Button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default AcceptInvitation;
