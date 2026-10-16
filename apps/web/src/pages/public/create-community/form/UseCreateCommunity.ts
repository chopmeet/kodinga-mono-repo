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
import { slugify } from '@/utils/Utils';


const communitySchema = z.object({
  name: z.string().trim().min(3, 'Au moins 3 caractères').max(150, '150 caractères maximum'),
  /** Empty: the api builds it from the name (and keeps it unique) */
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
  look: ['brand_color'],
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
    try {
      const community = await createCommunity({
        name: v.name.trim(),
        ...(slugEdited && v.slug ? { slug: v.slug } : {}),
        tagline: v.tagline.trim(),
        category_id: v.category_id || null,
        privacy_type: v.privacy_type,
        pricing_type: v.pricing_type,
        brand_color: v.brand_color,
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
      const ok = await form.trigger(STEP_FIELDS[step.id]);
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
