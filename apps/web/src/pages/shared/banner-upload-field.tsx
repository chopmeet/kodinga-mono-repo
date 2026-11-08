import { ImageOff, ImagePlus, Link2, Trash2, Upload } from 'lucide-react';
import { type ChangeEvent, type DragEvent, useId, useState } from 'react';

import { cn, Input } from '@kodinga/ui';
import { checkImage, useImageUpload } from '@/utils/Utils';

type Props = {
  id?: string;
  label?: string;
  help?: string;
  value?: string;
  onChange: (url: string) => void;
  error?: string;
  className?: string;
};

type Mode = 'file' | 'url';

/**
 * Banner / cover image of a content (event, hackathon, course, project): a file sent to the storage
 * of the api (media/upload-url/, with its progress), or a link. Preview, replace and remove; the
 * format and size are checked before sending.
 */
export function BannerUploadField({
  id: customId,
  label = 'Image de couverture',
  help = 'Recommandé : 1200×630 px (JPG, PNG, WebP — max 5 Mo)',
  value = '',
  onChange,
  error,
  className,
}: Props) {
  const autoId = useId();
  const id = customId || autoId;
  const [mode, setMode] = useState<Mode>('file');
  /** null when not sending, 0 to 100 while sending */
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const uploadImage = useImageUpload();
  const cleanUrl = value.trim();
  const hasImage = !!cleanUrl && cleanUrl !== brokenUrl;
  const isUploading = progress !== null;

  const send = async (file: File) => {
    const invalid = checkImage(file, 'banner');
    if (invalid) {
      setUploadError(invalid);
      return;
    }
    setUploadError(null);
    setProgress(0);
    try {
      onChange(await uploadImage(file, 'banner', setProgress));
      setBrokenUrl(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "L'envoi de l'image a échoué.");
    } finally {
      setProgress(null);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void send(file);
  };

  const handleDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !isUploading) void send(file);
  };

  const handleRemove = () => {
    onChange('');
    setUploadError(null);
    setBrokenUrl(null);
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={`${id}-label`} className="custom-form-label mb-0! block">
          {label}
        </span>
        <div role="radiogroup" aria-label={`${label} : mode`} className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
          {(
            [
              ['file', 'Fichier', <Upload key="f" className="size-3.5" aria-hidden />],
              ['url', 'Lien', <Link2 key="u" className="size-3.5" aria-hidden />],
            ] as const
          ).map(([m, text, icon]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                'flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors',
                mode === m ? 'bg-white text-blue-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800',
              )}
            >
              {icon}
              {text}
            </button>
          ))}
        </div>
      </div>

      {hasImage && !isUploading ? (
        <div className="group relative aspect-21/9 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900/5 shadow-2xs">
          <img src={cleanUrl} alt={`Aperçu : ${label}`} className="size-full object-cover" onError={() => setBrokenUrl(cleanUrl)} />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 bg-gradient-to-t from-slate-950/70 to-transparent p-3">
            <label
              htmlFor={`${id}-file`}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-xs transition hover:bg-white/30"
            >
              <Upload className="size-3" aria-hidden />
              Remplacer
            </label>
            <button
              type="button"
              onClick={handleRemove}
              aria-label={`Supprimer : ${label}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-red-600"
            >
              <Trash2 className="size-3" aria-hidden />
              Supprimer
            </button>
          </div>
        </div>
      ) : isUploading ? (
        <div className="flex aspect-21/9 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-blue-400 bg-blue-50/50 p-6 text-center">
          <p className="text-sm font-semibold text-blue-900">Envoi de l'image… {progress} %</p>
          <span
            role="progressbar"
            aria-label={`Envoi : ${label}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="block h-2 w-full max-w-xs overflow-hidden rounded-full bg-blue-100"
          >
            <span className="block h-full rounded-full bg-blue-700 transition-[width]" style={{ width: `${progress}%` }} />
          </span>
        </div>
      ) : mode === 'file' ? (
        <label
          htmlFor={`${id}-file`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'flex aspect-21/9 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition',
            dragging ? 'border-blue-500 bg-blue-50/60' : 'border-slate-300 bg-slate-50/70 hover:border-blue-500 hover:bg-blue-50/30',
          )}
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 shadow-2xs">
            <ImagePlus className="size-5" aria-hidden />
          </span>
          <span className="text-xs">
            <span className="font-semibold text-blue-700">Choisir une image</span>
            <span className="text-slate-500"> ou la glisser ici</span>
          </span>
          <span className="text-[11px] font-medium text-slate-400">{help}</span>
        </label>
      ) : null}

      <input
        id={`${id}-file`}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-labelledby={`${id}-label`}
        onChange={handleFileChange}
        disabled={isUploading}
        className="sr-only"
      />

      {mode === 'url' && !isUploading && (
        <Input
          id={`${id}-url`}
          type="url"
          inputMode="url"
          label={`Lien : ${label.toLowerCase()}`}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setBrokenUrl(null);
          }}
          placeholder="https://…"
          fieldHelp="Adresse d'une image en https://"
        />
      )}

      {brokenUrl && (
        <p className="flex items-center gap-1.5 text-xs text-amber-700">
          <ImageOff className="size-3.5 shrink-0" aria-hidden />
          Impossible d'afficher cette image : vérifiez que le lien mène à une image.
        </p>
      )}

      {(uploadError || error) && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {uploadError ?? error}
        </p>
      )}
    </div>
  );
}
