import { useEffect, useRef, useState } from 'react';

import {
  useCreateVideoUploadMutation,
  useDeleteMediaAssetMutation,
  useDeleteVideoAssetMutation,
  useUploadPostFileMutation,
} from '@/utils/api/community/community.api';
import type { PostMedia } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';
import { putFile } from '@/utils/api/media/put-file';
import { formatFileSize } from '@/utils/format';

export type AttachmentKind = 'image' | 'document' | 'video';

/** Limits of the api (settings POST_MAX_*, POST_*_MAX_SIZE_BYTES) */
export const ATTACHMENT_RULES = {
  image: { accept: '.jpg,.jpeg,.png,.webp,.gif', maxBytes: 10 * 1024 * 1024, max: 10 },
  document: { accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv', maxBytes: 25 * 1024 * 1024, max: 10 },
  video: { accept: '.mp4,.mov,.webm', maxBytes: 100 * 1024 * 1024, max: 3 },
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
  const [createVideoUpload] = useCreateVideoUploadMutation();
  const [deleteAsset] = useDeleteMediaAssetMutation();
  const [deleteVideo] = useDeleteVideoAssetMutation();
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
    // The upload to Mux fails with an Error, the api with its answer
    update(key, { status: 'error', error: error instanceof Error ? error.message : parseApiError(error).message });
  };

  const uploadVideo = async (key: string, file: File) => {
    const controller = new AbortController();
    uploads.current.set(key, controller);
    try {
      const target = await createVideoUpload({
        title: file.name,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        purpose: 'post_video',
        cors_origin: window.location.origin,
      }).unwrap();
      update(key, { assetId: target.video_asset_id });
      await putFile(target.upload_url, file, (progress) => update(key, { progress }), controller.signal);
      update(key, { status: 'ready', progress: 100 });
    } catch (error) {
      fail(key, error);
    } finally {
      uploads.current.delete(key);
    }
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
        { key, kind, name: file.name, size: file.size, previewUrl: kind === 'document' ? null : URL.createObjectURL(file), status: 'uploading', progress: kind === 'video' ? 0 : undefined },
      ]);
      if (kind === 'video') {
        uploadVideo(key, file);
      } else {
        uploadFile({ file, purpose: kind === 'image' ? 'post_image' : 'post_document' })
          .unwrap()
          .then((res) => update(key, { status: 'ready', assetId: res.asset_id }))
          .catch((error) => fail(key, error));
      }
    }
  };

  const drop = (item: Attachment) => {
    if (!item.assetId) return;
    (item.kind === 'video' ? deleteVideo(item.assetId) : deleteAsset(item.assetId)).catch(() => undefined);
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
    /** media_ids to send, in display order (images first, then documents) */
    mediaIds: [...idsOf('image'), ...idsOf('document')],
    videoIds: idsOf('video'),
    /** Something changed on a published post: media_ids and video_ids are sent on save */
    changed: removedExisting.length > 0 || items.some((i) => !i.existing),
    removedExisting,
    canAdd: items.length < MAX_ATTACHMENTS,
  };
}

export type PostAttachments = ReturnType<typeof UsePostAttachments>;

export default UsePostAttachments;
