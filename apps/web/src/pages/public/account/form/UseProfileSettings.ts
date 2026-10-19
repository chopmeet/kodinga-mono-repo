import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { customToast } from '@kodinga-mono-repo/ui';
import type { ImageSource } from '@/pages/public/create-community/components/image-field';
import { useAppDispatch, useAppSelector } from '@/redux/hook';
import { onSetUser } from '@/redux/slice/User.slice';
import { parseApiError } from '@/utils/api/errors';
import { useImageUpload } from '@/utils/api/media/useImageUpload';
import type { AvailabilityStatus, MyProfile } from '@/utils/api/profile/profile.type';
import { useGetMyProfileQuery, useUpdateMeMutation, useUpdateMyProfileMutation } from '@/utils/api/user/user.api';

const optionalUrl = z.string().trim().refine((v) => !v || /^https?:\/\/\S+\.\S+/.test(v), 'Lien invalide (https://…)');
/** A username, not a link: "fatou-dev", not "https://github.com/fatou-dev" */
const handle = z
  .string()
  .trim()
  .max(100, '100 caractères au maximum')
  .refine((v) => !/[/\s]/.test(v), 'Le nom d’utilisateur seul, sans lien');

const profileSchema = z.object({
  first_name: z.string().trim().min(1, 'Votre prénom').max(150),
  last_name: z.string().trim().max(150),
  headline: z.string().trim().max(150, '150 caractères au maximum'),
  bio: z.string().max(2000, '2 000 caractères au maximum'),
  location: z.string().trim().max(100, '100 caractères au maximum'),
  years_of_experience: z.string().trim().refine((v) => !v || (/^\d+$/.test(v) && Number(v) <= 60), 'Un nombre d’années (0 à 60)'),
  availability_status: z.enum(['available', 'open_to_offers', 'busy', 'unavailable']),
  website_url: optionalUrl,
  linkedin_url: optionalUrl,
  github_username: handle,
  gitlab_username: handle,
  twitter_handle: handle,
  avatar_url: optionalUrl,
  banner_url: optionalUrl,
  is_public: z.boolean(),
  is_mentor: z.boolean(),
  open_to_freelance: z.boolean(),
  open_to_remote: z.boolean(),
  open_to_relocation: z.boolean(),
});

export type ProfileValues = z.infer<typeof profileSchema>;
type ImageKind = 'avatar' | 'banner';
type ImageState = { source: ImageSource; file: File | null };

export const availabilityLabel: Record<AvailabilityStatus, string> = {
  available: 'Disponible',
  open_to_offers: 'À l’écoute des offres',
  busy: 'Occupé',
  unavailable: 'Non disponible',
};

const valuesOf = (profile: MyProfile | undefined, user: { first_name?: string; last_name?: string } | null): ProfileValues => ({
  first_name: user?.first_name ?? '',
  last_name: user?.last_name ?? '',
  headline: profile?.headline ?? '',
  bio: profile?.bio ?? '',
  location: profile?.location ?? '',
  years_of_experience: profile?.years_of_experience ? String(profile.years_of_experience) : '',
  availability_status: profile?.availability_status ?? 'open_to_offers',
  website_url: profile?.website_url ?? '',
  linkedin_url: profile?.linkedin_url ?? '',
  github_username: profile?.github_username ?? '',
  gitlab_username: profile?.gitlab_username ?? '',
  twitter_handle: profile?.twitter_handle ?? '',
  avatar_url: profile?.avatar_url ?? '',
  banner_url: profile?.banner_url ?? '',
  is_public: profile?.is_public ?? true,
  is_mentor: profile?.is_mentor ?? false,
  open_to_freelance: profile?.open_to_freelance ?? true,
  open_to_remote: profile?.open_to_remote ?? true,
  open_to_relocation: profile?.open_to_relocation ?? false,
});

/**
 * /account/profile — identity (users/me/) and developer profile (profiles/me/). Images are a file
 * (sent to UploadThing on save) or a link, like for the communities.
 */
function UseProfileSettings() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.user.user);
  const profile = useGetMyProfileQuery();
  const [updateMe] = useUpdateMeMutation();
  const [updateProfile] = useUpdateMyProfileMutation();
  const uploadImage = useImageUpload();
  const [isSaving, setIsSaving] = useState(false);
  const [images, setImages] = useState<Record<ImageKind, ImageState>>({ avatar: { source: 'url', file: null }, banner: { source: 'url', file: null } });

  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: valuesOf(undefined, user) });
  const { reset } = form;
  useEffect(() => {
    if (profile.data) reset(valuesOf(profile.data, user));
    // The user only seeds the form with the profile: not when it changes after a save
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.data, reset]);

  const setImage = (kind: ImageKind, changes: Partial<ImageState>) => setImages((current) => ({ ...current, [kind]: { ...current[kind], ...changes } }));

  const save = form.handleSubmit(async ({ first_name, last_name, years_of_experience, ...values }) => {
    setIsSaving(true);
    try {
      // Chosen files first: their url replaces the link
      for (const kind of ['avatar', 'banner'] as const) {
        const { source, file } = images[kind];
        if (source === 'file' && file) values[`${kind}_url`] = await uploadImage(file, kind);
      }
      const account = await updateMe({ first_name, last_name }).unwrap();
      if (user) dispatch(onSetUser({ ...user, ...account }));
      await updateProfile({ ...values, years_of_experience: years_of_experience ? Number(years_of_experience) : 0 }).unwrap();
      setImages({ avatar: { source: 'url', file: null }, banner: { source: 'url', file: null } });
      customToast.success({ message: 'Profil enregistré.' });
    } catch (error) {
      customToast.error({ message: error instanceof Error ? error.message : parseApiError(error).message });
    } finally {
      setIsSaving(false);
    }
  });

  return {
    form,
    profile: profile.data,
    isLoading: profile.isLoading,
    loadError: profile.error ? parseApiError(profile.error).message : null,
    username: user?.username ?? '',
    images,
    setImage,
    isSaving,
    save,
  };
}

export type ProfileSettings = ReturnType<typeof UseProfileSettings>;

export default UseProfileSettings;
