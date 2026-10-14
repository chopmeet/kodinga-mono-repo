import { Button, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@kodinga-mono-repo/ui';
import { dateFormat, SoonBadge } from '@/pages/shared/row-actions';
import type { User } from '@/utils/api/user/user.type';
import { getName, nameInitials } from '@/utils/Utils';
import { formatLastLogin, upcomingActions, UserStatusBadges } from '../tables/users-table';

type Props = {
  user: User | null;
  onClose: () => void;
};

/** Profile of an account. Admin rights and suspension are shown, disabled until the api supports them */
function UserDetailsSheet({ user, onClose }: Props) {
  const name = user ? getName(user) || user.email : '';
  return (
    <Sheet open={!!user} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {user && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-slate-800 font-semibold text-white" aria-hidden>
                  {nameInitials(name)}
                </span>
                <div className="min-w-0">
                  <SheetTitle>{name}</SheetTitle>
                  <SheetDescription className="truncate">@{user.username}</SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-6">
              <UserStatusBadges user={user} />

              <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {[
                  ['Email', user.email],
                  ['Langue', user.preferred_language === 'en' ? 'Anglais' : 'Français'],
                  ['Fuseau horaire', user.timezone],
                  ['Inscrit le', dateFormat.format(new Date(user.date_joined))],
                  ['Dernière connexion', formatLastLogin(user.last_login)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="truncate text-right font-medium text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="flex flex-col gap-2">
                {upcomingActions(user).map((action) => (
                  <Button key={action.label} variant={action.danger ? 'danger' : 'outline'} disabled>
                    {action.icon}
                    {action.label}
                    <SoonBadge className="ml-1 bg-white/80" />
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default UserDetailsSheet;
