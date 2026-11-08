import { Globe, Lock, Radio, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Avatar, AvatarFallback, AvatarImage, Button } from '@kodinga/ui';
import { useGetCommunityEventsQuery } from '@/utils/api/community/community.api';
import { nameInitials } from '@/utils/Utils';

/**
 * Animated banner displayed at the top of a community whenever a live stream is in progress.
 * Provides immediate one-click access for all members and visitors.
 */
export function LiveBanner({ slug }: { slug: string }) {
  const { data } = useGetCommunityEventsQuery({ slug, status: 'live' }, { pollingInterval: 15_000 });
  const liveEvent = data?.results?.find((e) => e.status === 'live');

  if (!liveEvent) return null;

  const hostName = liveEvent.host?.full_name || liveEvent.host?.username || 'L’organisateur';

  return (
    <div
      role="region"
      aria-label="Événement en direct"
      className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-linear-to-r from-red-950/90 via-slate-900 to-red-950/80 p-4 text-white shadow-xl shadow-red-950/20 backdrop-blur-md transition-all hover:border-red-500/50"
    >
      <div className="absolute -top-12 -right-12 size-40 rounded-full bg-red-600/10 blur-3xl pointer-events-none" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="relative mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-600/20 text-red-500 ring-1 ring-red-500/30">
            <Radio className="size-5 animate-pulse" />
            <span className="absolute -top-0.5 -right-0.5 flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold tracking-wider text-white uppercase">
                <span className="size-1.5 animate-pulse rounded-full bg-white" /> En direct
              </span>
              {liveEvent.is_public ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                  <Globe className="size-3" /> Public
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                  <Lock className="size-3" /> Réservé aux membres
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-slate-300">
                <Users className="size-3.5 text-slate-400" />
                {liveEvent.attendees_count} participant{liveEvent.attendees_count > 1 ? 's' : ''}
              </span>
            </div>

            <h3 className="mt-1 truncate text-base font-semibold text-white sm:text-lg">
              {liveEvent.title}
            </h3>

            <div className="mt-1 flex items-center gap-2 text-xs text-slate-300">
              <Avatar className="size-4 shrink-0">
                {liveEvent.host?.avatar_url && <AvatarImage src={liveEvent.host.avatar_url} alt="" />}
                <AvatarFallback className="bg-red-900 text-[9px] text-white">
                  {nameInitials(hostName)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">Animé par {hostName}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
          <Button
            asChild
            size="sm"
            className="bg-red-600 font-semibold text-white shadow-md shadow-red-600/30 hover:bg-red-500 hover:shadow-red-600/50"
          >
            <Link to={`/communities/${slug}/events/${liveEvent.id}/live`}>
              <Radio className="size-4 animate-pulse" />
              Rejoindre le direct
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
