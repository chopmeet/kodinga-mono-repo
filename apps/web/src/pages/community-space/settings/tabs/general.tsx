import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { customToast, Input, SelectInput, TextareaInput } from '@kodinga-mono-repo/ui';
import { adminCategories } from '@/data/admin-communities.data';
import FormActions from '@/pages/shared/form-actions';
import { useCommunitySpace } from '../../community-space-context';
import { useSpaceSettings } from '../form/UseSpaceSettings';

const optionalUrl = z.string().trim().refine((v) => !v || /^https?:\/\/\S+\.\S+/.test(v), 'Lien invalide (https://…)');

// Limits of the api model (communities/models/community.py)
const schema = z.object({
  name: z.string().trim().min(3, 'Au moins 3 caractères').max(150, '150 caractères maximum'),
  tagline: z.string().trim().max(255, '255 caractères maximum'),
  description: z.string().trim(),
  category_id: z.string(),
  brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide'),
  website_url: optionalUrl,
  github_url: optionalUrl,
  discord_url: optionalUrl,
  twitter_url: optionalUrl,
});

type Values = z.infer<typeof schema>;

function GeneralTab() {
  const { community } = useCommunitySpace();
  const { profile, saveProfile } = useSpaceSettings();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: profile });

  const onSubmit = async (values: Values) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    saveProfile(values);
    reset(values);
    customToast.success({ message: 'Informations de la communauté enregistrées.' });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <h2 className="text-lg font-semibold text-slate-900">Informations</h2>
      <p className="mb-5 text-sm text-slate-500">Ce que voient les visiteurs sur la page publique de la communauté.</p>

      <div className="grid gap-x-4 md:grid-cols-2">
        <Input id="community-name" label="Nom" required error={errors.name?.message} {...register('name')} />
        <SelectInput
          label="Catégorie"
          placeholder="Aucune catégorie"
          options={adminCategories.map((c) => ({ value: c.id, label: c.name }))}
          {...register('category_id')}
        />
        <Input
          id="community-tagline"
          label="Accroche"
          fieldHelp="Une phrase, affichée sous le nom dans l'annuaire."
          customClassContainer="md:col-span-2"
          error={errors.tagline?.message}
          {...register('tagline')}
        />
        <TextareaInput
          id="community-description"
          label="Présentation"
          rows={5}
          fieldHelp="Markdown accepté."
          customClassContainer="md:col-span-2"
          error={errors.description?.message}
          {...register('description')}
        />
        <div className="mb-3">
          <label htmlFor="community-brand-color" className="custom-form-label mb-1 block">
            Couleur de la communauté
          </label>
          <div className="flex items-center gap-3">
            <input
              id="community-brand-color"
              type="color"
              className="h-10 w-14 cursor-pointer rounded-md border border-slate-200 bg-white p-1"
              {...register('brand_color')}
            />
            <span className="font-mono text-sm text-slate-600 uppercase">{watch('brand_color')}</span>
          </div>
        </div>
        <div className="mb-3">
          <p className="custom-form-label mb-1 block">Adresse de la communauté</p>
          <p className="truncate rounded-md bg-slate-50 px-3 py-2.5 font-mono text-sm text-slate-600">kodinga.com/communities/{community.slug}</p>
        </div>
      </div>

      <h3 className="mt-4 mb-3 text-sm font-semibold text-slate-900">Liens</h3>
      <div className="grid gap-x-4 md:grid-cols-2">
        <Input id="community-website" label="Site web" placeholder="https://" error={errors.website_url?.message} {...register('website_url')} />
        <Input id="community-github" label="GitHub" placeholder="https://github.com/…" error={errors.github_url?.message} {...register('github_url')} />
        <Input id="community-discord" label="Discord" placeholder="https://discord.gg/…" error={errors.discord_url?.message} {...register('discord_url')} />
        <Input id="community-twitter" label="X (Twitter)" placeholder="https://x.com/…" error={errors.twitter_url?.message} {...register('twitter_url')} />
      </div>

      <FormActions isDirty={isDirty} isSaving={isSubmitting} onReset={() => reset(profile)} />
    </form>
  );
}

export default GeneralTab;
