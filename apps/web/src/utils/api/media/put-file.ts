/**
 * Sends a file to a presigned url (Mux direct upload) with its progress, 0 to 100. XMLHttpRequest,
 * not fetch: only it reports the upload progress. `signal` aborts it (the attachment removed).
 */
export function putFile(url: string, file: File, onProgress: (percent: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Envoi refusé (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Envoi interrompu : vérifiez votre connexion.'));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(file);
  });
}
