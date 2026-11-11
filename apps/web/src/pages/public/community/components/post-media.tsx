import { AlertTriangle, ChevronLeft, ChevronRight, Download, FileText, Film, Play } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, cn, customToast, Dialog, DialogContent, DialogDescription, DialogTitle } from '@kodinga/ui';
import { useGetMediaDownloadMutation } from '@/utils/api/community/community.api';
import type { PostMedia as Media } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';
import { useHls } from '@/pages/shared/use-hls';
import { formatFileSize } from '@/utils/format';

const SHOWN = 4;
const extensionOf = (name: string) => name.split('.').pop()?.toUpperCase() ?? '';

/** 102 → "1:42" */
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** Width / height of a video: its aspect ratio ("9:16"), else its size, else 16:9 */
function ratioOf(video: Media) {
  const [w, h] = (video.aspect_ratio ?? '').split(':').map(Number);
  if (w > 0 && h > 0) return w / h;
  if (video.width && video.height) return video.width / video.height;
  return 16 / 9;
}

/**
 * A video of a post (Mux): its poster and a play button, the stream loaded on the first click only
 * (no data spent while scrolling the feed, never played with sound by itself). Before Mux is done:
 * "en cours de traitement", updated live (post.video.updated).
 */
function PostVideo({ video }: { video: Media }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const ready = video.status === 'READY' && !!video.playback_url;
  useHls(ref, video.playback_url, ready && playing);

  if (!ready) {
    const failed = video.status === 'FAILED';
    return (
      <div role="status" className="flex aspect-video flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-6 text-center">
        <span className="relative flex size-12 items-center justify-center rounded-full bg-white shadow-xs ring-1 ring-slate-200">
          {failed ? <AlertTriangle className="size-5 text-amber-600" aria-hidden /> : <Film className="size-5 text-blue-900" aria-hidden />}
          {!failed && <span className="absolute -top-0.5 -right-0.5 size-3 animate-pulse rounded-full bg-blue-600 ring-2 ring-white" aria-hidden />}
        </span>
        <div>
          <p className="text-sm font-medium text-slate-800">{failed ? t('community.media.videoFailed') : t('community.media.videoProcessing')}</p>
          {!failed && <p className="mt-0.5 text-xs text-slate-500">{t('community.media.videoProcessingHint')}</p>}
        </div>
      </div>
    );
  }

  const ratio = ratioOf(video);
  const poster = video.poster_url || video.thumbnail_url || undefined;
  return (
    <div
      className={cn('relative overflow-hidden rounded-xl bg-slate-950', ratio < 1 ? 'mx-auto h-[min(32rem,70svh)]' : 'w-full')}
      style={{ aspectRatio: ratio }}
    >
      {playing ? (
        <video ref={ref} controls autoPlay playsInline poster={poster} aria-label={t('community.media.videoOf', { name: video.filename })} className="size-full">
          <track kind="captions" />
        </video>
      ) : (
        <button type="button" onClick={() => setPlaying(true)} aria-label={t('community.media.play', { name: video.filename })} className="group absolute inset-0">
          {poster && <img src={poster} alt="" loading="lazy" className="size-full object-cover" />}
          <span className="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-transparent" aria-hidden />
          <span className="absolute inset-0 m-auto flex size-16 items-center justify-center rounded-full bg-white/95 text-blue-900 shadow-lg transition-transform group-hover:scale-105" aria-hidden>
            <Play className="ml-1 size-7 fill-current" />
          </span>
          {!!video.duration && (
            <span className="absolute right-3 bottom-3 rounded-md bg-slate-950/70 px-2 py-0.5 text-xs font-medium text-white tabular-nums">{clock(video.duration)}</span>
          )}
        </button>
      )}
    </div>
  );
}

