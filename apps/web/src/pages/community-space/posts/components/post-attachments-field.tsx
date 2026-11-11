import { AlertCircle, Clapperboard, FileText, Film, ImagePlus, LoaderCircle, Paperclip, X } from 'lucide-react';
import { type ReactNode, useRef } from 'react';

import { Button, cn } from '@kodinga/ui';
import { formatFileSize } from '@/utils/format';
import { ATTACHMENT_RULES, type Attachment, type AttachmentKind, type PostAttachments } from '../form/UsePostAttachments';

function RemoveButton({ item, onRemove, className }: { item: Attachment; onRemove: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Retirer « ${item.name} »`}
      className={cn('rounded-full bg-white/95 p-1 text-slate-700 shadow-sm ring-1 ring-slate-200 hover:text-red-600', className)}
    >
      <X className="size-3.5" />
    </button>
  );
}

/** A video being sent: its first frame (local file) or its Mux thumbnail, the upload progress */
function VideoRow({ item, onRemove }: { item: Attachment; onRemove: () => void }) {
  const local = !item.existing && item.previewUrl;
  return (
    <li className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2 pr-3">
      <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-slate-900">
        {local ? (
          <video src={`${item.previewUrl}#t=0.1`} muted playsInline preload="metadata" aria-hidden className="size-full object-cover" />
        ) : item.previewUrl ? (
          <img src={item.previewUrl} alt="" className="size-full object-cover" />
        ) : (
          <Film className="absolute inset-0 m-auto size-5 text-slate-400" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{item.name}</p>
        {item.status === 'uploading' ? (
          <div className="mt-1.5 flex items-center gap-2">
            <div
              role="progressbar"
              aria-label={`Envoi de « ${item.name} »`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={item.progress ?? 0}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"
            >
              <div className="h-full rounded-full bg-blue-900 transition-[width]" style={{ width: `${item.progress ?? 0}%` }} />
            </div>
            <span className="w-9 text-right text-xs text-slate-500 tabular-nums">{item.progress ?? 0} %</span>
          </div>
        ) : (
          <p className={cn('text-xs', item.status === 'error' ? 'text-red-700' : 'text-slate-500')}>
            {item.status === 'error' ? (item.error ?? 'Échec de l’envoi') : item.existing ? 'Publiée' : `${formatFileSize(item.size)} · prête, traitée après publication`}
          </p>
        )}
      </div>
      <RemoveButton item={item} onRemove={onRemove} />
    </li>
  );
}

/**
 * "Images", "Vidéo" and "Documents" of the post form: the chosen files, their upload, and a way to remove
 * them. `children`: the other tools of the form, in the same toolbar.
 */
export function PostAttachmentsField({ attachments, children }: { attachments: PostAttachments; children?: ReactNode }) {
  const imageInput = useRef<HTMLInputElement>(null);
  const documentInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const inputs = { image: imageInput, document: documentInput, video: videoInput };

  return (
    <div className="mb-4">
      {attachments.images.length > 0 && (
        <ul aria-label="Images jointes" className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {attachments.images.map((item) => (
            <li key={item.key} className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              {item.previewUrl && <img src={item.previewUrl} alt={item.name} className="size-full object-cover" />}
              {item.status === 'uploading' && (
                <span className="absolute inset-0 flex items-center justify-center bg-white/60" role="status" aria-label={`Envoi de « ${item.name} »`}>
                  <LoaderCircle className="size-5 animate-spin text-blue-900" />
                </span>
              )}
              {item.status === 'error' && (
                <span className="absolute inset-0 flex items-center justify-center bg-red-50/90 p-1 text-center text-[11px] text-red-700" title={item.error}>
                  <AlertCircle className="mr-1 size-3.5 shrink-0" /> Échec
                </span>
              )}
              <RemoveButton item={item} onRemove={() => attachments.remove(item.key)} className="absolute top-1 right-1" />
            </li>
          ))}
        </ul>
      )}

      {attachments.videos.length > 0 && (
        <ul aria-label="Vidéos jointes" className="mb-3 flex flex-col gap-2">
          {attachments.videos.map((item) => (
            <VideoRow key={item.key} item={item} onRemove={() => attachments.remove(item.key)} />
          ))}
        </ul>
      )}

      {attachments.documents.length > 0 && (
        <ul aria-label="Documents joints" className="mb-3 flex flex-col gap-2">
          {attachments.documents.map((item) => (
            <li key={item.key} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <FileText className="size-5 shrink-0 text-slate-500" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{item.name}</p>
                <p className={cn('text-xs', item.status === 'error' ? 'text-red-700' : 'text-slate-500')}>
                  {item.status === 'uploading' ? 'Envoi…' : item.status === 'error' ? (item.error ?? 'Échec de l’envoi') : formatFileSize(item.size)}
                </p>
              </div>
              {item.status === 'uploading' && <LoaderCircle className="size-4 animate-spin text-blue-900" aria-hidden />}
              <RemoveButton item={item} onRemove={() => attachments.remove(item.key)} />
            </li>
          ))}
        </ul>
      )}

      {attachments.notice && (
        <p role="alert" className="mb-3 text-sm text-amber-800">
          {attachments.notice}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {(['image', 'video', 'document'] as const).map((kind) => (
          <input
            key={kind}
            ref={inputs[kind]}
            type="file"
            multiple
            accept={ATTACHMENT_RULES[kind].accept}
            className="sr-only"
            tabIndex={-1}
            aria-label={kind === 'image' ? 'Choisir des images' : kind === 'video' ? 'Choisir des vidéos' : 'Choisir des documents'}
            onChange={(e) => {
              if (e.target.files?.length) attachments.add(e.target.files, kind);
              e.target.value = '';
            }}
          />
        ))}
        <Button type="button" variant="outline" size="sm" disabled={!attachments.canAdd} onClick={() => imageInput.current?.click()}>
          <ImagePlus />
          Images
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={!attachments.canAdd} onClick={() => videoInput.current?.click()}>
          <Clapperboard />
          Vidéo
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={!attachments.canAdd} onClick={() => documentInput.current?.click()}>
          <Paperclip />
          Documents
        </Button>
        {children}
      </div>
    </div>
  );
}
