import { USER_STORAGE_KEY } from '@/redux/slice/User.slice';
import { ApiBaseUrl } from '@/utils/http';
import { AppStorage } from '@/utils/storage';
import type { AuthState } from '../user/user.type';

export type UploadedFileResult = {
  asset_id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
};

/**
 * Uploads a single image or document to /api/v1/media/upload/ with progress reporting (0 to 100).
 * Uses XMLHttpRequest so `upload.onprogress` delivers live percentage updates to the UI.
 * Falls back to globalThis.fetch when XMLHttpRequest is not available (e.g. test stubs).
 */
export function uploadFileWithProgress({
  file,
  purpose,
  onProgress,
  signal,
}: {
  file: File;
  purpose: 'post_image' | 'post_document';
  onProgress: (percent: number) => void;
  signal?: AbortSignal;
}): Promise<UploadedFileResult> {
  const token = AppStorage.getItem<AuthState>(USER_STORAGE_KEY)?.token;
  const url = `${ApiBaseUrl.replace(/\/?$/, '/')}media/upload/`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('purpose', purpose);

  // If XMLHttpRequest upload is available and signal not already aborted
  if (typeof XMLHttpRequest !== 'undefined') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);

      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) {
          const percent = Math.min(100, Math.round((e.loaded / e.total) * 100));
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const json = JSON.parse(xhr.responseText);
            const data = json.data ?? json;
            onProgress(100);
            resolve({
              asset_id: data.asset_id ?? data.id,
              file_url: data.file_url ?? data.url,
              file_name: data.file_name ?? file.name,
              file_size: data.file_size ?? file.size,
              mime_type: data.mime_type ?? file.type,
            });
          } catch {
            reject(new Error('Réponse invalide du serveur de médias.'));
          }
        } else {
          try {
            const json = JSON.parse(xhr.responseText);
            reject(new Error(json.message ?? `Échec du téléversement (${xhr.status}).`));
          } catch {
            reject(new Error(`Échec du téléversement (${xhr.status}).`));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Téléversement interrompu : vérifiez votre connexion réseau.'));
      xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));

      if (signal) {
        if (signal.aborted) {
          xhr.abort();
          return;
        }
        signal.addEventListener('abort', () => xhr.abort());
      }

      xhr.send(formData);
    });
  }

  // Fallback to fetch (e.g. test environments where XMLHttpRequest is stubbed via fetch)
  onProgress(20);
  return fetch(url, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
    signal,
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Échec du téléversement (${res.status}).`);
      const json = await res.json();
      const data = json.data ?? json;
      onProgress(100);
      return {
        asset_id: data.asset_id ?? data.id,
        file_url: data.file_url ?? data.url,
        file_name: data.file_name ?? file.name,
        file_size: data.file_size ?? file.size,
        mime_type: data.mime_type ?? file.type,
      };
    });
}
