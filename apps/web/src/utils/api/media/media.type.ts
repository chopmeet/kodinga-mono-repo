// Media (apps/media): direct upload of files (UploadThing), in three steps.

export type MediaPurpose = 'avatar' | 'banner' | 'post_attachment' | 'lesson_attachment' | 'document' | 'general';

/** POST media/upload-url/ */
export type UploadUrlRequest = { file_name: string; file_size: number; mime_type: string; purpose: MediaPurpose };

/** Answer of media/upload-url/: where to send the file, with the form fields to join */
export type UploadTarget = {
  asset_id: string;
  file_key: string;
  upload_url: string;
  method?: string;
  fields: Record<string, string>;
  max_file_size: number;
};

/** MediaAssetSerializer (answer of media/confirm-upload/) */
export type MediaAsset = {
  id: string;
  file_name: string;
  file_key: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  purpose: MediaPurpose;
  status: string;
};

/** Same limits as the api (UploadThingService.ALLOWED_MIME_TYPES / MAX_FILE_SIZES) */
export const IMAGE_RULES: Record<'avatar' | 'banner', { types: string[]; maxBytes: number }> = {
  avatar: { types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], maxBytes: 1 * 1024 * 1024 },
  banner: { types: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 5 * 1024 * 1024 },
};
