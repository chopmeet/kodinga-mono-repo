import { Check, ChevronsUpDown, LayoutGrid } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kodinga-mono-repo/ui';
import { type MyCommunity, roleLabel } from '@/data/community-space.data';
import { CommunityAvatar } from '@/pages/shared/community-avatar';
import { useGetMyManagedCommunitiesQuery } from '@/utils/api/community/community.api';
import { useUser } from '@/utils/Utils';

/** Sidebar header of /c/:slug: current community, and a menu to switch to another one on the same page */
function CommunitySwitcher({ current, collapsed }: { current: MyCommunity; collapsed: boolean }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // /c/lagos-ai-data/members -> /members, kept when switching community
  const subPath = pathname.split('/').slice(3).join('/') || 'dashboard';
  const user = useUser();
  const { data: managed = [] } = useGetMyManagedCommunitiesQuery(undefined, { skip: !user });
  // The current space is always listed (e.g. a demo community the api does not return)
  const communities = managed.some((m) => m.community.slug === current.community.slug) ? managed : [current, ...managed];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Communauté : ${current.community.name}. Changer de communauté`}
        className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
      >
        <CommunityAvatar community={current.community} className="size-9 rounded-lg font-mono text-xs" />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-900">{current.community.name}</span>
              <span className="block truncate text-xs text-slate-500">{roleLabel[current.role]}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-slate-400" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-slate-500">Mes communautés</DropdownMenuLabel>
        {communities.map((m) => (
          <DropdownMenuItem key={m.community.id} onSelect={() => navigate(`/c/${m.community.slug}/${subPath}`)}>
            <CommunityAvatar community={m.community} className="size-7 rounded-lg font-mono text-xs" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{m.community.name}</span>
              <span className="block text-xs text-slate-500">{roleLabel[m.role]}</span>
            </span>
            {m.community.slug === current.community.slug && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/c')}>
          <LayoutGrid />
          Toutes mes communautés
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default CommunitySwitcher;
