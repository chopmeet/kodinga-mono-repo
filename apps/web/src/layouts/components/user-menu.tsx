import { LayoutDashboard, LogOut, Settings, ShieldCheck, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kodinga/ui';
import { useLogout } from '@/pages/auth/hooks/useLogout';
import { getInitials, getName, isAdmin, useUser } from '@/utils/Utils';
import { LuUsers } from 'react-icons/lu';

const itemClassName = 'gap-3 px-3 py-2.5 text-[15px] text-body';

/** Avatar of the signed-in user in the public header: their spaces, account and logout */
export function UserMenu() {
  const { t } = useTranslation();
  const user = useUser();
  const { logout } = useLogout();
  const name = getName(user);
  const initials = getInitials(user);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('header.mySpace')}
        title={t('header.mySpace')}
        className="rounded-full focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <Avatar className="size-9">
          <AvatarImage src={user?.avatar} alt="" />
          <AvatarFallback className="bg-blue-900 text-sm font-semibold text-white">{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-72 rounded-2xl p-2">
        <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2 font-normal">
          <Avatar className="size-12">
            <AvatarImage src={user?.avatar} alt="" />
            <AvatarFallback className="bg-blue-900 font-semibold text-white">{initials}</AvatarFallback>
          </Avatar>
          <span className="min-w-0">
            <span className="block truncate text-base font-semibold text-foreground">{name}</span>
            {user?.username && <span className="block truncate text-sm text-muted-foreground">@{user.username}</span>}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className={itemClassName}>
          <Link to="/dashboard/overview">
            <LayoutDashboard className="size-5" />
            {t('header.overview')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={itemClassName}>
          <Link to="/dashboard/communities">
            <LuUsers className="size-5" />
            {t('header.myCommunities')}
          </Link>
        </DropdownMenuItem>
        {isAdmin(user) && (
          <DropdownMenuItem asChild className={itemClassName}>
            <Link to="/admin/dashboard">
              <ShieldCheck className="size-5" />
              {t('header.admin')}
            </Link>
          </DropdownMenuItem>
        )}
        {user?.username && (
          <DropdownMenuItem asChild className={itemClassName}>
            <Link to={`/profiles/${user.username}`}>
              <UserRound className="size-5" />
              {t('header.publicProfile')}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild className={itemClassName}>
          <Link to="/dashboard/profile">
            <Settings className="size-5" />
            {t('header.account')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logout()} className={`${itemClassName} text-red-600 focus:bg-red-50 focus:text-red-700`}>
          <LogOut className="size-5 text-red-600" />
          {t('header.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
