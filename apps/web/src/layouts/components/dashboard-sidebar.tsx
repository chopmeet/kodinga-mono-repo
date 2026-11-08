import { FiSettings } from 'react-icons/fi';
import { FaUsers } from 'react-icons/fa';
import {
  LuBriefcase,
  LuCalendarDays,
  LuCreditCard,
  LuFileText,
  LuGraduationCap,
  LuLayoutDashboard,
  LuLogOut,
  LuMedal,
  LuRocket,
  LuTrophy,
  LuUsers,
  LuWallet,
} from 'react-icons/lu';
import { NavLink, useLocation } from 'react-router-dom';
import type { JSX } from 'react/jsx-runtime';

import {
  cn,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useSidebar,
} from '@kodinga/ui';
import { type MyCommunity, roleLabel } from '@/data/community-space.data';
import { useLogout } from '@/pages/auth/hooks/useLogout';
import { canAccess, type SpaceSection, useOptionalCommunitySpace } from '@/pages/community-space/community-space-context';
import CommunitySwitcher from './community-switcher';
import { Logo } from './header';
import { getInitials, getName, useUser } from '@/utils/Utils';

type Menu = {
  id: string;
  path: string;
  label: string;
  icon?: JSX.Element;
};

type MenuSection = {
  id: string;
  title: string;
  items: Menu[];
};

type SidebarSpace = {
  sections: MenuSection[];
  /** Shown under the user name in the footer card */
  roleLabel: string;
};

const adminSpace: SidebarSpace = {
  roleLabel: 'Super Administrateur',
  sections: [
    {
      id: 'overview',
      title: "Vue d'ensemble",
      items: [{ id: 'admin-dashboard', label: 'Tableau de bord', path: '/admin/dashboard', icon: <LuLayoutDashboard /> }],
    },
    {
      id: 'management',
      title: 'Gestion de la plateforme',
      items: [
        { id: 'admin-communities', label: 'Communautés', path: '/admin/communities', icon: <LuUsers /> },
        { id: 'admin-users', label: 'Utilisateurs', path: '/admin/users', icon: <FaUsers /> },
      ],
    },
    {
      id: 'steering',
      title: 'Pilotage',
      items: [{ id: 'admin-settings', label: 'Paramètres', path: '/admin/settings', icon: <FiSettings /> }],
    },
  ],
};

/** /c/:slug — menu built from the role in that community (see community-space-context) */
function communitySpace(space: MyCommunity): SidebarSpace {
  const base = `/c/${space.community.slug}`;
  const allowed = (section: SpaceSection) => canAccess(space, section);
  const sections: MenuSection[] = [
    {
      id: 'overview',
      title: "Vue d'ensemble",
      items: [{ id: 'space-dashboard', label: 'Tableau de bord', path: `${base}/dashboard`, icon: <LuLayoutDashboard /> }],
    },
    {
      id: 'management',
      title: 'Gestion de la communauté',
      items: [
        { id: 'space-members', label: 'Membres', path: `${base}/members`, icon: <LuUsers /> },
        { id: 'space-posts', label: 'Publications', path: `${base}/posts`, icon: <LuFileText /> },
        { id: 'space-events', label: 'Événements', path: `${base}/events`, icon: <LuCalendarDays /> },
        { id: 'space-hackathons', label: 'Hackathons', path: `${base}/hackathons`, icon: <LuTrophy /> },
        { id: 'space-courses', label: 'Formations', path: `${base}/courses`, icon: <LuGraduationCap /> },
        { id: 'space-opportunities', label: 'Opportunités', path: `${base}/opportunities`, icon: <LuBriefcase /> },
        { id: 'space-projects', label: 'Projets', path: `${base}/projects`, icon: <LuRocket /> },
        { id: 'space-leaderboard', label: 'Classement', path: `${base}/leaderboard`, icon: <LuMedal /> },
      ],
    },
    ...(allowed('payments')
      ? [{ id: 'monetization', title: 'Monétisation', items: [{ id: 'space-payments', label: 'Abonnements & paiements', path: `${base}/payments`, icon: <LuWallet /> }] }]
      : []),
    ...(allowed('settings')
      ? [{ id: 'steering', title: 'Pilotage', items: [{ id: 'space-settings', label: 'Paramètres', path: `${base}/settings`, icon: <FiSettings /> }] }]
      : []),
  ];
  return { sections, roleLabel: roleLabel[space.role] };
}

