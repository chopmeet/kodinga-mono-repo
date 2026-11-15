import { useEffect, useRef, useState } from 'react';

import {
  useDeleteMediaAssetMutation,
  useUploadPostFileMutation,
} from '@/utils/api/community/community.api';
import type { PostMedia } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';
import { formatFileSize } from '@/utils/format';

export type AttachmentKind = 'image' | 'document' | 'video';

/** Limits of the api (settings POST_MAX_*, POST_*_MAX_SIZE_BYTES) */
export const ATTACHMENT_RULES = {
  image: { accept: '.jpg,.jpeg,.png,.webp,.gif', maxBytes: 10 * 1024 * 1024, max: 10 },
  document: { accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv', maxBytes: 25 * 1024 * 1024, max: 10 },
  video: { accept: '.mp4,.mov,.webm', maxBytes: 128 * 1024 * 1024, max: 3 },
} as const;
/** Every attachment of a post, videos included */
export const MAX_ATTACHMENTS = 10;

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm'];
const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'];

export type Attachment = {
  key: string;
  kind: AttachmentKind;
  name: string;
  size: number;
  /** Local preview (new image or video) or the picture of an attachment already published */
  previewUrl: string | null;
  status: 'uploading' | 'ready' | 'error';
  /** Upload progress of a video, 0 to 100 */
  progress?: number;
  error?: string;
  /** MediaAsset (media_ids) or VideoAsset (video_ids), once uploaded or already published */
  assetId?: string;
  /** Already on the published post */
  existing?: boolean;
};

const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

/** Why a file is refused before any upload, else null */
function refusal(file: File, kind: AttachmentKind) {
  if (kind === 'video' && file.size > ATTACHMENT_RULES.video.maxBytes) {
    return `« ${file.name} » : uploader une video < 128Mo`;
  }
  const tooBig = file.size > ATTACHMENT_RULES[kind].maxBytes ? `« ${file.name} » dépasse ${formatFileSize(ATTACHMENT_RULES[kind].maxBytes)}.` : null;
  if (kind === 'image' && !IMAGE_MIMES.includes(file.type)) return `« ${file.name} » : formats acceptés JPG, PNG, WEBP, GIF.`;
  if (kind === 'video' && !VIDEO_MIMES.includes(file.type)) return `« ${file.name} » : formats acceptés MP4, MOV, WEBM.`;
  if (kind === 'document' && !DOCUMENT_EXTENSIONS.includes(extensionOf(file.name))) return `« ${file.name} » : formats acceptés PDF, Word, Excel, PowerPoint, TXT, CSV.`;
  return tooBig;
}

const kindOf = (m: PostMedia): AttachmentKind => (m.type === 'IMAGE' ? 'image' : m.type === 'VIDEO' ? 'video' : 'document');

const fromMedia = (m: PostMedia): Attachment => ({
  key: m.id,
  kind: kindOf(m),
  name: m.filename,
  size: m.size,
  previewUrl: m.type === 'IMAGE' ? (m.thumbnail_url ?? m.url) : m.type === 'VIDEO' ? (m.thumbnail_url ?? null) : null,
  status: 'ready',
  assetId: m.id,
  existing: true,
});


function UsePostAttachments({ open, media }: { open: boolean; media?: PostMedia[] }) {
  const [uploadFile] = useUploadPostFileMutation();
  const [deleteAsset] = useDeleteMediaAssetMutation();
  const [items, setItems] = useState<Attachment[]>([]);
  const [removedExisting, setRemovedExisting] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const published = useRef(false);
  const uploads = useRef(new Map<string, AbortController>());
  const itemsRef = useRef(items);
  const mediaRef = useRef(media);
  useEffect(() => {
    itemsRef.current = items;
    mediaRef.current = media;
  });

  // Opening: the attachments of the post being edited, else none. Not again while open: a refetch
  // of the feed must not undo what is being changed
  useEffect(() => {
    if (!open) return;
    published.current = false;
    setItems((mediaRef.current ?? []).filter((m) => m.status !== 'DELETED').map(fromMedia));
    setRemovedExisting([]);
    setNotice(null);
  }, [open]);

  // Leaving: uploads in progress stop, local previews are released
  useEffect(
    () => () => {
      for (const controller of uploads.current.values()) controller.abort();
      for (const item of itemsRef.current) if (!item.existing && item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    },
    [],
  );

  const update = (key: string, changes: Partial<Attachment>) => setItems((current) => current.map((i) => (i.key === key ? { ...i, ...changes } : i)));
  const fail = (key: string, error: unknown) => {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    update(key, { status: 'error', error: error instanceof Error ? error.message : parseApiError(error).message });
  };

  const uploadVideo = (key: string, file: File) => {
    const interval = setInterval(() => {
      setItems((current) =>
        current.map((i) => {
          if (i.key === key && i.status === 'uploading' && (i.progress ?? 0) < 90) {
            return { ...i, progress: Math.min(90, (i.progress ?? 15) + 20) };
          }
          return i;
        })
      );
    }, 180);

    uploadFile({ file, purpose: 'post_video' })
      .unwrap()
      .then((res) => {
        clearInterval(interval);
        update(key, { status: 'ready', assetId: res.asset_id, progress: 100 });
      })
      .catch((error) => {
        clearInterval(interval);
        fail(key, error);
      });
  };

  const add = (files: FileList | File[], kind: AttachmentKind) => {
    setNotice(null);
    const list = Array.from(files);
    const sameKind = items.filter((i) => i.kind === kind).length;
    const room = Math.min(ATTACHMENT_RULES[kind].max - sameKind, MAX_ATTACHMENTS - items.length);
    if (room <= 0) {
      setNotice(kind === 'video' && sameKind >= ATTACHMENT_RULES.video.max ? `${ATTACHMENT_RULES.video.max} vidéos au plus par publication.` : `${MAX_ATTACHMENTS} pièces jointes au plus par publication.`);
      return;
    }
    const refused = list.map((f) => refusal(f, kind)).filter(Boolean) as string[];
    const accepted = list.filter((f) => !refusal(f, kind)).slice(0, room);
    const messages = [...refused, ...(list.length - refused.length > room ? ['Limite atteinte : les fichiers suivants sont ignorés.'] : [])];
    if (messages.length) setNotice(messages.join(' '));

    for (const file of accepted) {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setItems((current) => [
        ...current,
        { key, kind, name: file.name, size: file.size, previewUrl: kind === 'document' ? null : URL.createObjectURL(file), status: 'uploading', progress: 15 },
      ]);
      if (kind === 'video') {
        uploadVideo(key, file);
      } else {
        const interval = setInterval(() => {
          setItems((current) =>
            current.map((i) => {
              if (i.key === key && i.status === 'uploading' && (i.progress ?? 0) < 90) {
                return { ...i, progress: Math.min(90, (i.progress ?? 15) + 20) };
              }
              return i;
            })
          );
        }, 180);

        uploadFile({ file, purpose: kind === 'image' ? 'post_image' : 'post_document' })
          .unwrap()
          .then((res) => {
            clearInterval(interval);
            update(key, { status: 'ready', assetId: res.asset_id, progress: 100 });
          })
          .catch((error) => {
            clearInterval(interval);
            fail(key, error);
          });
      }
    }
  };

  const drop = (item: Attachment) => {
    if (!item.assetId) return;
    deleteAsset(item.assetId).catch(() => undefined);
  };

  const remove = (key: string) => {
    const item = items.find((i) => i.key === key);
    if (!item) return;
    setItems((current) => current.filter((i) => i.key !== key));
    if (item.existing) {
      // Deleted with the post saved (DELETE posts/<id>/media/<media_id>/), not before: "Annuler" keeps it
      setRemovedExisting((current) => [...current, key]);
      return;
    }
    uploads.current.get(key)?.abort();
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    drop(item);
  };

  /** Closed without publishing: uploads stop, the files uploaded for nothing are deleted */
  const discard = () => {
    if (published.current) return;
    for (const controller of uploads.current.values()) controller.abort();
    for (const item of items) if (!item.existing) drop(item);
  };

  const ready = items.filter((i) => i.status === 'ready' && i.assetId);
  const idsOf = (kind: AttachmentKind) => ready.filter((i) => i.kind === kind).map((i) => i.assetId as string);

  const overallProgress =
    items.length === 0
      ? 100
      : Math.round(
          items.reduce((sum, i) => sum + (i.status === 'ready' ? 100 : (i.progress ?? (i.status === 'error' ? 0 : 15))), 0) /
            items.length
        );

  const optimisticMedia: PostMedia[] = items.map((item, index) => ({
    id: item.assetId ?? item.key,
    type: item.kind === 'image' ? 'IMAGE' : item.kind === 'video' ? 'VIDEO' : 'DOCUMENT',
    url: item.previewUrl ?? undefined,
    playback_url: item.kind === 'video' ? (item.previewUrl ?? undefined) : undefined,
    thumbnail_url: item.kind === 'image' ? (item.previewUrl ?? null) : null,
    poster_url: null,
    filename: item.name,
    size: item.size,
    status: 'READY',
    order: index,
    duration: null,
    width: null,
    height: null,
  }));

  return {
    items,
    images: items.filter((i) => i.kind === 'image'),
    documents: items.filter((i) => i.kind === 'document'),
    videos: items.filter((i) => i.kind === 'video'),
    notice,
    add,
    remove,
    discard,
    /** Published: the uploads now belong to the post */
    markPublished: () => {
      published.current = true;
    },
    isUploading: items.some((i) => i.status === 'uploading'),
    hasErrors: items.some((i) => i.status === 'error'),
    /** Overall progress from 0 to 100 */
    overallProgress,
    uploadedCount: ready.length,
    totalCount: items.length,
    /** Pre-rendered media elements ready for simultaneous post display */
    optimisticMedia,
    /** media_ids to send, in display order (images first, then documents, then videos) */
    mediaIds: [...idsOf('image'), ...idsOf('document'), ...idsOf('video')],
    videoIds: idsOf('video'),
    /** Something changed on a published post: media_ids and video_ids are sent on save */
    changed: removedExisting.length > 0 || items.some((i) => !i.existing),
    removedExisting,
    canAdd: items.length < MAX_ATTACHMENTS,
  };
}

export type PostAttachments = ReturnType<typeof UsePostAttachments>;

export default UsePostAttachments;
