import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { useAppDispatch, useAppSelector } from '@/redux/hook';
import { onSetUserToken } from '@/redux/slice/User.slice';
import { suggestUsername } from '@/pages/auth/hooks/UseRegisterForm';
import { useLoginUserMutation, useRegisterUserMutation } from '@/utils/api/auth/auth.api';
import { useCreateCommunityMutation } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import { useImageUpload } from '@/utils/api/media/useImageUpload';
import { slugify } from '@/utils/Utils';
import { type ImageSource, useFilePreview } from '../components/image-field';


const optionalImageUrl = z
  .string()
  .trim()
  .max(500, '500 caractères maximum')
  .refine((v) => !v || /^https:\/\/\S+\.\S+/.test(v), 'Lien invalide : collez une adresse https://…');

const communitySchema = z.object({
  name: z.string().trim().min(3, 'Au moins 3 caractères').max(150, '150 caractères maximum'),
  /** Empty until the user edits the address: the one built from the name is sent then */
  slug: z
    .string()
    .trim()
    .refine((v) => !v || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v), 'Lettres minuscules, chiffres et tirets uniquement')
    .refine((v) => !v || v.length >= 3, 'Au moins 3 caractères'),
  tagline: z.string().trim().max(255, '255 caractères maximum'),
  category_id: z.string(),
  privacy_type: z.enum(['public', 'private', 'secret']),
  pricing_type: z.enum(['free', 'paid']),
  brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide'),
  /** Url mode of the logo / banner (file mode: the files live in UseCreateCommunity, sent at the end) */
  avatar_url: optionalImageUrl,
  banner_url: optionalImageUrl,
});

export type CommunityValues = z.infer<typeof communitySchema>;

const accountSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('register'),
    first_name: z.string().trim().min(1, 'Saisissez votre prénom'),
    last_name: z.string().trim().min(1, 'Saisissez votre nom'),
    email: z.string().trim().min(1, 'Saisissez votre email').email('Adresse email invalide'),
    password: z
      .string()
      .min(8, 'Au moins 8 caractères')
      .refine((v) => !/^\d+$/.test(v), 'Le mot de passe ne peut pas contenir uniquement des chiffres'),
    terms_accepted: z.boolean().refine((v) => v, "Acceptez les conditions d'utilisation pour continuer"),
  }),
  z.object({
    mode: z.literal('login'),
    email: z.string().trim().min(1, 'Saisissez votre email').email('Adresse email invalide'),
    password: z.string().min(1, 'Saisissez votre mot de passe'),
  }),
]);

export type AccountValues = z.input<typeof accountSchema>;