/** Images in a grid (1, 2, or 4 with "+N"), each opening the viewer */
function ImageGrid({ images, onOpen }: { images: Media[]; onOpen: (index: number) => void }) {
  const { t } = useTranslation();
  const shown = images.slice(0, SHOWN);
  const more = images.length - shown.length;
  return (
    <ul aria-label={t('community.media.images')} className={cn('mt-5 grid gap-1.5 overflow-hidden rounded-xl', images.length > 1 && 'grid-cols-2')}>
      {shown.map((image, i) => (
        <li key={image.id} className={cn(images.length === 3 && i === 0 && 'row-span-2')}>
          <button
            type="button"
            onClick={() => onOpen(i)}
            aria-label={t('community.media.open', { name: image.filename })}
            className="relative block size-full overflow-hidden bg-slate-100"
          >
            <img
              src={image.url ?? image.thumbnail_url ?? ''}
              alt={image.filename}
              loading="lazy"
              className={cn('size-full object-cover transition-transform hover:scale-[1.02]', images.length === 1 ? 'max-h-[28rem]' : 'aspect-square')}
            />
            {more > 0 && i === shown.length - 1 && (
              <span className="absolute inset-0 flex items-center justify-center bg-slate-900/55 text-2xl font-semibold text-white">+{more}</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** One image at a time, with previous / next (arrows of the keyboard too) */
function Viewer({ images, index, onIndex, onClose }: { images: Media[]; index: number | null; onIndex: (i: number) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const current = index === null ? null : images[index];
  const go = (step: number) => index !== null && onIndex((index + step + images.length) % images.length);
  return (
    <Dialog open={!!current} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="gap-3 border-0 bg-slate-950 p-3 text-white sm:max-w-5xl"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') go(1);
          if (e.key === 'ArrowLeft') go(-1);
        }}
      >
        <DialogTitle className="truncate pr-8 text-sm font-medium text-white lg:text-sm">{current?.filename}</DialogTitle>
        <DialogDescription className="sr-only">{t('community.media.position', { n: (index ?? 0) + 1, total: images.length })}</DialogDescription>
        {current && <img src={current.url ?? current.thumbnail_url ?? ''} alt={current.filename} className="mx-auto max-h-[78svh] w-auto rounded-md object-contain" />}
        {images.length > 1 && (
          <div className="flex items-center justify-between text-sm text-slate-300">
            <Button type="button" variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white" onClick={() => go(-1)}>
              <ChevronLeft /> {t('community.media.previous')}
            </Button>
            <span aria-hidden>
              {(index ?? 0) + 1} / {images.length}
            </span>
            <Button type="button" variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white" onClick={() => go(1)}>
              {t('community.media.next')} <ChevronRight />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** A document: type, name, size, and a download checked by the api (access to the community) */
function DocumentCard({ doc }: { doc: Media }) {
  const { t } = useTranslation();
  const [getDownload, { isLoading }] = useGetMediaDownloadMutation();
  const download = async () => {
    try {
      const { file_url } = await getDownload(doc.id).unwrap();
      window.open(file_url, '_blank', 'noopener');
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };
  return (
    <li className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-md bg-white text-[10px] font-bold text-blue-900 ring-1 ring-slate-200">
        <FileText className="size-4" aria-hidden />
        {extensionOf(doc.filename)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{doc.filename}</p>
        <p className="text-xs text-slate-500">{formatFileSize(doc.size)}</p>
      </div>
      <Button type="button" variant="outline" size="sm" isLoading={isLoading} onClick={download} aria-label={t('community.media.downloadOf', { name: doc.filename })}>
        <Download /> {t('community.media.download')}
      </Button>
    </li>
  );
}

/** Videos, images and documents of a post (images and documents once ready; videos as they are) */
export function PostMediaView({ media }: { media?: Media[] }) {
  const { t } = useTranslation();
  const [viewing, setViewing] = useState<number | null>(null);
  const ready = (media ?? []).filter((m) => m.status === 'READY');
  const images = ready.filter((m) => m.type === 'IMAGE' && (m.url || m.thumbnail_url));
  const documents = ready.filter((m) => m.type === 'DOCUMENT');
  const videos = (media ?? []).filter((m) => m.type === 'VIDEO' && m.status !== 'DELETED');
  if (!images.length && !documents.length && !videos.length) return null;

  return (
    <>
      {videos.length > 0 && (
        <ul aria-label={t('community.media.videos')} className="mt-5 flex flex-col gap-3">
          {videos.map((video) => (
            <li key={video.id}>
              <PostVideo video={video} />
            </li>
          ))}
        </ul>
      )}
      {images.length > 0 && <ImageGrid images={images} onOpen={setViewing} />}
      {documents.length > 0 && (
        <ul aria-label={t('community.media.documents')} className="mt-4 flex flex-col gap-2">
          {documents.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </ul>
      )}
      <Viewer images={images} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />
    </>
  );
}
