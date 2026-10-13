import { PauseCircle, PlayCircle, ShieldCheck, ShieldOff } from 'lucide-react';

import { Badge, Button, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@kodinga-mono-repo/ui';
import { type AdminUser, userRole } from '@/data/admin-users.data';
import { dateFormat } from '@/pages/shared/row-actions';
import { formatLastLogin, roleStyle } from '../tables/users-table';
import { nameInitials } from '@/utils/Utils';

type Props = {
  user: AdminUser | null;
  onClose: () => void;
  onToggleActive: (user: AdminUser) => void;
  onToggleStaff: (user: AdminUser) => void;
};

function UserDetailsSheet({ user, onClose, onToggleActive, onToggleStaff }: Props) {
  return (
    <Sheet open={!!user} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {user && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-slate-800 font-semibold text-white" aria-hidden>
                  {nameInitials(user.full_name)}
                </span>
                <div className="min-w-0">
                  <SheetTitle>{user.full_name}</SheetTitle>
                  <SheetDescription className="truncate">@{user.username}</SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-6">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className={roleStyle[userRole(user)].className}>{roleStyle[userRole(user)].label}</Badge>
                {user.is_active ? (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">Actif</Badge>
                ) : (
                  <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Suspendu</Badge>
                )}
                {!user.is_email_verified && (
                  <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-800">Email non vérifié</Badge>
                )}
              </div>

              <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {[
                  ['Email', user.email],
                  ['Ville', user.city],
                  ['Langue', user.preferred_language === 'fr' ? 'Français' : 'Anglais'],
                  ['Inscrit le', dateFormat.format(new Date(user.date_joined))],
                  ['Dernière connexion', formatLastLogin(user.last_login)],
                  ['Communautés rejointes', String(user.communities_joined)],
                  ['Communautés créées', String(user.communities_owned)],
                  ['Publications', String(user.posts_count)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="truncate text-right font-medium text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="flex flex-col gap-2">
                <Button variant="outline" onClick={() => onToggleStaff(user)}>
                  {user.is_staff ? <ShieldOff /> : <ShieldCheck />}
                  {user.is_staff ? 'Retirer les droits admin' : 'Nommer administrateur'}
                </Button>
                <Button variant={user.is_active ? 'danger' : 'outline'} onClick={() => onToggleActive(user)}>
                  {user.is_active ? <PauseCircle /> : <PlayCircle />}
                  {user.is_active ? 'Suspendre le compte' : 'Réactiver le compte'}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default UserDetailsSheet;
