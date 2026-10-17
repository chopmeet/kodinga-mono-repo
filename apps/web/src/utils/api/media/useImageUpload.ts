import { useConfirmUploadMutation, useRequestUploadUrlMutation } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import { IMAGE_RULES } from './media.type';

export type ImagePurpose = keyof typeof IMAGE_RULES;

const MB = 1024 * 1024;

/** Message when the file breaks the rules of the api, null when it is fine */
export function checkImage(file: File, purpose: ImagePurpose): string | null {
  const rules = IMAGE_RULES[purpose];
  if (!rules.types.includes(file.type)) {
    const formats = rules.types.map((t) => t.replace('image/', '').toUpperCase().replace('JPEG', 'JPG')).join(', ');
    return `Format non accepté : ${formats}.`;
  }
  if (file.size > rules.maxBytes) return `Image trop lourde : ${rules.maxBytes / MB} Mo maximum.`;
  return null;
}

/** Url of the stored file in the answer of the storage (UploadThing names it url or ufsUrl) */
async function storedUrl(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  const item = Array.isArray(body) ? body[0] : (body as { data?: unknown } | null)?.data ?? body;
  const record = (Array.isArray(item) ? item[0] : item) as Record<string, unknown> | null;
  const url = record?.ufsUrl ?? record?.url ?? record?.fileUrl;
  return typeof url === 'string' ? url : null;
}

/**
 * Sends an image the api way: media/upload-url/ (signed-in users) → the file to upload_url with
 * the given fields → media/confirm-upload/. Resolves with the public url of the image.
 * The storage step depends on the UploadThing setup of the api: it throws a readable message
 * when the storage does not answer an url.
 */
export function useImageUpload() {
  const [requestUploadUrl] = useRequestUploadUrlMutation();
  const [confirmUpload] = useConfirmUploadMutation();

  return async (file: File, purpose: ImagePurpose): Promise<string> => {
    const invalid = checkImage(file, purpose);
    if (invalid) throw new Error(invalid);
    try {
      const target = await requestUploadUrl({ file_name: file.name, file_size: file.size, mime_type: file.type, purpose }).unwrap();
      const body = new FormData();
      Object.entries(target.fields).forEach(([key, value]) => body.append(key, value));
      body.append('file', file);
      const response = await fetch(target.upload_url, { method: 'POST', body });
      const url = response.ok ? await storedUrl(response) : null;
      if (!url) throw new Error('storage');
      const asset = await confirmUpload({ file_key: target.file_key, file_url: url, file_size: file.size }).unwrap();
      return asset.file_url;
    } catch (error) {
      // Api refusal (plain RTK error): its message; storage or network failure: a generic one
      if (!(error instanceof Error)) throw new Error(parseApiError(error).message);
      throw new Error("L'envoi de l'image a échoué. Réessayez, ou collez plutôt un lien vers l'image.");
    }
  };
}
