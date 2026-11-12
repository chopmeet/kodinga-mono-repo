import type { ColumnDef } from '@tanstack/react-table';
import { Archive, BadgeCheck, Eye, EyeOff, Globe, Lock, MoreHorizontal, Star } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import {
  Badge,
  Button,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kodinga/ui';
import type { CommunityListItem, CommunityPrivacy } from '@/utils/api/community/community.type';
import { formatCompact, getName, nameInitials } from '@/utils/Utils';
import { formatDate } from '@/utils/format';

const privacyBadge: Record<CommunityPrivacy, { label: string; icon: typeof Globe }> = {
  public: { label: 'Publique', icon: Globe },
  private: { label: 'Privée', icon: Lock },
  secret: { label: 'Secrète', icon: EyeOff },
};


function CommunityCell({ community }: { community: CommunityListItem }) {
  return (
    <div className="flex min-w-56 items-center gap-3">
      {community.avatar_url ? (
        <img src={community.avatar_url} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
      ) : (
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 font-mono text-sm font-bold text-white"
          style={community.brand_color ? { backgroundColor: community.brand_color } : undefined}
          aria-hidden
        >
          {nameInitials(community.name)}
        </div>
      )}
      <div className="min-w-0">
        <p className="flex items-center gap-1 font-medium text-foreground">
          <Link to={`/admin/communities/${community.slug}`} className="truncate hover:text-primary hover:underline">
            {community.name}
          </Link>
          {community.is_verified && <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Vérifiée" />}
          {community.is_featured && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-500" aria-label="À la une" />}
        </p>
        <p className="truncate text-xs text-muted-foreground">/{community.slug}</p>
      </div>
    </div>
  );
}

type Props = {
  communities: CommunityListItem[];
  isLoading: boolean;
  onArchive: (community: CommunityListItem) => void;
};

function CommunitiesTable({ communities, isLoading, onArchive }: Props) {
  const navigate = useNavigate();
  const columns: ColumnDef<CommunityListItem>[] = [
    {
      id: 'community',
      header: 'Communauté',
      cell: ({ row }) => <CommunityCell community={row.original} />,
    },
    {
      id: 'owner',
      header: 'Propriétaire',
      cell: ({ row }) => <span className="text-body">{getName(row.original.owner) || '—'}</span>,
    },
    {
      id: 'category',
      header: 'Catégorie',
      cell: ({ row }) => <span className="text-body">{row.original.category?.name ?? '—'}</span>,
    },
    {
      id: 'access',
      header: 'Accès',
      cell: ({ row }) => {
        const privacy = privacyBadge[row.original.privacy_type];
        const Icon = privacy.icon;
        return (
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="gap-1 text-body">
              <Icon />
              {privacy.label}
            </Badge>
            {row.original.pricing_type === 'paid' ? (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Payante</Badge>
            ) : (
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">Gratuite</Badge>
            )}
          </div>
        );
      },
    },
    {
      id: 'members',
      header: () => <span className="block text-right">Membres</span>,
      cell: ({ row }) => (
        <span className="block text-right font-medium text-foreground tabular-nums">
          {formatCompact(row.original.members_count)}
        </span>
      ),
    },
    {
      id: 'posts',
      header: () => <span className="block text-right">Publications</span>,
      cell: ({ row }) => (
        <span className="block text-right text-body tabular-nums">{formatCompact(row.original.posts_count)}</span>
      ),
    },
    {
      id: 'created',
      header: 'Créée le',
      cell: ({ row }) => (
        <time dateTime={row.original.created_at} className="whitespace-nowrap text-soft">
          {formatDate(row.original.created_at)}
        </time>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${row.original.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => navigate(`/admin/communities/${row.original.slug}`)}>
              <Eye />
              Voir la fiche
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600 focus:text-red-700" onSelect={() => onArchive(row.original)}>
              <Archive />
              Archiver
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return <DataTable columns={columns} data={communities} isLoading={isLoading} />;
}

export default CommunitiesTable;
