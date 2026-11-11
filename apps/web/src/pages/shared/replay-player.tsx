import { AlertTriangle, LoaderCircle } from 'lucide-react';
import { useRef } from 'react';

import { cn } from '@kodinga/ui';
import type { ReplayVideo } from '@/utils/api/event/event.type';
import { useHls } from './use-hls';

/**
 * Replay of an event: a Mux HLS stream (.m3u8, see useHls). Before Mux is done, a "being prepared"
 * notice.
 */
export function ReplayPlayer({ video, title, className }: { video: ReplayVideo; title: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const ready = video.status === 'ready' && !!video.hls_url;

  useHls(ref, video.hls_url, ready);

  if (!ready) {
    const failed = video.status === 'errored' || video.status === 'deleted';
    return (
      <div role="status" className={cn('flex aspect-video flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 px-6 text-center text-sm text-slate-600', className)}>
        {failed ? <AlertTriangle className="size-6 text-amber-600" aria-hidden /> : <LoaderCircle className="size-6 animate-spin text-slate-400" aria-hidden />}
        {failed ? 'Le replay n’a pas pu être préparé.' : 'Le replay est en cours de préparation : il sera visible dans quelques minutes.'}
      </div>
    );
  }
  return (
    <video
      ref={ref}
      controls
      preload="metadata"
      poster={video.poster_url || video.thumbnail_url || undefined}
      aria-label={`Replay : ${title}`}
      className={cn('aspect-video w-full rounded-xl bg-slate-950', className)}
    >
      <track kind="captions" />
    </video>
  );
}
