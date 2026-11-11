import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import type { User } from '@/utils/api/user/user.type';
import { slugify, useImageUpload } from '@/utils/Utils';
import i18n from '@/utils/i18n';
import { numberFormat } from '@/utils/format';
import { type ImageSource, useFilePreview } from '../components/image-field';
import UseProChoice from './UseProChoice';


// Schemas built when the flow opens: their messages follow the current language
const tr = (key: string, options?: Record<string, unknown>) => (i18n.t as (k: string, o?: Record<string, unknown>) => string)(`create.validation.${key}`, options);

const optionalImageUrl = () =>
  z
    .string()
    .trim()
    .max(500, tr('max500'))
    .refine((v) => !v || /^https:\/\/\S+\.\S+/.test(v), tr('httpsLink'));

/** Lowest membership price the api accepts (CommunityCreateUpdateSerializer) */
export const MIN_MEMBERSHIP_PRICE = 500;

const communitySchema = () => z
  .object({
  name: z.string().trim().min(3, tr('min3')).max(150, tr('max150')),
  /** Empty until the user edits the address: the one built from the name is sent then */
  slug: z
    .string()
    .trim()
    .refine((v) => !v || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v), tr('slugChars'))
    .refine((v) => !v || v.length >= 3, tr('min3')),
  tagline: z.string().trim().max(255, tr('max255')),
  category_id: z.string(),
  privacy_type: z.enum(['public', 'private', 'secret']),
  pricing_type: z.enum(['free', 'paid']),
  brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, tr('color')),
  /** Url mode of the logo / banner (file mode: the files live in UseCreateCommunity, sent at the end) */
  avatar_url: optionalImageUrl(),
  banner_url: optionalImageUrl(),
  /** Paid community: its first plan, created by the api with the community (more in /c/<slug>/payments) */
  membership_price: z.string().trim(),
  membership_interval: z.enum(['month', 'year', 'one_time']),
  membership_plan_name: z.string().trim().max(120, tr('max120')),
  /** Plan chooser (over the flow): free, or Kodinga Pro paid before the steps (with the Pro plan chosen) */
  formula: z.enum(['free', 'pro']),
  pro_plan_id: z.string(),
})
  .superRefine((v, ctx) => {
    if (v.formula === 'pro' && !v.pro_plan_id) ctx.addIssue({ code: 'custom', path: ['pro_plan_id'], message: tr('proPlan') });
    if (v.pricing_type !== 'paid') return;
    const price = Number(v.membership_price);
    if (!v.membership_price || !Number.isInteger(price)) {
      ctx.addIssue({ code: 'custom', path: ['membership_price'], message: tr('price') });
    } else if (price < MIN_MEMBERSHIP_PRICE) {
      ctx.addIssue({ code: 'custom', path: ['membership_price'], message: tr('minPrice', { price: numberFormat().format(MIN_MEMBERSHIP_PRICE) }) });
    }
  });

export type CommunityValues = z.infer<ReturnType<typeof communitySchema>>;

// Same messages as the sign-up form (auth.validation)
const auth = (key: string) => (i18n.t as (k: string) => string)(`auth.validation.${key}`);
const accountSchema = () =>
  z.discriminatedUnion('mode', [
    z.object({
      mode: z.literal('register'),
      first_name: z.string().trim().min(1, auth('firstNameRequired')),
      last_name: z.string().trim().min(1, auth('lastNameRequired')),
      email: z.string().trim().min(1, auth('emailRequired')).email(auth('emailInvalid')),
      password: z
        .string()
        .min(8, auth('min8'))
        .refine((v) => !/^\d+$/.test(v), auth('passwordNumeric')),
      terms_accepted: z.boolean().refine((v) => v, auth('termsRequired')),
    }),
    z.object({
      mode: z.literal('login'),
      email: z.string().trim().min(1, auth('emailRequired')).email(auth('emailInvalid')),
      password: z.string().min(1, auth('passwordRequired')),
    }),
  ]);

export type AccountValues = z.input<ReturnType<typeof accountSchema>>;

// Labels: create.steps.<id>
export const STEPS = [{ id: 'name' }, { id: 'topic' }, { id: 'access' }, { id: 'look' }, { id: 'account' }] as const;

export type StepId = (typeof STEPS)[number]['id'];
type Step = (typeof STEPS)[number];
const stepOf = (id: StepId) => STEPS.find((s) => s.id === id) as Step;