/** /dashboard — the user's own space (the profile has its sub-sections in tabs) */
const userSpace: SidebarSpace = {
  roleLabel: 'Mon espace',
  sections: [
    {
      id: 'my-space',
      title: 'Mon espace',
      items: [
        { id: 'dashboard-overview', label: "Vue d'ensemble", path: '/dashboard/overview', icon: <LuLayoutDashboard /> },
        { id: 'dashboard-communities', label: 'Mes communautés', path: '/dashboard/communities', icon: <LuUsers /> },
        { id: 'dashboard-billing', label: 'Facturation', path: '/dashboard/billing', icon: <LuCreditCard /> },
        { id: 'dashboard-profile', label: 'Mon profil', path: '/dashboard/profile', icon: <FiSettings /> },
      ],
    },
  ],
};

/** Signed-in user + role, with the logout action (avatar only when the sidebar is collapsed) */
function SidebarUserCard({ roleLabel }: { roleLabel: string }) {
  const user = useUser();
  const { logout } = useLogout();
  const { open } = useSidebar();
  const name = getName(user) || 'Compte administrateur';
  const initials = user ? getInitials(user) : 'K';

  const avatar = (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
      aria-hidden
    >
      {initials}
    </span>
  );

  if (!open) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => logout()}
            aria-label={`${name}, se déconnecter`}
            className="mx-auto rounded-full focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            {avatar}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{name} · Se déconnecter</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-slate-100 p-2.5">
      {avatar}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
        <p className="text-xs leading-snug text-slate-500">{roleLabel}</p>
      </div>
      <button
        type="button"
        onClick={() => logout()}
        aria-label="Se déconnecter"
        title="Se déconnecter"
        className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
      >
        <LuLogOut className="size-4" />
      </button>
    </div>
  );
}

export function DashboardSidebar() {
  const { pathname } = useLocation();
  const { open } = useSidebar();
  const communitySpaceValue = useOptionalCommunitySpace();
  const space: SidebarSpace | null = communitySpaceValue
    ? communitySpace(communitySpaceValue)
    : pathname.startsWith('/admin')
      ? adminSpace
      : pathname.startsWith('/dashboard')
        ? userSpace
        : null;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {communitySpaceValue ? (
          <CommunitySwitcher current={communitySpaceValue} collapsed={!open} />
        ) : (
          <Logo variant={open ? 'full' : 'mark'} className={open ? 'px-2 py-1.5' : 'justify-center py-1.5'} />
        )}
      </SidebarHeader>

      <SidebarContent className="px-2">
        {space?.sections.map((section) => (
          <SidebarGroup key={section.id}>
            <SidebarGroupLabel className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              {section.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      asChild
                      // Active link in the brand color (overrides the neutral sidebar-accent of the lib), also on hover
                      className="py-5 text-slate-600 hover:text-slate-900 data-[active=true]:bg-blue-50 data-[active=true]:font-semibold data-[active=true]:text-blue-900 data-[active=true]:shadow-[inset_3px_0_0_var(--color-blue-900)] data-[active=true]:hover:bg-blue-50 data-[active=true]:hover:text-blue-900"
                      isActive={pathname.startsWith(item.path)}
                      tooltip={item.label}
                    >
                      <NavLink to={item.path}>
                        {item.icon}
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {space && (
        <SidebarFooter className={cn('border-t border-slate-200 p-3', !open && 'px-2')}>
          <SidebarUserCard roleLabel={space.roleLabel} />
        </SidebarFooter>
      )}
      <SidebarRail />
    </Sidebar>
  );
}
