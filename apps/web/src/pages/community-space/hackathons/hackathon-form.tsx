import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Controller } from 'react-hook-form';
import { Link, Navigate, useParams } from 'react-router-dom';

import { Button, ColgateWrapper, DetailsPageSkeleton, EmptyAlert, Input, SelectInput, TextareaInput, TopTitle } from '@kodinga/ui';
import { BannerUploadField } from '@/pages/shared/banner-upload-field';
import SettingSwitch from '@/pages/shared/setting-switch';
import { useGetHackathonQuery } from '@/utils/api/community/community.api';
import type { Hackathon } from '@/utils/api/hackathon/hackathon.type';
import { canManageHackathons, useCommunitySpace } from '../community-space-context';
import UseHackathonForm from './form/UseHackathonForm';
import { hackathonFormatLabel } from './hackathon-labels';

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <ColgateWrapper className="border border-neutral-200 p-5">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </ColgateWrapper>
  );
}

function HackathonForm({ hackathon }: { hackathon?: Hackathon }) {
  const { community } = useCommunitySpace();
  const back = hackathon ? `/c/${community.slug}/hackathons/${hackathon.slug}` : `/c/${community.slug}/hackathons`;
  const { form, prizes, criteria, onSubmit } = UseHackathonForm({ slug: community.slug, hackathon });
  const {
    register,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = form;
  const format = watch('format');
  const allowTeams = watch('allow_teams');

  return (
    <form onSubmit={onSubmit} noValidate className="community__hackathon-form pb-24">
      <Link to={back} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="size-4" />
        {hackathon ? hackathon.title : 'Hackathons'}
      </Link>
      <TopTitle
        title={hackathon ? 'Modifier le hackathon' : 'Nouveau hackathon'}
        paragraph={hackathon ? 'Les changements sont visibles dès l’enregistrement.' : 'Il est créé en brouillon : vous le publierez quand tout sera prêt.'}
      />

      <div className="flex flex-col gap-5">
        <Section title="Présentation">
          <div className="grid gap-x-4 md:grid-cols-2">
            <Input id="hk-title" label="Titre" required customClassContainer="md:col-span-2" error={errors.title?.message} {...register('title')} />
            <Input id="hk-tagline" label="Accroche" customClassContainer="md:col-span-2" error={errors.tagline?.message} {...register('tagline')} />
            <TextareaInput
              id="hk-description"
              label="Description du défi"
              required
              rows={6}
              customClassContainer="md:col-span-2"
              error={errors.description?.message}
              {...register('description')}
            />
            <Input id="hk-theme" label="Thème" placeholder="Ex. IA pour l’agriculture" {...register('theme')} />
            <Input id="hk-audience" label="Public visé" placeholder="Ex. Étudiants et développeurs" {...register('target_audience')} />
            <TextareaInput id="hk-prerequisites" label="Prérequis" rows={3} customClassContainer="md:col-span-2" {...register('prerequisites')} />
            <Controller
              control={control}
              name="cover_image_url"
              render={({ field }) => (
                <BannerUploadField
                  id="hk-cover"
                  label="Image de couverture"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.cover_image_url?.message}
                  className="mb-4 md:col-span-2"
                />
              )}
            />
            <Input id="hk-rules" label="Lien du règlement" placeholder="https://…" error={errors.rules_url?.message} {...register('rules_url')} />
          </div>
        </Section>

        <Section title="Lieu">
          <div className="grid gap-x-4 md:grid-cols-2">
            <SelectInput
              label="Format"
              options={(Object.keys(hackathonFormatLabel) as (keyof typeof hackathonFormatLabel)[]).map((value) => ({ value, label: hackathonFormatLabel[value] }))}
              {...register('format')}
            />
            <Input id="hk-url" label="Lien en ligne (Discord, Meet…)" placeholder="https://…" error={errors.location_url?.message} {...register('location_url')} />
            {format !== 'online' && (
              <>
                <Input id="hk-venue" label="Lieu" {...register('venue_name')} />
                <Input id="hk-city" label="Ville" {...register('venue_city')} />
                <Input id="hk-country" label="Pays" {...register('venue_country')} />
              </>
            )}
          </div>
        </Section>

        <Section title="Calendrier" description="Dans l’ordre : inscriptions, hackathon, soumissions, évaluation.">
          <div className="grid gap-x-4 md:grid-cols-2">
            <Input id="hk-reg-start" type="datetime-local" label="Ouverture des inscriptions" required error={errors.registration_start?.message} {...register('registration_start')} />
            <Input id="hk-reg-end" type="datetime-local" label="Clôture des inscriptions" required error={errors.registration_end?.message} {...register('registration_end')} />
            <Input id="hk-start" type="datetime-local" label="Début du hackathon" required error={errors.start_time?.message} {...register('start_time')} />
            <Input id="hk-deadline" type="datetime-local" label="Date limite de soumission" required error={errors.submission_deadline?.message} {...register('submission_deadline')} />
            <Input id="hk-judging" type="datetime-local" label="Fin de l’évaluation" required error={errors.judging_end?.message} {...register('judging_end')} />
          </div>
        </Section>

        <Section title="Participation">
          <div className="divide-y divide-slate-100 border-y border-slate-100">
            {(
              [
                ['is_member_only', 'Réservé aux membres', 'Seuls les membres de la communauté peuvent candidater.'],
                ['auto_accept_applications', 'Acceptation automatique', 'Sinon, vous validez chaque candidature.'],
                ['allow_teams', 'Équipes autorisées', 'Les participants peuvent concourir à plusieurs.'],
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
          <div className="mt-4 grid gap-x-4 md:grid-cols-3">
            {allowTeams && (
              <>
                <Input id="hk-min-team" type="number" min={1} label="Taille min. d’équipe" error={errors.min_team_size?.message} {...register('min_team_size')} />
                <Input id="hk-max-team" type="number" min={1} label="Taille max. d’équipe" error={errors.max_team_size?.message} {...register('max_team_size')} />
              </>
            )}
            <Input
              id="hk-max-participants"
              type="number"
              min={1}
              label="Participants max."
              fieldHelp="Vide : sans limite."
              error={errors.max_participants?.message}
              {...register('max_participants')}
            />
          </div>
        </Section>

        <Section title="Soumissions" description="Ce que chaque projet doit fournir.">
          <div className="divide-y divide-slate-100 border-y border-slate-100">
            {(
              [
                ['require_repo_url', 'Dépôt de code', 'Lien GitHub, GitLab…'],
                ['require_demo_url', 'Démo en ligne', 'Lien vers l’application déployée.'],
                ['require_video_url', 'Vidéo de présentation', 'Pitch ou démo filmée.'],
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

        <Section title="Prix" description="Dans l’ordre du classement. Montants en FCFA.">
          <ol className="flex flex-col gap-3">
            {prizes.fields.map((field, i) => (
              <li key={field.id} className="grid items-start gap-x-3 sm:grid-cols-[2rem_1fr_10rem_1fr_auto]">
                <span className="mt-9 text-sm font-semibold text-slate-500">#{i + 1}</span>
                <Input id={`hk-prize-${i}`} label="Prix" error={errors.prizes?.[i]?.title?.message} {...register(`prizes.${i}.title`)} />
                <Input id={`hk-prize-amount-${i}`} type="number" min={0} label="Montant" error={errors.prizes?.[i]?.reward_amount?.message} {...register(`prizes.${i}.reward_amount`)} />
                <Input id={`hk-prize-desc-${i}`} label="Ou en nature" placeholder="Ex. Incubation 3 mois" {...register(`prizes.${i}.reward_description`)} />
                <Button type="button" variant="ghost" size="icon-sm" className="mt-8" aria-label={`Retirer le prix ${i + 1}`} onClick={() => prizes.remove(i)}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ol>
          <Button type="button" variant="outline" size="sm" onClick={() => prizes.append({ title: '', reward_amount: '', reward_description: '' })}>
            <Plus />
            Ajouter un prix
          </Button>
        </Section>

        <Section title="Critères d’évaluation" description="Le jury note chaque projet sur ces critères.">
          <ol className="flex flex-col gap-3">
            {criteria.fields.map((field, i) => (
              <li key={field.id} className="grid items-start gap-x-3 sm:grid-cols-[1fr_8rem_8rem_auto]">
                <Input id={`hk-criterion-${i}`} label="Critère" error={errors.criteria?.[i]?.name?.message} {...register(`criteria.${i}.name`)} />
                <Input id={`hk-criterion-weight-${i}`} type="number" min={0} step="0.5" label="Poids" error={errors.criteria?.[i]?.weight?.message} {...register(`criteria.${i}.weight`)} />
                <Input id={`hk-criterion-max-${i}`} type="number" min={1} label="Note max." error={errors.criteria?.[i]?.max_score?.message} {...register(`criteria.${i}.max_score`)} />
                <Button type="button" variant="ghost" size="icon-sm" className="mt-8" aria-label={`Retirer le critère ${i + 1}`} onClick={() => criteria.remove(i)}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ol>
          <Button type="button" variant="outline" size="sm" onClick={() => criteria.append({ name: '', weight: '1', max_score: '20' })}>
            <Plus />
            Ajouter un critère
          </Button>
        </Section>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex justify-end gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <Button asChild variant="outline">
          <Link to={back}>Annuler</Link>
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {hackathon ? 'Enregistrer' : 'Créer le brouillon'}
        </Button>
      </div>
    </form>
  );
}

/** Moderators read the hackathons; creating and editing is for the owner and admins (like the api) */
function ManagersOnly({ children }: { children: ReactNode }) {
  const space = useCommunitySpace();
  if (!canManageHackathons(space)) return <Navigate to={`/c/${space.community.slug}/hackathons`} replace />;
  return children;
}

/** /c/:slug/hackathons/new */
export function NewHackathon() {
  return (
    <ManagersOnly>
      <HackathonForm />
    </ManagersOnly>
  );
}

/** /c/:slug/hackathons/:hackathonSlug/edit */
export function EditHackathon() {
  const { community } = useCommunitySpace();
  const { hackathonSlug = '' } = useParams();
  const { data, isLoading } = useGetHackathonQuery({ slug: community.slug, hackathonSlug });
  if (isLoading) return <DetailsPageSkeleton />;
  if (!data) return <EmptyAlert text="Ce hackathon est introuvable." />;
  return (
    <ManagersOnly>
      <HackathonForm hackathon={data} />
    </ManagersOnly>
  );
}
