import { useAppSelector } from '@/redux/hook';
import { dateFormat, numberFormat, relativeFormat } from './format';
import i18n from './i18n';
import { translatedLabels } from './translated';
import type { User } from './api/user/user.type';
import { useConfirmUploadMutation, useRequestUploadUrlMutation } from './api/community/community.api';
import { parseApiError } from './api/errors';
import { IMAGE_RULES } from './api/media/media.type';
import type { MemberRole, MemberStatus, PostType } from '@/data/admin-community-details.data';
import type { BillingInterval, PaymentStatus, PayoutMethod, PayoutStatus, SubscriptionStatus } from './api/billing/billing.type';
import type { AvailabilityStatus, EmploymentType, SkillLevel } from './api/profile/profile.type';

/** The api does not expose roles yet (see User.is_staff) */
export const isAdmin = (user?: User | null) => !!user?.is_superadmin || !!user?.is_superuser;

export const useUser = () => useAppSelector((s) => s.user.user);

/** Anyone the api names: a user, an author, an applicant, a team member... */
type Named = { full_name?: string | null; first_name?: string | null; last_name?: string | null; username?: string | null };

/** "Awa Ndiaye": the full name, else first and last name, else the username */
export const getName = (user?: Named | null) =>
  user?.full_name?.trim() ||
  [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
  user?.username ||
  '';

export function nameInitials(name = '', fallback = '?'): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const getInitials = (user?: User | null) => nameInitials(getName(user));

/** Builds `path/?a=1&b=2`, skipping empty values. */
export const QueryUrl = (path: string, query: object = {}) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  });
  const qs = params.toString();
  return qs ? `${path}/?${qs}` : `${path}/`;
};

/** 5800 → "5,8 k" (fr) / "5.8K" (en) */
export const formatCompact = (value: number) => numberFormat({ notation: 'compact', maximumFractionDigits: 1 }).format(value);

/** Smooth-scrolls to the home results (the sticky filters strip sits on top of the grid). */
export const scrollToResults = () =>
  document.getElementById('grille-communautes')?.scrollIntoView({ behavior: 'smooth' });

/** "Dakar DevOps & Cloud" -> "dakar-devops-cloud" (same rule as Django's slugify, accents dropped) */
export const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 160);

/** Builds a CSV (";" separator and BOM, so Excel in French opens it with accents) and downloads it */
/** Saves a text as a file of the device (a click on a temporary link) */
export function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const escape = (value: string | number) => {
    const text = String(value);
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = '﻿' + [header, ...rows].map((row) => row.map(escape).join(';')).join('\n');
  downloadText(filename, csv, 'text/csv;charset=utf-8');
}

