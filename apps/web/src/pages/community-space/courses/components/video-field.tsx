import { Link2, Trash2, Upload, Video } from 'lucide-react';
import { type ChangeEvent, useId, useState } from 'react';

import { cn } from '@kodinga/ui';
import { useFilePreview } from '@/pages/public/create-community/components/image-field';
import type { CourseLesson } from '@/utils/api/course/course.type';
import { isPlatformUrl } from '@/utils/Utils';

export type VideoSource = 'file' | 'url';

export const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const VIDEO_MAX_MB = 500;

/** Error of a video link, or null: YouTube, Vimeo, Dailymotion, or a public video file (the api checks it too) */
export function checkVideoUrl(url: string) {
  const link = url.trim();
  if (!/^https:\/\/\S+\.\S+/.test(link)) return 'Lien invalide : il doit commencer par https://';
  return null;
}

type Props = {
  source: VideoSource;
  onSourceChange: (source: VideoSource) => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
  url: string;
  onUrlChange: (url: string) => void;
  /** The video already attached to the lesson (edition) */
  current?: CourseLesson | null;
  /** Length of the chosen video, in seconds, once the browser has read it */
  onDuration?: (seconds: number) => void;
  error?: string | null;
};

/** Video of a lesson: a file to send (UploadThing, then Mux) or the link of a video file */
function VideoField({ source, onSourceChange, file, onFileChange, url, onUrlChange, current, onDuration, error }: Props) {
  const id = useId();
  const [fileError, setFileError] = useState<string | null>(null);
  const filePreview = useFilePreview(file);
  const link = url.trim();
  const platformLink = source === 'url' && isPlatformUrl(link);
  const preview = source === 'file' ? filePreview : link && !platformLink && !checkVideoUrl(link) ? link : null;
  const currentSrc = current?.video_source_url || current?.video_hls_url || '';

  const choose = (e: ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!chosen) return;
    const invalid = !VIDEO_TYPES.includes(chosen.type)
      ? 'Format non pris en charge : MP4, WebM ou MOV.'
      : chosen.size > VIDEO_MAX_MB * 1024 * 1024
        ? `Vidéo trop lourde : ${VIDEO_MAX_MB} Mo au maximum.`
        : null;
    setFileError(invalid);
    if (!invalid) onFileChange(chosen);
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={`${id}-label`} className="custom-form-label">
          Vidéo de la leçon
        </span>
        <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold">
          {(
            [
              { value: 'file', label: 'Fichier', icon: Upload },
              { value: 'url', label: 'Lien', icon: Link2 },
            ] as const
          ).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={source === value}
              onClick={() => onSourceChange(value)}
              className={cn(
                'flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors',
                source === value ? 'bg-blue-50 text-blue-900' : 'text-slate-500 hover:text-slate-800',
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      {preview ? (
        <video
          key={preview}
          src={preview}
          controls
          preload="metadata"
          aria-label="Aperçu de la vidéo"
          onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && onDuration?.(e.currentTarget.duration)}
          className="aspect-video w-full rounded-lg bg-slate-900"
        >
          <track kind="captions" />
        </video>
      ) : platformLink ? (
        <p className="rounded-lg bg-white px-3 py-6 text-center text-sm text-slate-500">Vidéo hébergée sur une plateforme : elle s’affichera dans son lecteur après l’enregistrement.</p>
      ) : currentSrc ? (
        <div className="flex flex-col gap-1">
          {current?.video_embed_url && isPlatformUrl(currentSrc) ? (
            <iframe src={current.video_embed_url} title="Vidéo actuelle" allowFullScreen className="aspect-video w-full rounded-lg bg-slate-900" />
          ) : (
            <video src={currentSrc} controls preload="metadata" aria-label="Vidéo actuelle" className="aspect-video w-full rounded-lg bg-slate-900">
              <track kind="captions" />
            </video>
          )}
          <p className="text-xs text-slate-500">Vidéo actuelle. Choisissez un fichier ou un lien pour la remplacer.</p>
        </div>
      ) : current?.has_video ? (
        <p className="rounded-lg bg-white px-3 py-6 text-center text-sm text-slate-500">
          {current.video_status === 'errored' ? 'La vidéo actuelle n’a pas pu être traitée : envoyez-la à nouveau.' : 'La vidéo actuelle est en cours de traitement.'}
        </p>
      ) : (
        <p className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-6 text-center text-sm text-slate-400">
          <Video className="size-6" aria-hidden />
          Aucune vidéo pour le moment
        </p>
      )}

      {source === 'file' ? (
        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor={`${id}-file`}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-blue-600 bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
          >
            <Upload className="size-3.5" />
            {file ? 'Changer de fichier' : 'Sélectionner une vidéo'}
          </label>
          <input id={`${id}-file`} type="file" accept={VIDEO_TYPES.join(',')} aria-label="Fichier vidéo" onChange={choose} className="sr-only" />
          {file ? (
            <p className="flex min-w-0 items-center gap-2 text-xs font-medium text-emerald-700">
              <span className="truncate font-semibold">{file.name}</span>
              <span className="shrink-0 text-slate-500">({(file.size / (1024 * 1024)).toFixed(1)} Mo)</span>
              <button type="button" onClick={() => onFileChange(null)} className="flex shrink-0 items-center gap-1 font-semibold text-slate-500 hover:text-red-600">
                <Trash2 className="size-3.5" /> Retirer
              </button>
            </p>
          ) : (
            <p className="text-xs text-slate-500">MP4, WebM ou MOV, {VIDEO_MAX_MB} Mo au maximum.</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <input
            type="url"
            aria-label="Lien de la vidéo"
            inputMode="url"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://youtu.be/… ou https://…/ma-video.mp4"
            className="custom-form-control bg-background px-4 py-2"
          />
          <span className="text-xs text-slate-500">YouTube, Vimeo, Dailymotion, ou lien direct vers un fichier vidéo public (.mp4, .webm…).</span>
        </div>
      )}
      {!platformLink && <p className="text-[11px] text-slate-400">La vidéo est préparée pour une lecture fluide : comptez quelques minutes avant qu’elle soit disponible.</p>}
      {(fileError || error) && (
        <p role="alert" className="text-sm text-red-600">
          {fileError ?? error}
        </p>
      )}
    </div>
  );
}

export default VideoField;