const STEP_FIELDS: Record<Exclude<StepId, 'account'>, (keyof CommunityValues)[]> = {
  name: ['name', 'slug'],
  topic: ['tagline', 'category_id'],
  access: ['privacy_type', 'pricing_type', 'membership_price', 'membership_interval', 'membership_plan_name'],
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
  membership_price: '5000',
  membership_interval: 'month',
  membership_plan_name: '',
  formula: 'free',
  pro_plan_id: '',
};

// The draft survives a reload or a detour (sessionStorage: this tab only, never the password)
const DRAFT_KEY = 'create_community_draft';
/** planChosen: the plan chooser was answered (it opens again only from "Modifier") */
type Draft = { values: CommunityValues; step: StepId; slugEdited: boolean; planChosen?: boolean };

function readDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    const draft = raw ? (JSON.parse(raw) as Draft) : null;
    // Older drafts: the step kept by position, or the plan as a step
    return draft && (typeof draft.step !== 'string' || (draft.step as string) === 'plan') ? { ...draft, step: 'name' } : draft;
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
  const { i18n, t } = useTranslation();
  const token = useAppSelector((s) => s.user.token);
  const [createCommunity] = useCreateCommunityMutation();
  const [registerUser] = useRegisterUserMutation();
  const [loginUser] = useLoginUserMutation();

  const draft = useMemo(readDraft, []);
  const pro = UseProChoice();
  const [stepId, setStepId] = useState<StepId>(draft?.step ?? 'name');
  // The plan chooser opens on arrival (non-Pro), and again from "Modifier" or "Passer Pro"
  const [planChosen, setPlanChosen] = useState(draft?.planChosen ?? false);
  const [planOpen, setPlanOpen] = useState(!draft?.planChosen);
  // Paid community chosen, Pro not confirmed yet: offer to create it free for now
  const [proPending, setProPending] = useState(false);
  const [slugEdited, setSlugEdited] = useState(draft?.slugEdited ?? false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Files are not kept in the draft (sessionStorage): a link from the draft opens in url mode
  const [images, setImages] = useState<Record<ImageKind, ImageState>>({
    avatar: { source: draft?.values?.avatar_url ? 'url' : 'file', file: null },
    banner: { source: draft?.values?.banner_url ? 'url' : 'file', file: null },
  });
  const uploadImage = useImageUpload();

  const form = useForm<CommunityValues>({
    resolver: zodResolver(communitySchema()),
    defaultValues: { ...DEFAULTS, ...draft?.values },
  });
  const formula = form.watch('formula');

  /**
   * Choosing Pro (not Pro yet) asks the account first (paying needs one), then PayDunya, then the
   * other steps; free asks the account at the end. Signed-in users never see the account step.
   */
  const proPath = formula === 'pro' && !pro.isPro;
  // A Pro payment is on its way (back from PayDunya, not confirmed yet): never pay twice
  const paymentUnderway = pro.payment === 'checking' || pro.payment === 'pending';
  const steps = useMemo(() => {
    const ids: StepId[] = [
      ...(!token && proPath ? (['account'] as StepId[]) : []),
      'name',
      'topic',
      'access',
      'look',
      ...(!token && !proPath ? (['account'] as StepId[]) : []),
    ];
    return ids.map(stepOf);
  }, [pro.isPro, token, proPath]);
  const index = Math.max(0, steps.findIndex((s) => s.id === stepId));
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const setStepIndex = (i: number) => setStepId(steps[Math.min(Math.max(i, 0), steps.length - 1)].id);
  const account = useForm<AccountValues>({
    resolver: zodResolver(accountSchema()),
    defaultValues: { mode: 'register', first_name: '', last_name: '', email: '', password: '', terms_accepted: false },
  });

  const values = form.watch();
  // A paid community is private (rule of the api, applied silently there): said here at once
  useEffect(() => {
    if (values.pricing_type === 'paid' && values.privacy_type === 'public') form.setValue('privacy_type', 'private', { shouldDirty: true });
  }, [values.pricing_type, values.privacy_type, form]);
  const slug = slugEdited ? values.slug : slugify(values.name);
  const avatarFile = useFilePreview(images.avatar.file);
  const bannerFile = useFilePreview(images.banner.file);
  /** What the preview shows: the chosen file, or the link */
  const previews = {
    avatar: images.avatar.source === 'file' ? avatarFile : values.avatar_url.trim() || null,
    banner: images.banner.source === 'file' ? bannerFile : values.banner_url.trim() || null,
  };

  const [uploadedUrls, setUploadedUrls] = useState<Record<ImageKind, string | null>>({ avatar: null, banner: null });
  const [uploading, setUploading] = useState<Record<ImageKind, boolean>>({ avatar: false, banner: false });
  const pendingUploads = useRef<Record<ImageKind, Promise<string> | null>>({ avatar: null, banner: null });

  const triggerEarlyUpload = (kind: ImageKind, file: File) => {
    // If not authenticated yet, wait until sign-in at step 5
    if (!token) return;

    setUploading((prev) => ({ ...prev, [kind]: true }));
    const task = (async () => {
      try {
        const url = await uploadImage(file, kind);
        setUploadedUrls((prev) => ({ ...prev, [kind]: url }));
        return url;
      } catch (err) {
        console.warn(`[CreateCommunity] Early upload for ${kind} failed, will retry on submit:`, err);
        throw err;
      } finally {
        setUploading((prev) => ({ ...prev, [kind]: false }));
        pendingUploads.current[kind] = null;
      }
    })();
    pendingUploads.current[kind] = task;
  };

  const setImage = (kind: ImageKind, changes: Partial<ImageState>) => {
    setImages((current) => ({ ...current, [kind]: { ...current[kind], ...changes } }));
    form.clearErrors(IMAGES[kind]);

    if (changes.file) {
      setUploadedUrls((prev) => ({ ...prev, [kind]: null }));
      triggerEarlyUpload(kind, changes.file);
    } else if (changes.file === null || changes.source === 'url') {
      setUploadedUrls((prev) => ({ ...prev, [kind]: null }));
      pendingUploads.current[kind] = null;
      setUploading((prev) => ({ ...prev, [kind]: false }));
    }
  };

  /** Fields to check on a step: a link is only checked in url mode */
  const fieldsOf = (id: keyof typeof STEP_FIELDS) =>
    STEP_FIELDS[id].filter((f) => !(Object.keys(IMAGES) as ImageKind[]).some((k) => IMAGES[k] === f && images[k].source === 'file'));

  /** Url of each image: the link, or the chosen file once sent (null when there is none) */
  const resolveImages = async (v: CommunityValues): Promise<Record<ImageKind, string | null> | null> => {
    const result: Record<ImageKind, string | null> = { avatar: null, banner: null };

    // Parallel upload of both avatar and banner via Promise.all
    const uploadTasks = (Object.keys(IMAGES) as ImageKind[]).map(async (kind) => {
      const { source, file } = images[kind];
      if (source === 'url') {
        return { kind, url: v[IMAGES[kind]] || null };
      }
      if (!file) return { kind, url: null };

      // 1. If already pre-uploaded in the background, reuse immediately (0ms wait!)
      if (uploadedUrls[kind]) {
        return { kind, url: uploadedUrls[kind] };
      }

      // 2. If an early upload is currently in flight, await it
      const pending = pendingUploads.current[kind];
      if (pending) {
        try {
          const url = await pending;
          return { kind, url };
        } catch {
          // Fall through to retry upload below
        }
      }

      // 3. Otherwise, perform parallel upload now
      setUploading((prev) => ({ ...prev, [kind]: true }));
      try {
        const url = await uploadImage(file, kind);
        setUploadedUrls((prev) => ({ ...prev, [kind]: url }));
        return { kind, url };
      } catch (error) {
        form.setError(IMAGES[kind], { message: error instanceof Error ? error.message : tr('imageFailed') });
        throw error;
      } finally {
        setUploading((prev) => ({ ...prev, [kind]: false }));
      }
    });

    try {
      const settled = await Promise.all(uploadTasks);
      settled.forEach(({ kind, url }) => {
        result[kind] = url;
      });
      return result;
    } catch {
      goTo('look');
      return null;
    }
  };

  // Leaving for PayDunya: the draft says where to resume, the steps changing meanwhile (sign-in) must not rewrite it
  const leaving = useRef(false);
  useEffect(() => {
    if (!leaving.current) writeDraft({ values, step: step.id, slugEdited, planChosen });
  }, [values, step.id, slugEdited, planChosen]);

  // Back from PayDunya without paying: the plan chooser again, free stays possible
  useEffect(() => {
    if (pro.payment === 'cancelled' || pro.payment === 'failed') setPlanOpen(true);
  }, [pro.payment]);

  // Creation reserved to Pro by the superadmin: the free plan is not offered
  useEffect(() => {
    if (pro.proOnly && !pro.isPro && formula === 'free') form.setValue('formula', 'pro');
  }, [pro.proOnly, pro.isPro, formula, form]);

  const goTo = (id: StepId) => {
    if (steps.some((s) => s.id === id)) setStepId(id);
  };

  /** The formula, and what the access step offers with it */
  const chooseFormula = (next: 'free' | 'pro') => {
    form.setValue('formula', next, { shouldDirty: true });
    form.clearErrors('pro_plan_id');
    form.setValue('pricing_type', next === 'pro' ? 'paid' : 'free', { shouldDirty: true });
  };

  /** "Passer Pro" from the access step: the chooser, Pro selected */
  const switchToPro = () => {
    chooseFormula('pro');
    setPlanOpen(true);
  };

  /**
   * The chooser answered. Free: the flow from the name step. Pro (not Pro yet): a signed-in user
   * pays now; a visitor gets the account step first, the payment follows it.
   */
  const confirmPlan = async (next: 'free' | 'pro') => {
    setFormError(null);
    chooseFormula(next);
    if (next === 'pro') {
      const ok = await form.trigger(['formula', 'pro_plan_id']);
      if (!ok) return;
    }
    setPlanChosen(true);
    const pays = next === 'pro' && !pro.isPro;
    if (pays && token && !paymentUnderway) {
      setIsSubmitting(true);
      if (!(await payPro())) setIsSubmitting(false);
      return;
    }
    setPlanOpen(false);
    setStepId(pays && !token ? 'account' : 'name');
  };

  /** Pays the chosen Pro plan on PayDunya; the flow resumes on the name step when back */
  const payPro = async () => {
    leaving.current = true;
    writeDraft({ values: form.getValues(), step: 'name', slugEdited, planChosen: true });
    try {
      await pro.checkout(form.getValues('pro_plan_id'));
      return true;
    } catch (error) {
      leaving.current = false;
      writeDraft({ values: form.getValues(), step: step.id, slugEdited, planChosen });
      setFormError(parseApiError(error).message);
      return false;
    }
  };

  const back = () => setStepIndex(Math.max(0, index - 1));

  /** Signs up (or in) inside the flow: register, then login with the same credentials */
  const signIn = async (): Promise<User | null> => {
    const ok = await account.trigger();
    if (!ok) return null;
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
      return result.user;
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
      return null;
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
        ...(v.pricing_type === 'paid'
          ? {
              membership_price: Number(v.membership_price),
              membership_interval: v.membership_interval,
              ...(v.membership_plan_name ? { membership_plan_name: v.membership_plan_name } : {}),
            }
          : {}),
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
    setProPending(false);
    if (step.id !== 'account') {
      const ok = await form.trigger(fieldsOf(step.id));
      if (!ok) return;
    }

    // Account asked right after the plan (Pro): sign in, then pay unless the account is Pro already
    if (step.id === 'account' && !isLast) {
      setIsSubmitting(true);
      const user = await signIn();
      if (!user) {
        setIsSubmitting(false);
        return;
      }
      if (await pro.fetchIsPro(user)) {
        setStepId('name');
        setIsSubmitting(false);
        return;
      }
      if (!(await payPro())) setIsSubmitting(false);
      return;
    }

    if (!isLast) {
      setStepIndex(index + 1);
      return;
    }
    setIsSubmitting(true);
    try {
      let isPro = pro.isPro;
      if (!token) {
        const user = await signIn();
        if (!user) return;
        isPro = await pro.fetchIsPro(user);
      }
      // The api refuses a paid community until the Pro payment is confirmed (pending Mobile Money)
      if (form.getValues('pricing_type') === 'paid' && !isPro) {
        setProPending(true);
        setFormError(t('create.payment.notConfirmed'));
        return;
      }
      await create();
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Pro still pending at the end: create the community free now (paid later, once Pro) */
  const createFree = async () => {
    form.setValue('pricing_type', 'free', { shouldDirty: true });
    setProPending(false);
    setFormError(null);
    setIsSubmitting(true);
    try {
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
    goTo,
    pro,
    /** The paid access can be chosen: Pro already, or Pro chosen in the plan chooser */
    canChoosePaid: pro.isPro || formula === 'pro',
    chooseFormula,
    switchToPro,
    /** The next click opens PayDunya (account step on the Pro path) */
    paysNext: proPath && !paymentUnderway && step.id === 'account' && !isLast,
    /** The plan chooser shows (never to Pro members) */
    planOpen: planOpen && !pro.isPro,
    /** It can be closed without answering only once a plan was chosen */
    planChosen,
    openPlan: () => setPlanOpen(true),
    closePlan: () => setPlanOpen(false),
    confirmPlan,
    /** A signed-in user choosing Pro pays straight from the chooser */
    paysFromPlan: !!token && !pro.isPro && !paymentUnderway,
    proPending,
    createFree,
    isSubmitting,
    formError,
    uploading,
    uploadedUrls,
    isAnyUploading: uploading.avatar || uploading.banner,
  };
}

export type CreateCommunityFlow = ReturnType<typeof UseCreateCommunity>;

export default UseCreateCommunity;
