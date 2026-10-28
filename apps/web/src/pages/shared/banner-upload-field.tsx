import { CheckCircle2, ImageOff, ImagePlus, Link2, LoaderCircle, Trash2, Upload } from 'lucide-react';
import { type ChangeEvent, useId, useState } from 'react';

import { cn, customToast, Input } from '@kodinga-mono-repo/ui';
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
 * Reusable banner / cover image upload field:
 * Supports direct file upload to UploadThing (persisted in cloud, returns HTTPS URL)
 * or direct URL entry. Live preview and replace/remove controls.
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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);

  const uploadImage = useImageUpload();
  const cleanUrl = value.trim();
  const hasImage = !!cleanUrl && cleanUrl !== brokenUrl;
  const isUploadThingUrl = cleanUrl.includes('utfs.io') || cleanUrl.includes('uploadthing');

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const invalid = checkImage(file, 'banner');
    if (invalid) {
      setUploadError(invalid);
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    try {
      const uploadedUrl = await uploadImage(file, 'banner');
      onChange(uploadedUrl);
      setBrokenUrl(null);
      customToast.success({ message: 'Image téléversée sur UploadThing avec succès !' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Échec de l'envoi de l'image sur UploadThing.";
      setUploadError(msg);
      customToast.error({ message: msg });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    onChange('');
    setUploadError(null);
    setBrokenUrl(null);
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={`${id}-input`} className="custom-form-label mb-0! block">
          {label}
        </label>
        <div
          role="radiogroup"
          aria-label="Mode de sélection de l'image"
          className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold"
        >
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'file'}
            onClick={() => setMode('file')}
            className={cn(
              'flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors',
              mode === 'file' ? 'bg-white text-blue-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <Upload className="size-3.5" aria-hidden />
            Téléverser (UploadThing)
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'url'}
            onClick={() => setMode('url')}
            className={cn(
              'flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors',
              mode === 'url' ? 'bg-white text-blue-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <Link2 className="size-3.5" aria-hidden />
            Lien URL
          </button>
        </div>
      </div>

      {/* Preview Area */}
      {hasImage ? (
        <div className="group relative aspect-21/9 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900/5 shadow-2xs">
          <img
            src={cleanUrl}
            alt={label}
            className="size-full object-cover transition duration-300 group-hover:scale-[1.01]"
            onError={() => setBrokenUrl(cleanUrl)}
          />
          <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-slate-950/70 via-transparent to-transparent p-3 opacity-95 transition">
            <div className="flex items-center justify-between">
              {isUploadThingUrl ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600/90 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-xs backdrop-blur-xs">
                  <CheckCircle2 className="size-3" />
                  Hébergé sur UploadThing
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-xs">
                  Lien externe
                </span>
              )}

              <button
                type="button"
                onClick={handleRemove}
                title="Supprimer cette image"
                className="flex size-7 items-center justify-center rounded-lg bg-black/60 text-white transition hover:bg-red-600"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-white">
              <span className="max-w-[70%] truncate font-mono text-[11px] opacity-80">{cleanUrl}</span>
              <label
                htmlFor={`${id}-file`}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/20 px-2.5 py-1 font-semibold text-white backdrop-blur-xs transition hover:bg-white/30"
              >
                <Upload className="size-3" />
                Changer
              </label>
            </div>
          </div>
        </div>
      ) : isUploading ? (
        <div className="flex aspect-21/9 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-blue-400 bg-blue-50/50 p-6 text-center">
          <LoaderCircle className="size-8 animate-spin text-blue-600" />
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-semibold text-blue-900">Téléversement sur UploadThing en cours…</p>
            <p className="text-xs text-blue-600">Stockage persistant et optimisation CDN</p>
          </div>
        </div>
      ) : mode === 'file' ? (
        <label
          htmlFor={`${id}-file`}
          className="flex aspect-21/9 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-6 text-center transition hover:border-blue-500 hover:bg-blue-50/30"
        >
          <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 shadow-2xs">
            <ImagePlus className="size-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-blue-700 hover:underline">
              Cliquez pour téléverser une bannière
            </span>
            <span className="text-xs text-slate-500"> ou glissez-déposez ici</span>
          </div>
          <p className="text-[11px] font-medium text-slate-400">{help}</p>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
            <CheckCircle2 className="size-3" /> Stockage cloud persistant sur UploadThing
          </span>
        </label>
      ) : null}

      {/* Hidden file input */}
      <input
        id={`${id}-file`}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        disabled={isUploading}
        className="sr-only"
      />

      {/* URL Mode input */}
      {mode === 'url' && !isUploading && (
        <div className="mt-1">
          <Input
            id={`${id}-url`}
            type="url"
            inputMode="url"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setBrokenUrl(null);
            }}
            placeholder="https://images.unsplash.com/…"
            fieldHelp="Collez une adresse d'image valide débutant par https://"
          />
        </div>
      )}

      {/* Broken image alert */}
      {brokenUrl && (
        <p className="flex items-center gap-1.5 text-xs text-amber-700">
          <ImageOff className="size-3.5 shrink-0" />
          Impossible d'afficher cette image : vérifiez que le lien mène bien à un fichier image valide.
        </p>
      )}

      {/* Errors */}
      {(uploadError || error) && (
        <p className="text-xs font-medium text-red-600">{uploadError ?? error}</p>
      )}
    </div>
  );
}
