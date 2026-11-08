import { useState } from 'react';

import { customToast } from '@kodinga/ui';
import { useAttachEventReplayMutation, useCreateVideoUploadMutation } from '@/utils/api/community/community.api';
import type { CommunityEvent } from '@/utils/api/event/event.type';
import { parseApiError } from '@/utils/api/errors';
import { isPlatformUrl } from '@/utils/Utils';

export const REPLAY_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const REPLAY_MAX_GB = 5;

/** Error of a replay file, or null */
export function checkReplay(file: File) {
  if (!REPLAY_TYPES.includes(file.type)) return 'Format non pris en charge : MP4, WebM ou MOV.';
  if (file.size > REPLAY_MAX_GB * 1024 ** 3) return `Vidéo trop lourde : ${REPLAY_MAX_GB} Go au maximum.`;
  return null;
}

/** PUT of the file to the direct upload url of Mux, with its progress (fetch has none) */
function putToMux(url: string, file: File, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(String(xhr.status))));
    xhr.onerror = () => reject(new Error('network'));
    xhr.send(file);
  });
}

/**
 * Replay of a finished event, by its team: a video is created on the api (media/videos/upload-url/),
 * the file goes straight to Mux, then the video is attached to the event (events/<id>/replay/).
 * Mux encodes it afterwards: the event shows "en préparation" until it is ready.
 */
function UseEventReplay(slug: string, event: CommunityEvent | undefined) {
  const [createUpload] = useCreateVideoUploadMutation();
  const [attach] = useAttachEventReplayMutation();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** A public video file: played as it is (a link to a platform would not play in the replay player) */
  const attachLink = async (url: string) => {
    if (!event) return false;
    const link = url.trim();
    const invalid = !/^https:\/\/\S+\.\S+/.test(link)
      ? 'Lien invalide : il doit commencer par https://'
      : isPlatformUrl(link)
        ? 'Le replay se lit depuis un fichier vidéo : donnez le lien direct (.mp4, .webm…), pas YouTube ni Vimeo.'
        : null;
    setError(invalid);
    if (invalid) return false;
    try {
      await attach({ slug, eventId: event.id, video_url: link }).unwrap();
      customToast.success({ message: 'Replay ajouté depuis le lien.' });
      return true;
    } catch (err) {
      setError(parseApiError(err).message);
      return false;
    }
  };

  const uploadToUploadThing = async (file: File | Blob) => {
    if (!event) return;
    if (file instanceof File) {
      const invalid = checkReplay(file);
      setError(invalid);
      if (invalid) return;
    }
    setProgress(30);
    try {
      setProgress(60);
      await attach({ slug, eventId: event.id, file }).unwrap();
      setProgress(100);
      customToast.success({ message: 'Replay enregistré et disponible !' });
    } catch (err) {
      const message = err instanceof Error ? err.message : parseApiError(err).message;
      setError(message);
      customToast.error({ message: `L’ajout du replay a échoué : ${message}` });
      throw err;
    } finally {
      setProgress(null);
    }
  };

  const upload = async (file: File) => {
    if (!event) return;
    const invalid = checkReplay(file);
    setError(invalid);
    if (invalid) return;
    setProgress(0);
    try {
      try {
        const target = await createUpload({ title: `${event.title} (replay)`, cors_origin: window.location.origin }).unwrap();
        await putToMux(target.upload_url, file, setProgress);
        await attach({ slug, eventId: event.id, video_asset_id: target.video_asset_id }).unwrap();
        customToast.success({ message: 'Replay ajouté : il sera visible sous peu.' });
      } catch {
        // Fallback or default directly to UploadThing permanent storage
        await uploadToUploadThing(file);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'L’ajout du replay a échoué.';
      setError(message);
      customToast.error({ message });
    } finally {
      setProgress(null);
    }
  };

  return { 
    upload, 
    uploadToUploadThing,
    attachLink,
    progress, 
    isUploading: progress !== null, 
    error 
  };
}

export type EventReplay = ReturnType<typeof UseEventReplay>;

export default UseEventReplay;
