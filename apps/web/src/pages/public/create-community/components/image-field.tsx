import { CheckCircle2, ImageOff, ImagePlus, Link2, LoaderCircle, Trash2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { type ChangeEvent, useEffect, useId, useState } from 'react';
import { AiFillCamera } from 'react-icons/ai';
import type { UseFormRegisterReturn } from 'react-hook-form';

import { cn, Input } from '@kodinga/ui';
import { checkImage, type ImagePurpose } from '@/utils/Utils';

export type ImageSource = 'file' | 'url';

type Props = {
  label: string;
  help: string;
  /** Rules of the api (formats, weight) */
  purpose: ImagePurpose;
  source: ImageSource;
  onSourceChange: (source: ImageSource) => void;
  /** File mode */
  file: File | null;
  onFileChange: (file: File | null) => void;
  /** Url mode */
  url: string;
  registration: UseFormRegisterReturn;
  error?: string;
  /** Background upload state */
  isUploading?: boolean;
  isUploaded?: boolean;
};

/** Object url of the chosen file, revoked when it changes */
export function useFilePreview(file: File | null) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return preview;
}

/**
 * Logo or banner of the community: a file to choose (sent when the community is created) or a
 * link to an image. A broken link only warns: the image may be on a host that refuses previews.
 */
export function ImageField({
  label,
  help,
  purpose,
  source,
  onSourceChange,
  file,
  onFileChange,
  url,
  registration,
  error,
  isUploading,
  isUploaded,
}: Props) {
  const { t } = useTranslation();
  const id = useId();
  const [fileError, setFileError] = useState<string | null>(null);
  // The url whose image failed to load (forgotten as soon as the url changes)
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const filePreview = useFilePreview(file);

  const link = url.trim();
  const validLink = !error && /^https:\/\/\S+\.\S+/.test(link);
  const broken = source === 'url' && validLink && brokenUrl === link;
  const image = source === 'file' ? filePreview : validLink && !broken ? link : null;
  const isWide = purpose === 'banner';

  const choose = (e: ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!chosen) return;
    const invalid = checkImage(chosen, purpose);
    setFileError(invalid);
    if (!invalid) onFileChange(chosen);
  };

  return (
    <div className="mb-3">
      <div className="mb-1 flex flex-col items-start gap-2">
        <span id={`${id}-label`} className="custom-form-label dark:text-foreground! block">
          {label}
        </span>
        <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
          {(
            [
              { value: 'file', label: t('create.image.file'), icon: Upload },
              { value: 'url', label: t('create.image.link'), icon: Link2 },
            ] as const
          ).map(({ value, label: text, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={source === value}
              onClick={() => onSourceChange(value)}
              className={cn(
                'flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors',
                source === value ? 'bg-white text-blue-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800',
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {text}
            </button>
          ))}
        </div>
      </div>

      <div className="grid place-items-center">
        <div className={cn('group relative mx-auto my-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50', isWide ? 'aspect-video w-full max-w-sm' : 'size-40')}>
          {image ? (
            <img
              src={image}
              alt={label}
              className="block size-full object-cover"
              onError={source === 'url' ? () => setBrokenUrl(link) : undefined}
            />
          ) : (
            <span className="flex size-full flex-col items-center justify-center gap-1.5 px-4 text-center text-slate-400">
              {broken ? <ImageOff className="size-7" aria-hidden /> : <ImagePlus className="size-7" aria-hidden />}
              <span className="text-xs font-medium">
                {broken ? t('create.image.notFound') : source === 'file' ? t('create.image.clickToChoose') : t('create.image.preview')}
              </span>
            </span>
          )}

          {source === 'file' && (
            <>
              <input
                type="file"
                accept={purpose === 'avatar' ? 'image/jpeg,image/png,image/webp,image/gif' : 'image/jpeg,image/png,image/webp'}
                aria-label={t('create.image.chooseFile', { label })}
                onChange={choose}
                className="peer absolute top-0 left-0 z-20 size-full cursor-pointer opacity-0"
              />
              {image && (
                <span className="pointer-events-none absolute -bottom-full left-0 z-10 flex h-1/2 w-full flex-col items-center justify-center bg-white/50 text-center text-[#333] transition-[bottom] duration-300 ease-in-out peer-hover:bottom-[5%] peer-focus-visible:bottom-[5%]">
                  <AiFillCamera size={22} />
                  <p className="text-[15px] font-bold">{t('create.image.change')}</p>
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {source === 'file' ? (
        <div className="flex flex-col items-center gap-2 text-center">
          <label
            htmlFor={`${id}-file-btn`}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-blue-600 bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-blue-700 shadow-2xs transition hover:bg-blue-100"
          >
            <Upload className="size-3.5" />
            {file ? t('create.image.changeFile') : t('create.image.selectFile')}
          </label>
          <input
            id={`${id}-file-btn`}
            type="file"
            accept={purpose === 'avatar' ? 'image/jpeg,image/png,image/webp,image/gif' : 'image/jpeg,image/png,image/webp'}
            onChange={choose}
            className="sr-only"
          />
          {file ? (
            <div className="flex flex-col items-center gap-1.5">
              <p className="flex max-w-full items-center gap-2 text-xs font-medium text-emerald-700">
                <span className="truncate font-semibold">{file.name}</span>
                <span className="shrink-0 text-xs text-slate-500">{t('create.image.size', { size: (file.size / (1024 * 1024)).toFixed(2) })}</span>
                <button type="button" onClick={() => onFileChange(null)} className="flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-500 hover:text-red-600">
                  <Trash2 className="size-3.5" /> {t('create.image.remove')}
                </button>
              </p>
              {isUploading && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 animate-pulse">
                  <LoaderCircle className="size-3 animate-spin" /> {t('create.image.uploading')}
                </span>
              )}
              {isUploaded && !isUploading && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 className="size-3" /> {t('create.image.ready')}
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">{help}</p>
          )}
          <span className="text-[11px] font-medium text-slate-400">
            {t('create.image.storage')}
          </span>
          {(fileError || error) && <p className="text-sm text-red-600">{fileError ?? error}</p>}
        </div>
      ) : (
        <>
          <Input id={`${id}-url`} type="url" inputMode="url" label={t('create.image.linkOf', { label: label.toLowerCase() })} placeholder="https://…" fieldHelp={help} error={error} customClassContainer="mb-1!" {...registration} />
          {broken && <p className="text-sm text-amber-700">{t('create.image.broken')}</p>}
        </>
      )}
    </div>
  );
}
