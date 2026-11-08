import { Link } from 'react-router-dom';

import { Avatar, AvatarFallback, AvatarImage, Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@kodinga/ui';
import type { PublicProfile } from '@/utils/api/profile/profile.type';
import { formatCompact, nameInitials } from '@/utils/Utils';
import UseProfileFollows from '../form/UseProfileFollows';

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

/** "12 abonnés · 3 abonnements", each opening the list of the people */
export function ProfileFollows({ profile, name }: { profile: PublicProfile; name: string }) {
  const follows = UseProfileFollows(profile.user.username);
  const followers = profile.followers_count;
  const following = profile.following_count;
  if (followers === undefined && following === undefined) return null;

  const title = follows.open === 'following' ? `Abonnements de ${name}` : `Abonnés de ${name}`;
  const empty = follows.open === 'following' ? `${name} ne suit personne pour l’instant.` : `Personne ne suit encore ${name}.`;
  const countClass = 'rounded text-sm text-slate-600 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none';

  return (
    <>
      <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <button type="button" className={countClass} onClick={() => follows.show('followers')}>
          <strong className="font-semibold text-slate-900 tabular-nums">{formatCompact(followers ?? 0)}</strong> {plural(followers ?? 0, 'abonné', 'abonnés')}
        </button>
        <span className="text-slate-300" aria-hidden>
          ·
        </span>
        <button type="button" className={countClass} onClick={() => follows.show('following')}>
          <strong className="font-semibold text-slate-900 tabular-nums">{formatCompact(following ?? 0)}</strong> {plural(following ?? 0, 'abonnement', 'abonnements')}
        </button>
      </p>

      <Dialog open={!!follows.open} onOpenChange={(next) => !next && follows.close()}>
        <DialogContent className="max-h-[85svh] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="sr-only">{title}</DialogDescription>
          </DialogHeader>
          {follows.isLoading ? (
            <p className="py-6 text-center text-sm text-slate-500">Chargement…</p>
          ) : follows.failed ? (
            <p className="py-6 text-center text-sm text-red-700">Impossible de charger la liste pour le moment.</p>
          ) : follows.people.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">{empty}</p>
          ) : (
            <ul className="divide-y divide-slate-100" aria-label={title}>
              {follows.people.map((p) => (
                <li key={p.id}>
                  <Link to={`/profiles/${p.username}`} onClick={follows.close} className="flex items-center gap-3 rounded-lg py-3 hover:bg-slate-50">
                    <Avatar className="size-10">
                      {p.avatar_url && <AvatarImage src={p.avatar_url} alt="" />}
                      <AvatarFallback className="bg-blue-50 text-sm font-semibold text-blue-900">{nameInitials(p.display_name || p.username)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900">{p.display_name || p.username}</span>
                      <span className="block truncate text-xs text-slate-500">{p.headline || `@${p.username}`}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {follows.hasMore && (
            <Button variant="outline" className="w-full" isLoading={follows.isFetching} onClick={follows.more}>
              Afficher plus
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
