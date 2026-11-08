import { ExternalLink } from 'lucide-react';
import { Controller } from 'react-hook-form';
import { Link } from 'react-router-dom';

import { Button, Input, Loader, TextareaInput } from '@kodinga/ui';
import { ImageField } from '@/pages/public/create-community/components/image-field';
import SettingSwitch from '@/pages/shared/setting-switch';
import type { AvailabilityStatus } from '@/utils/api/profile/profile.type';
import { availabilityLabel } from '@/utils/Utils';
import UseProfileSettings from '../form/UseProfileSettings';

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-slate-100 py-6 first:pt-0 last:border-0 lg:grid-cols-[220px_1fr] lg:gap-8">
      <div>
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** /dashboard/profile/general — what others see on the public profile */
function ProfileTab() {
  const settings = UseProfileSettings();
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = settings.form;

  if (settings.isLoading) return <Loader inline size="sm" message="Chargement du profil…" />;
  if (settings.loadError) return <p className="py-12 text-slate-600">{settings.loadError}</p>;

  const completion = settings.profile?.completion_percentage ?? 0;

  return (
    <form noValidate onSubmit={settings.save}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-blue-50/60 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-blue-950">Profil complété à {completion} %</p>
          <div className="mt-2 h-2 max-w-sm rounded-full bg-white" role="progressbar" aria-label="Profil complété" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-blue-900" style={{ width: `${completion}%` }} />
          </div>
        </div>
        {settings.username && (
          <Link to={`/profiles/${settings.username}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-900 hover:underline">
            Voir mon profil public <ExternalLink className="size-3.5" />
          </Link>
        )}
      </div>

      <Section title="Identité" description="Votre nom et la phrase qui vous présente.">
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Input 
            id="profile-first-name" 
            label="Prénom" 
            required 
            error={errors.first_name?.message} 
            {...register('first_name')} 
          />
          <Input 
            id="profile-last-name" 
            label="Nom" 
            error={errors.last_name?.message} 
            {...register('last_name')} 
          />
        </div>
        <Input 
          id="profile-headline" 
          label="Titre" 
          placeholder="Développeuse full-stack · React & Django" 
          error={errors.headline?.message} 
          {...register('headline')} 
        />
        <TextareaInput 
          id="profile-bio" 
          label="Bio" 
          rows={5} 
          placeholder="Votre parcours, ce qui vous anime, ce que vous cherchez…" 
          error={errors.bio?.message} 
          {...register('bio')} 
        />
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Input 
            id="profile-location" 
            label="Ville, pays" 
            placeholder="Dakar, Sénégal" 
            error={errors.location?.message} 
            {...register('location')} 
          />
          <Input 
            id="profile-years" 
            label="Années d’expérience" 
            inputMode="numeric" 
            error={errors.years_of_experience?.message} 
            {...register('years_of_experience')} 
          />
        </div>
      </Section>

      <Section title="Images" description="Photo de profil et bannière : un fichier ou un lien.">
        <div className="grid gap-6 md:grid-cols-[auto_1fr]">
          <ImageField
            label="Photo de profil"
            help="Carrée, JPG, PNG ou WebP."
            purpose="avatar"
            source={settings.images.avatar.source}
            onSourceChange={(source) => settings.setImage('avatar', { source })}
            file={settings.images.avatar.file}
            onFileChange={(file) => settings.setImage('avatar', { file })}
            url={watch('avatar_url')}
            registration={register('avatar_url')}
            error={errors.avatar_url?.message}
          />
          <ImageField
            label="Bannière"
            help="Format paysage, 1500 × 500 conseillé."
            purpose="banner"
            source={settings.images.banner.source}
            onSourceChange={(source) => settings.setImage('banner', { source })}
            file={settings.images.banner.file}
            onFileChange={(file) => settings.setImage('banner', { file })}
            url={watch('banner_url')}
            registration={register('banner_url')}
            error={errors.banner_url?.message}
          />
        </div>
      </Section>

      <Section title="Liens" description="Où vous trouver ailleurs.">
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Input 
            id="profile-github" 
            label="GitHub" 
            placeholder="nom d’utilisateur" 
            error={errors.github_username?.message} 
            {...register('github_username')} 
          />
          <Input 
            id="profile-gitlab" 
            label="GitLab" 
            placeholder="nom d’utilisateur" 
            error={errors.gitlab_username?.message} 
            {...register('gitlab_username')} 
          />
          <Input 
            id="profile-linkedin" 
            type="url" 
            label="LinkedIn" 
            placeholder="https://linkedin.com/in/…" 
            error={errors.linkedin_url?.message} 
            {...register('linkedin_url')} 
          />
          <Input 
            id="profile-twitter" 
            label="X (Twitter)" 
            placeholder="nom d’utilisateur" 
            error={errors.twitter_handle?.message} 
            {...register('twitter_handle')} 
          />
          <Input 
            id="profile-website" 
            type="url" 
            label="Site web" 
            placeholder="https://…" 
            customClassContainer="sm:col-span-2"
            error={errors.website_url?.message} 
            {...register('website_url')} 
          />
        </div>
      </Section>

      <Section title="Disponibilité" description="Ce que vous recherchez en ce moment.">
        <label className="mb-4 flex max-w-sm flex-col gap-1">
          <span className="custom-form-label">Statut</span>
          <select className="custom-form-control bg-background px-3 py-2" {...register('availability_status')}>
            {(Object.keys(availabilityLabel) as AvailabilityStatus[]).map((s) => (
              <option key={s} value={s}>
                {availabilityLabel[s]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-3">
          {(
            [
              ['open_to_freelance', 'Ouvert aux missions freelance', 'Les recruteurs et porteurs de projets peuvent vous contacter.'],
              ['open_to_remote', 'Ouvert au télétravail', ''],
              ['open_to_relocation', 'Prêt à déménager', ''],
              ['is_mentor', 'Je propose du mentorat', 'Vous apparaissez comme mentor auprès des membres.'],
            ] as const
          ).map(([name, label, description]) => (
            <Controller
              key={name}
              control={control}
              name={name}
              render={({ field }) => <SettingSwitch label={label} description={description} checked={field.value} onCheckedChange={field.onChange} />}
            />
          ))}
        </div>
      </Section>

      <Section title="Visibilité">
        <Controller
          control={control}
          name="is_public"
          render={({ field }) => (
            <SettingSwitch
              label="Profil public"
              description="Visible par tous sur /profiles/votre-nom. Désactivé, seul vous le voyez."
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </Section>

      <div className="sticky bottom-0 -mx-4 flex justify-end border-t border-slate-100 bg-white/95 px-4 py-4 backdrop-blur md:-mx-6 md:px-6">
        <Button type="submit" isLoading={settings.isSaving}>
          Enregistrer le profil
        </Button>
      </div>
    </form>
  );
}

export default ProfileTab;
