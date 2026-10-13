import { cn } from '@kodinga-mono-repo/ui';
import type { CommunityListItem } from '@/utils/api/community/community.type';
import { nameInitials } from '@/utils/Utils';

type Props = { community: Pick<CommunityListItem, 'name' | 'avatar_url' | 'brand_color'>; className?: string };

/** Logo of a community, or its initials on its brand color */
export function CommunityAvatar({ community, className = 'size-9 rounded-lg text-xs' }: Props) {
  if (community.avatar_url) {
    return <img src={community.avatar_url} alt="" className={cn('shrink-0 object-cover', className)} />;
  }
  const initials = nameInitials(community.name, 'K');
  return (
    <span
      aria-hidden
      className={cn('flex shrink-0 items-center justify-center font-bold text-white', className)}
      style={{ backgroundColor: community.brand_color || '#0f172a' }}
    >
      {initials}
    </span>
  );
}