export const STEPS = [
  { id: 'name', label: 'Nom' },
  { id: 'topic', label: 'Thème' },
  { id: 'access', label: 'Accès' },
  { id: 'look', label: 'Identité' },
  { id: 'account', label: 'Compte' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];

const STEP_FIELDS: Record<Exclude<StepId, 'account'>, (keyof CommunityValues)[]> = {
  name: ['name', 'slug'],
  topic: ['tagline', 'category_id'],
  access: ['privacy_type', 'pricing_type'],
  look: ['brand_color', 'avatar_url', 'banner_url'],
};

export const BRAND_COLORS = ['#1D4ED8', '#7C3AED', '#DB2777', '#DC2626', '#EA580C', '#CA8A04', '#16A34A', '#0D9488', '#0F172A'];

const DEFAULTS: CommunityValues = {
  name: '',
  slug: '',
  tagline: '',
  category_id: '',
  privacy_type: 'public',
  pricing_type: 'free',
  brand_color: BRAND_COLORS[0],
  avatar_url: '',
  banner_url: '',
};

// The draft survives a reload or a detour (sessionStorage: this tab only, never the password)
const DRAFT_KEY = 'create_community_draft';
type Draft = { values: CommunityValues; step: number; slugEdited: boolean };

function readDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function writeDraft(draft: Draft | null) {
  try {
    if (draft) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage blocked: the flow still works, without the draft
  }
}

const COMMUNITY_FIELDS = Object.values(STEP_FIELDS).flat();

/** Logo and banner: their form field (url mode) and the upload purpose of the api */
const IMAGES = { avatar: 'avatar_url', banner: 'banner_url' } as const;
type ImageKind = keyof typeof IMAGES;
type ImageState = { source: ImageSource; file: File | null };
const ACCOUNT_FIELDS = ['first_name', 'last_name', 'email', 'password', 'terms_accepted'] as const;

function UseCreateCommunity() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { i18n } = useTranslation();
  const token = useAppSelector((s) => s.user.token);
  const [createCommunity] = useCreateCommunityMutation();
  const [registerUser] = useRegisterUserMutation();
  const [loginUser] = useLoginUserMutation();

  const draft = useMemo(readDraft, []);
  const [stepIndex, setStepIndex] = useState(draft?.step ?? 0);
  const [slugEdited, setSlugEdited] = useState(draft?.slugEdited ?? false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Files are not kept in the draft (sessionStorage): a link from the draft opens in url mode
  const [images, setImages] = useState<Record<ImageKind, ImageState>>({
    avatar: { source: draft?.values?.avatar_url ? 'url' : 'file', file: null },
    banner: { source: draft?.values?.banner_url ? 'url' : 'file', file: null },
  });
  const uploadImage = useImageUpload();

  // Signed-in visitors skip the account step
  const steps = useMemo(() => (token ? STEPS.filter((s) => s.id !== 'account') : [...STEPS]), [token]);
  const index = Math.min(stepIndex, steps.length - 1);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  const form = useForm<CommunityValues>({
    resolver: zodResolver(communitySchema),
    defaultValues: { ...DEFAULTS, ...draft?.values },
  });
  const account = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { mode: 'register', first_name: '', last_name: '', email: '', password: '', terms_accepted: false },
  });

  const values = form.watch();
  const slug = slugEdited ? values.slug : slugify(values.name);
  const avatarFile = useFilePreview(images.avatar.file);
  const bannerFile = useFilePreview(images.banner.file);
  /** What the preview shows: the chosen file, or the link */
  const previews = {
    avatar: images.avatar.source === 'file' ? avatarFile : values.avatar_url.trim() || null,
    banner: images.banner.source === 'file' ? bannerFile : values.banner_url.trim() || null,
  };

  const setImage = (kind: ImageKind, changes: Partial<ImageState>) => {
    setImages((current) => ({ ...current, [kind]: { ...current[kind], ...changes } }));
    form.clearErrors(IMAGES[kind]);
  };

  /** Fields to check on a step: a link is only checked in url mode */
  const fieldsOf = (id: keyof typeof STEP_FIELDS) =>
    STEP_FIELDS[id].filter((f) => !(Object.keys(IMAGES) as ImageKind[]).some((k) => IMAGES[k] === f && images[k].source === 'file'));

  /** Url of each image: the link, or the chosen file once sent (null when there is none) */
  const resolveImages = async (v: CommunityValues): Promise<Record<ImageKind, string | null> | null> => {
    const result: Record<ImageKind, string | null> = { avatar: null, banner: null };
    for (const kind of Object.keys(IMAGES) as ImageKind[]) {
      const { source, file } = images[kind];
      if (source === 'url') {
        result[kind] = v[IMAGES[kind]] || null;
        continue;
      }
      if (!file) continue;
      try {
        result[kind] = await uploadImage(file, kind);
      } catch (error) {
        form.setError(IMAGES[kind], { message: error instanceof Error ? error.message : "L'envoi de l'image a échoué." });
        goTo('look');
        return null;
      }
    }
    return result;
  };

  useEffect(() => {
    writeDraft({ values, step: index, slugEdited });
  }, [values, index, slugEdited]);

  const goTo = (id: StepId) => {
    const target = steps.findIndex((s) => s.id === id);
    if (target >= 0) setStepIndex(target);
  };

  const back = () => setStepIndex(Math.max(0, index - 1));

  /** Signs up (or in) inside the flow: register, then login with the same credentials */
  const signIn = async (): Promise<boolean> => {
    const ok = await account.trigger();
    if (!ok) return false;
    const data = account.getValues();
    const email = data.email.trim().toLowerCase();
    try {
      if (data.mode === 'register') {
        const base = suggestUsername(data.first_name ?? '', data.last_name ?? '') || email.split('@')[0];
        const payload = {
          email,
          password: data.password,
          first_name: (data.first_name ?? '').trim(),
          last_name: (data.last_name ?? '').trim(),
          preferred_language: i18n.language?.startsWith('en') ? 'en' : 'fr',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          terms_accepted: true,
        };
        try {
          await registerUser({ ...payload, username: base }).unwrap();
        } catch (error) {
          // Username taken: one retry with a short suffix (it can be changed later in the profile)
          if (!parseApiError(error).fields.username) throw error;
          await registerUser({ ...payload, username: `${base.slice(0, 44)}_${Math.floor(1000 + Math.random() * 9000)}` }).unwrap();
        }
      }
      const result = await loginUser({ email, password: data.password }).unwrap();
      dispatch(onSetUserToken({ user: result.user, token: result.access, refresh: result.refresh }));
      return true;
    } catch (error) {
      const { message, fields } = parseApiError(error);
      let onField = false;
      for (const field of ACCOUNT_FIELDS) {
        if (fields[field]) {
          account.setError(field, { message: fields[field] });
          onField = true;
        }
      }
      if (!onField) setFormError(message);
      return false;
    }
  };

  const create = async () => {
    const v = form.getValues();
    // After the account step: the upload api needs a signed-in user
    const urls = await resolveImages(v);
    if (!urls) return;
    try {
      const community = await createCommunity({
        name: v.name.trim(),
        // Always sent: the api requires it (ModelSerializer on a non-blank SlugField), the preview shows this one
        slug: (slugEdited && v.slug) || slugify(v.name),
        tagline: v.tagline.trim(),
        category_id: v.category_id || null,
        privacy_type: v.privacy_type,
        pricing_type: v.pricing_type,
        brand_color: v.brand_color,
        ...(urls.avatar ? { avatar_url: urls.avatar } : {}),
        ...(urls.banner ? { banner_url: urls.banner } : {}),
        // Private and secret communities review the join requests
        settings: { require_approval_to_join: v.privacy_type !== 'public' },
      }).unwrap();
      writeDraft(null);
      navigate(`/c/${community.slug}/dashboard?welcome=1`, { replace: true });
    } catch (error) {
      const { message, fields } = parseApiError(error);
      // Bring the user back to the step of the faulty field
      const field = COMMUNITY_FIELDS.find((f) => fields[f]) ?? (fields.category ? 'category_id' : undefined);
      if (field) {
        if (field === 'slug') {
          // Taken address: show the generated one, editable, so the user only adjusts it
          if (!slugEdited) form.setValue('slug', slugify(v.name));
          setSlugEdited(true);
        }
        form.setError(field, { message: fields[field] ?? fields.category });
        const owner = (Object.keys(STEP_FIELDS) as (keyof typeof STEP_FIELDS)[]).find((s) => STEP_FIELDS[s].includes(field));
        if (owner) goTo(owner);
      } else {
        setFormError(message);
      }
    }
  };

  const next = async () => {
    setFormError(null);
    if (step.id !== 'account') {
      const ok = await form.trigger(fieldsOf(step.id));
      if (!ok) return;
    }
    if (!isLast) {
      setStepIndex(index + 1);
      return;
    }
    setIsSubmitting(true);
    try {
      if (!token && !(await signIn())) return;
      await create();
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    form,
    account,
    values,
    slug,
    images,
    setImage,
    previews,
    slugEdited,
    editSlug: () => {
      form.setValue('slug', slug);
      setSlugEdited(true);
    },
    steps,
    step,
    index,
    isLast,
    next,
    back,
    isSubmitting,
    formError,
  };
}

export type CreateCommunityFlow = ReturnType<typeof UseCreateCommunity>;

export default UseCreateCommunity;