/** "Il y a 2 h", "Hier", then the date (in the current language) */
export function ago(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return i18n.t('common.time.now');
  if (minutes < 60) return i18n.t('common.time.minutesAgo', { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return i18n.t('common.time.hoursAgo', { count: hours });
  const days = Math.round(hours / 24);
  if (days < 7) return relativeFormat({ numeric: 'auto' }).format(-days, 'day').replace(/^./, (c) => c.toUpperCase());
  return dateFormat({ day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

/** Plain text of a Markdown post or comment */
/**
 * Text with `insert` put at the caret of `el` (replacing the selection), and where the caret goes
 * after it; at the end when the field is unknown. For emojis, which are several code units.
 */
export function insertAtCursor(el: HTMLInputElement | HTMLTextAreaElement | null, value: string, insert: string) {
  const start = el?.selectionStart ?? value.length;
  const end = el?.selectionEnd ?? start;
  return { value: value.slice(0, start) + insert + value.slice(end), caret: start + insert.length };
}

export const plain = (content: string) => content.replace(/[#*_`>[\]]/g, '').replace(/[ \t]+/g, ' ').trim();

/** /communities/<slug>/posts/<id> */
export const postHref = (slug: string, postId: string) => `/communities/${slug}/posts/${postId}`;

// Images sent to the storage of the api (UploadThing)

export type ImagePurpose = keyof typeof IMAGE_RULES;

const MB = 1024 * 1024;

/** Message when the file breaks the rules of the api, null when it is fine */
export function checkImage(file: File, purpose: ImagePurpose): string | null {
  const rules = IMAGE_RULES[purpose];
  if (!rules.types.includes(file.type)) {
    const formats = rules.types.map((t) => t.replace('image/', '').toUpperCase().replace('JPEG', 'JPG')).join(', ');
    return i18n.t('common.image.badFormat', { formats });
  }
  if (file.size > rules.maxBytes) return i18n.t('common.image.tooHeavy', { max: rules.maxBytes / MB });
  return null;
}

export type CompressOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
};

/**
 * Compresses and resizes an image client-side using HTML5 Canvas.
 * Drastically reduces payload size (e.g. 5-10 MB raw phone photo -> ~100-300 KB) and upload time.
 * Leaves SVG, GIF (animated) and already small files (< 150 KB) untouched.
 */
export async function compressImage(file: File, options: CompressOptions = {}): Promise<File> {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    file.type === 'image/svg+xml' ||
    file.type === 'image/gif' ||
    file.size < 150 * 1024
  ) {
    return file;
  }

  const maxWidth = options.maxWidth ?? 1600;
  const maxHeight = options.maxHeight ?? 1600;
  const quality = options.quality ?? 0.82;

  return new Promise((resolve) => {
    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        try {
          let { width, height } = img;
          if (width <= 0 || height <= 0) {
            resolve(file);
            return;
          }

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            resolve(file);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          canvas.toBlob(
            (blob) => {
              if (!blob || blob.size >= file.size) {
                resolve(file);
                return;
              }
              const optimized = new File([blob], file.name, {
                type: blob.type || mimeType,
                lastModified: Date.now(),
              });
              resolve(optimized);
            },
            mimeType,
            quality
          );
        } catch {
          resolve(file);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };

      img.src = objectUrl;
    } catch {
      resolve(file);
    }
  });
}

/** Url of the stored file in the answer of the storage (UploadThing names it url or ufsUrl) */
async function storedUrl(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  const item = Array.isArray(body) ? body[0] : (body as { data?: unknown } | null)?.data ?? body;
  const record = (Array.isArray(item) ? item[0] : item) as Record<string, unknown> | null;
  const url = record?.ufsUrl ?? record?.url ?? record?.fileUrl;
  return typeof url === 'string' ? url : null;
}

/** A video link played by its platform (YouTube, Vimeo, Dailymotion), not a video file */
export const isPlatformUrl = (url: string) => /(youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com|dailymotion\.com|dai\.ly)/i.test(url);

/** Upload with progress (fetch does not report the upload): an XMLHttpRequest, answered as a Response */
function sendWithProgress(url: string, method: string, body: FormData, onProgress: (percent: number) => void): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    // No body for the statuses that cannot have one
    xhr.onload = () => resolve(new Response([204, 205, 304].includes(xhr.status) ? null : xhr.responseText, { status: xhr.status }));
    xhr.onerror = () => reject(new Error('network'));
    xhr.send(body);
  });
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

  /** onProgress: 0 to 100 while the file is sent to the storage */
  return async (file: File, purpose: ImagePurpose, onProgress?: (percent: number) => void): Promise<string> => {
    const invalid = checkImage(file, purpose);
    if (invalid) throw new Error(invalid);
    try {
      // 1. Client-side compression / downscaling for fast network transfer
      const compressOpts: CompressOptions =
        purpose === 'avatar'
          ? { maxWidth: 512, maxHeight: 512, quality: 0.85 }
          : { maxWidth: 1600, maxHeight: 900, quality: 0.85 };
      const readyFile = await compressImage(file, compressOpts);

      const target = await requestUploadUrl({
        file_name: readyFile.name,
        file_size: readyFile.size,
        mime_type: readyFile.type,
        purpose,
      }).unwrap();

      const body = new FormData();
      if (target.fields) {
        Object.entries(target.fields).forEach(([key, value]) => body.append(key, value));
      }
      // UploadThing v7 ingestion expects 'files', standard S3/mocks expect 'file'
      body.append('file', readyFile);
      body.append('files', readyFile);

      const method = (target.method || (target.upload_url.includes('ingest.uploadthing.com') ? 'PUT' : 'POST')).toUpperCase();
      const response = onProgress ? await sendWithProgress(target.upload_url, method, body, onProgress) : await fetch(target.upload_url, { method, body });
      const url = response.ok ? await storedUrl(response) : null;
      if (!url) {
        console.error('Storage upload failed with status:', response.status);
        throw new Error('storage');
      }
      const asset = await confirmUpload({ file_key: target.file_key, file_url: url, file_size: readyFile.size }).unwrap();
      return asset.file_url;
    } catch (error) {
      console.error('Image upload failed:', error);
      // Api refusal (plain RTK error): its message; storage or network failure: a generic one
      if (!(error instanceof Error)) throw new Error(parseApiError(error).message);
      throw new Error("L'envoi de l'image a échoué. Réessayez, ou collez plutôt un lien vers l'image.");
    }
  };
}

// Labels of the communities, shared by the admin community details and the community space (/c/:slug)

export const memberRoleLabel = translatedLabels<MemberRole>('labels.memberRole.', ['owner', 'admin', 'moderator', 'member']);

export const memberStatusStyle: Record<MemberStatus, { label: string; className: string }> = {
  active: { label: 'Actif', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  pending: { label: 'En attente', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  suspended: { label: 'Suspendu', className: 'border-orange-200 bg-orange-50 text-orange-800' },
  banned: { label: 'Banni', className: 'border-red-200 bg-red-50 text-red-700' },
  rejected: { label: 'Refusé', className: 'border-slate-200 bg-slate-50 text-slate-600' },
  left: { label: 'Parti', className: 'border-slate-200 bg-slate-50 text-slate-600' },
};

export const postTypeLabel = translatedLabels<PostType>('labels.postType.', ['discussion', 'question', 'project_showcase', 'poll', 'announcement']);

export const paymentStatusStyle: Record<PaymentStatus, { label: string; className: string }> = {
  PAID: { label: 'Payé', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  PENDING: { label: 'En attente', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  PROCESSING: { label: 'En cours', className: 'border-sky-200 bg-sky-50 text-sky-800' },
  FAILED: { label: 'Échec', className: 'border-red-200 bg-red-50 text-red-700' },
  CANCELLED: { label: 'Annulé', className: 'border-slate-200 bg-slate-50 text-slate-600' },
};

export const subscriptionStatusStyle: Record<SubscriptionStatus, { label: string; className: string }> = {
  active: { label: 'Actif', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  trialing: { label: 'Essai', className: 'border-sky-200 bg-sky-50 text-sky-800' },
  past_due: { label: 'Impayé', className: 'border-red-200 bg-red-50 text-red-700' },
  canceled: { label: 'Résilié', className: 'border-slate-200 bg-slate-50 text-slate-600' },
  expired: { label: 'Expiré', className: 'border-slate-200 bg-slate-50 text-slate-600' },
};

export const payoutStatusStyle: Record<PayoutStatus, { label: string; className: string }> = {
  pending: { label: 'En attente', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  approved: { label: 'Approuvé', className: 'border-sky-200 bg-sky-50 text-sky-800' },
  processed: { label: 'Versé', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  rejected: { label: 'Refusé', className: 'border-red-200 bg-red-50 text-red-700' },
};

export const payoutMethodLabel: Record<PayoutMethod, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  bank_transfer: 'Virement bancaire',
};

/** "Mensuel" + "/ mois": label and price suffix of each interval, in the current language */
export const intervalLabel = Object.fromEntries(
  (['month', 'year', 'one_time'] as const).map((id) => [
    id,
    {
      get label() {
        return i18n.t(`labels.billingInterval.${id}`);
      },
      get suffix() {
        return i18n.t(`labels.billingSuffix.${id}`);
      },
    },
  ]),
) as Record<BillingInterval, { label: string; suffix: string }>;

/** "2026-11": the month of a date (local time, like monthly_revenue[].month), this month by default */
export const monthKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export const xof = (value: number) => `${numberFormat().format(value)} FCFA`;

type Priced = { price: string | number; billing_interval: BillingInterval };

/** "Annuel"; a Kodinga Pro bought once reads "À vie" (a community plan: "Paiement unique") */
export const periodLabel = (interval: BillingInterval, pro = false) =>
  pro && interval === 'one_time' ? i18n.t('labels.proLifetime.label') : intervalLabel[interval].label;

/** "/ an"; a Kodinga Pro bought once reads "à vie" (a community plan: "une fois") */
export const periodSuffix = (interval: BillingInterval, pro = false) =>
  pro && interval === 'one_time' ? i18n.t('labels.proLifetime.suffix') : intervalLabel[interval].suffix;

/** "5 000 FCFA / mois" (the price as the api sends it: "5000.00") */
export const planPrice = (plan: Priced, pro = false) => `${xof(Number(plan.price))} ${periodSuffix(plan.billing_interval, pro)}`;

/** FCFA as usual, any other currency with its code (amounts arrive as strings: "15000.00") */
export const amountOf = (value: string, currency: string) => (currency === 'XOF' ? xof(Number(value)) : `${numberFormat().format(Number(value))} ${currency}`);

// Labels of the developer profile, shared by /dashboard/profile and the public profile
// Texts in locales/*/labels.ts, read in the current language
export const availabilityLabel = translatedLabels<AvailabilityStatus>('labels.availability.', ['available', 'open_to_offers', 'busy', 'unavailable']);

export const skillLevelLabel = translatedLabels<SkillLevel>('labels.skillLevel.', ['beginner', 'intermediate', 'advanced', 'expert']);

export const employmentLabel = translatedLabels<EmploymentType>('labels.employment.', [
  'full_time',
  'part_time',
  'freelance',
  'contract',
  'internship',
  'apprenticeship',
]);

/** "mars 2022 – aujourd’hui" */
export function period(start: string, end: string | null, current: boolean) {
  const monthYear = dateFormat({ month: 'short', year: 'numeric' });
  const from = monthYear.format(new Date(start));
  return `${from} – ${current || !end ? i18n.t('common.time.today') : monthYear.format(new Date(end))}`;
}
