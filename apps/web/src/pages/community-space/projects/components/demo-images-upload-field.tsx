import { CheckCircle2, ImagePlus, Link2, LoaderCircle, Plus, Trash2, Upload } from 'lucide-react';
import { type ChangeEvent, useId, useState } from 'react';

import { Button, cn, customToast, Input } from '@kodinga/ui';
import { checkImage, useImageUpload } from '@/utils/Utils';

type Props = {
  id?: string;
  label?: string;
  help?: string;
  value: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
  className?: string;
  /** Refusal of the api for the list (an invalid link…) */
  error?: string;
};

export function DemoImagesUploadField({
  id: customId,
  label = "Images de démonstration / Captures d'écran",
  help = 'Téléversez des captures d’écran (JPG, PNG, WebP — max 5 Mo par image)',
  value = [],
  onChange,
  maxImages = 6,
  className,
  error,
}: Props) {
  const autoId = useId();
  const id = customId || autoId;
  const uploadImage = useImageUpload();
  const [isUploading, setIsUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const canAddMore = value.length < maxImages;

  const handleFilesChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    const remainingSlots = maxImages - value.length;
    if (remainingSlots <= 0) {
      customToast.error({ message: `Limite de ${maxImages} images de démo atteinte.` });
      return;
    }

    const filesToUpload = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      customToast.warning({ message: `Seules ${remainingSlots} image(s) peuvent encore être ajoutées.` });
    }

    setUploadError(null);
    setIsUploading(true);

    const uploadedUrls: string[] = [];
    const errors: string[] = [];

    for (const file of filesToUpload) {
      const invalid = checkImage(file, 'banner');
      if (invalid) {
        errors.push(`${file.name}: ${invalid}`);
        continue;
      }
      try {
        const url = await uploadImage(file, 'banner');
        uploadedUrls.push(url);
      } catch (err) {
        const msg = err instanceof Error ? err.message : `Échec de l'envoi de ${file.name}`;
        errors.push(msg);
      }
    }

    if (uploadedUrls.length > 0) {
      onChange([...value, ...uploadedUrls]);
      customToast.success({
        message: `${uploadedUrls.length} image(s) de démo téléversée(s) avec succès !`,
      });
    }

    if (errors.length > 0) {
      setUploadError(errors.join(' '));
      customToast.error({ message: errors[0] });
    }

    setIsUploading(false);
  };

  const handleRemove = (index: number) => {
    const updated = value.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleAddManualUrl = () => {
    const trimmed = manualUrl.trim();
    if (!trimmed) return;
    if (!/^https?:\/\/\S+\.\S+/.test(trimmed)) {
      customToast.error({ message: "Veuillez entrer une adresse d'image valide débutant par https://" });
      return;
    }
    if (!canAddMore) {
      customToast.error({ message: `Limite de ${maxImages} images atteinte.` });
      return;
    }
    onChange([...value, trimmed]);
    setUploadError(null);
    setManualUrl('');
    setShowUrlInput(false);
  };

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <label className="custom-form-label mb-0! block font-medium text-slate-900">
            {label}
            <span className="ml-1.5 text-xs font-normal text-slate-500">
              ({value.length}/{maxImages})
            </span>
          </label>
          <p className="text-xs text-slate-500">{help}</p>
        </div>

        {canAddMore && !isUploading && (
          <div className="flex items-center gap-1.5">
            <label
              htmlFor={`${id}-file`}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50"
            >
              <Upload className="size-3.5 text-blue-600" />
              Téléverser
            </label>
            <button
              type="button"
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50"
            >
              <Link2 className="size-3.5 text-slate-500" />
              Lien URL
            </button>
          </div>
        )}
      </div>

      {/* Hidden Multi-file input */}
      <input
        id={`${id}-file`}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFilesChange}
        disabled={isUploading || !canAddMore}
        className="sr-only"
      />

      {/* Manual URL input modal row */}
      {showUrlInput && canAddMore && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
          <Input
            id={`${id}-url`}
            type="url"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            placeholder="https://…/screenshot.png"
            aria-label="Lien de l’image"
            customClassContainer="mb-0! flex-1"
          />
          <Button type="button" size="sm" onClick={handleAddManualUrl}>
            Ajouter
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowUrlInput(false)}>
            Annuler
          </Button>
        </div>
      )}

      {/* Uploading progress indicator */}
      {isUploading && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-sm text-blue-800">
          <LoaderCircle className="size-5 animate-spin text-blue-600" />
          <span>Téléversement des captures d'écran en cours…</span>
        </div>
      )}

      {/* Grid of uploaded demo images */}
      {value.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {value.map((url, idx) => (
            <div
              key={`${url}-${idx}`}
              className="group relative aspect-video overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-2xs"
            >
              <img src={url} alt={`Démo ${idx + 1}`} className="size-full object-cover" />
              <div className="absolute inset-0 flex items-start justify-between bg-black/40 p-1.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  #{idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  title="Supprimer cette capture"
                  aria-label={`Supprimer la capture ${idx + 1}`}
                  className="flex size-6 items-center justify-center rounded-md bg-red-600/90 text-white transition hover:bg-red-700"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
          ))}

          {canAddMore && !isUploading && (
            <label
              htmlFor={`${id}-file`}
              className="flex aspect-video cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/70 p-2 text-center transition hover:border-blue-500 hover:bg-blue-50/40"
            >
              <Plus className="size-5 text-slate-400" />
              <span className="text-[11px] font-semibold text-slate-600">Ajouter une capture</span>
            </label>
          )}
        </div>
      ) : (
        !isUploading && (
          <label
            htmlFor={`${id}-file`}
            className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-5 text-center transition hover:border-blue-500 hover:bg-blue-50/30"
          >
            <div className="flex size-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <ImagePlus className="size-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-blue-700 hover:underline">
                Cliquez pour sélectionner des captures d'écran de démo
              </span>
              <span className="text-xs text-slate-500"> (sélection multiple supportée)</span>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
              <CheckCircle2 className="size-3" /> Hébergées par Kodinga
            </span>
          </label>
        )
      )}

      {(uploadError || error) && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {uploadError ?? error}
        </p>
      )}
    </div>
  );
}
