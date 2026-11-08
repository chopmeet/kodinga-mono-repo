import { Check, EyeOff, Gift, Globe, Lock, Mail, Wallet } from 'lucide-react';

import { cn, Input, InputPassword, SelectInput } from '@kodinga/ui';
import { PasswordCheck } from '@/pages/auth/components/password-check';
import type { CommunityCategory } from '@/utils/api/community/community.type';
import { useGetProPlansQuery } from '@/utils/api/community/community.api';
import { intervalLabel, xof } from '@/utils/Utils';
import { BRAND_COLORS, type CreateCommunityFlow, MIN_MEMBERSHIP_PRICE } from '../form/UseCreateCommunity';
import { ImageField } from './image-field';
import { OptionCard } from './option-card';

const fieldError = (message?: string) => (message ? <p className="mt-1.5 text-sm text-red-600">{message}</p> : null);

export function NameStep({ flow }: { flow: CreateCommunityFlow }) {
  const { register, formState } = flow.form;
  return (
    <div>
      <Input
        id="community-name"
        label="Nom de la communauté"
        placeholder="Ex. Dakar Data Women"
        autoComplete="off"
        autoFocus
        required
        maxLength={150}
        customClassInput="py-3"
        customClassLabel="normal-case! tracking-normal! text-[15px]! font-semibold! text-slate-900!"
        error={formState.errors.name?.message}
        {...register('name')}
      />
      <div className="mt-2">
        <p className="mb-2 block text-[15px] font-semibold text-slate-900" id="community-address-label">
          Adresse de votre communauté
        </p>
        <div className="rounded-lg border border-slate-200 bg-slate-100/80 px-4 py-3.5" aria-labelledby="community-address-label">
          {flow.slugEdited ? (
            <div className="flex items-center gap-1">
              <label htmlFor="community-slug" className="shrink-0 text-slate-600">
                kodinga.com/communities/
              </label>
              <input id="community-slug" className="custom-form-control min-w-0 flex-1 bg-white px-2 py-1" {...register('slug')} />
            </div>
          ) : (
            <p className="flex flex-wrap items-center gap-x-4 text-slate-600">
              <span className="break-all">kodinga.com/communities/{flow.slug || '…'}</span>
              <button type="button" onClick={flow.editSlug} className="text-sm font-semibold text-blue-800 hover:underline">
                Modifier
              </button>
            </p>
          )}
        </div>
        {fieldError(formState.errors.slug?.message)}
      </div>
    </div>
  );
}

export function TopicStep({ flow, categories, isLoading }: { flow: CreateCommunityFlow; categories: CommunityCategory[]; isLoading: boolean }) {
  const { register, formState, setValue } = flow.form;
  const selected = flow.values.category_id;
  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="custom-form-label mb-2 block">Catégorie</legend>
        {isLoading ? (
          <p className="text-sm text-slate-500">Chargement des catégories…</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune catégorie disponible pour l'instant : vous pourrez la choisir plus tard.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const active = selected === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setValue('category_id', active ? '' : c.id, { shouldDirty: true })}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors',
                    active ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  )}
                >
                  {active && <Check className="size-3.5" />}
                  {c.name}
                </button>
              );
            })}
          </div>
        )}
        {fieldError(formState.errors.category_id?.message)}
      </fieldset>
      <div>
        <Input
          id="community-tagline"
          label="Accroche"
          placeholder="Ex. : Les ingénieurs cloud d'Afrique de l'Ouest partagent leurs retours terrain."
          fieldHelp={`Une phrase, affichée sous le nom dans l'annuaire. ${flow.values.tagline.length}/255`}
          maxLength={255}
          error={formState.errors.tagline?.message}
          {...register('tagline')}
        />
      </div>
    </div>
  );
}

/** "5 000 FCFA / mois": the monthly Kodinga Pro plan of the api (its price is set by the superadmin) */
function useProPrice() {
  const { data } = useGetProPlansQuery();
  // Not a list (api error page, older api): no price shown, the page still works
  const monthly = (Array.isArray(data) ? data : []).find((p) => p.billing_interval === 'month' && Number(p.price) > 0);
  return monthly ? `${xof(Number(monthly.price))} ${intervalLabel.month.suffix}` : null;
}

export function AccessStep({ flow }: { flow: CreateCommunityFlow }) {
  const { register, formState } = flow.form;
  const proPrice = useProPrice();
  const paid = flow.values.pricing_type === 'paid';
  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="custom-form-label mb-2 block">Visibilité</legend>
        <div className="grid gap-3">
          <OptionCard
            icon={Globe}
            title="Publique"
            description={paid ? 'Indisponible : une communauté payante est forcément privée ou secrète.' : "Visible dans l'annuaire, tout le monde peut la rejoindre."}
            value="public"
            disabled={paid}
            className={paid ? 'cursor-not-allowed opacity-60' : undefined}
            {...register('privacy_type')}
          />
          <OptionCard icon={Lock} title="Privée" description="Visible dans l'annuaire, vous validez chaque demande d'adhésion." value="private" {...register('privacy_type')} />
          <OptionCard icon={EyeOff} title="Secrète" description="Invisible dans l'annuaire, on n'y entre que sur invitation." value="secret" {...register('privacy_type')} />
        </div>
      </fieldset>
      <fieldset>
        <legend className="custom-form-label mb-2 block">Accès</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionCard icon={Gift} title="Gratuite" description="Idéal pour lancer et fédérer librement." value="free" {...register('pricing_type')} />
          <OptionCard
            icon={Wallet}
            title="Payante"
            description={proPrice ? `Réservé aux membres Kodinga Pro (${proPrice}).` : 'Réservé aux membres Kodinga Pro.'}
            value="paid"
            {...register('pricing_type')}
          />
        </div>
        {paid && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Prix d'adhésion</p>
            <p className="mb-3 text-sm text-slate-500">
              Payé par Mobile Money ou carte via PayDunya. Vous pourrez ajouter d'autres formules dans « Abonnements & paiements ».
            </p>
            <div className="grid gap-x-3 sm:grid-cols-2">
              <Input
                id="membership-price"
                type="number"
                label="Prix (FCFA)"
                required
                min={MIN_MEMBERSHIP_PRICE}
                step={500}
                fieldHelp={`Minimum ${xof(MIN_MEMBERSHIP_PRICE)}`}
                error={formState.errors.membership_price?.message}
                {...register('membership_price')}
              />
              <SelectInput
                label="Facturation"
                options={(Object.keys(intervalLabel) as (keyof typeof intervalLabel)[]).map((value) => ({ value, label: intervalLabel[value].label }))}
                {...register('membership_interval')}
              />
              <Input
                id="membership-plan-name"
                label="Nom de la formule"
                placeholder="Ex. Pass mensuel"
                fieldHelp="Facultatif : « Pass <nom de la communauté> » sinon"
                customClassContainer="sm:col-span-2"
                error={formState.errors.membership_plan_name?.message}
                {...register('membership_plan_name')}
              />
            </div>
          </div>
        )}
      </fieldset>
    </div>
  );
}

export function LookStep({ flow }: { flow: CreateCommunityFlow }) {
  const { register, setValue, formState } = flow.form;
  const current = flow.values.brand_color.toLowerCase();
  return (
    <fieldset>
      <legend className="custom-form-label mb-3 block">Couleur de la communauté</legend>
      <div className="flex flex-wrap items-center gap-3">
        {BRAND_COLORS.map((color) => {
          const active = current === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              aria-label={`Couleur ${color}`}
              aria-pressed={active}
              onClick={() => setValue('brand_color', color, { shouldDirty: true })}
              className={cn(
                'flex size-10 items-center justify-center rounded-full text-white transition-transform hover:scale-110',
                active && 'ring-2 ring-slate-900 ring-offset-2'
              )}
              style={{ backgroundColor: color }}
            >
              {active && <Check className="size-4" />}
            </button>
          );
        })}
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="color" className="size-10 cursor-pointer rounded-full border border-slate-200 bg-white p-1" {...register('brand_color')} />
          Autre
        </label>
      </div>
      <p className="mt-3 text-sm text-slate-500">Elle colore votre bannière et votre avatar tant qu'ils n'ont pas d'image.</p>
      {fieldError(formState.errors.brand_color?.message)}

      <div className="mt-6 grid gap-x-6 border-t border-slate-100 pt-5 sm:grid-cols-[auto_1fr]">
        <ImageField
          label="Logo (facultatif)"
          help="Image carrée, au moins 256 × 256 px (1 Mo max)."
          purpose="avatar"
          source={flow.images.avatar.source}
          onSourceChange={(source) => flow.setImage('avatar', { source })}
          file={flow.images.avatar.file}
          onFileChange={(file) => flow.setImage('avatar', { file })}
          url={flow.values.avatar_url}
          registration={register('avatar_url')}
          error={formState.errors.avatar_url?.message}
          isUploading={flow.uploading?.avatar}
          isUploaded={!!flow.uploadedUrls?.avatar}
        />
        <ImageField
          label="Image de bannière (facultatif)"
          help="Format paysage, idéalement 1600 × 900 px (5 Mo max)."
          purpose="banner"
          source={flow.images.banner.source}
          onSourceChange={(source) => flow.setImage('banner', { source })}
          file={flow.images.banner.file}
          onFileChange={(file) => flow.setImage('banner', { file })}
          url={flow.values.banner_url}
          registration={register('banner_url')}
          error={formState.errors.banner_url?.message}
          isUploading={flow.uploading?.banner}
          isUploaded={!!flow.uploadedUrls?.banner}
        />
      </div>
    </fieldset>
  );
}

export function AccountStep({ flow }: { flow: CreateCommunityFlow }) {
  const { register, formState, watch, setValue, clearErrors } = flow.account;
  const mode = watch('mode');
  const errors = formState.errors as Partial<Record<string, { message?: string }>>;
  const password = watch('password') ?? '';

  const switchTo = (next: 'register' | 'login') => {
    clearErrors();
    setValue('mode', next);
  };

  return (
    <div className="flex flex-col gap-2">
      {mode === 'register' ? (
        <>
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Input id="account-first-name" label="Prénom" autoComplete="given-name" required error={errors.first_name?.message} {...register('first_name')} />
            <Input id="account-last-name" label="Nom" autoComplete="family-name" required error={errors.last_name?.message} {...register('last_name')} />
          </div>
          <Input id="account-email" label="Adresse email" type="email" icon={<Mail className="size-4" />} autoComplete="email" required error={errors.email?.message} {...register('email')} />
          <InputPassword id="account-password" label="Mot de passe" autoComplete="new-password" required error={errors.password?.message} {...register('password')} />
          {password.length > 0 && (
            <div className="mb-3">
              <PasswordCheck password={password} />
            </div>
          )}
          <label htmlFor="account-terms" className="flex items-start gap-3 text-sm leading-relaxed text-slate-600">
            <input id="account-terms" type="checkbox" className="mt-0.5 size-4 shrink-0 accent-(--primary)" {...register('terms_accepted')} />
            <span>J'accepte les conditions d'utilisation et la politique de confidentialité de Kodinga.</span>
          </label>
          {fieldError(errors.terms_accepted?.message)}
          <p className="mt-3 text-sm text-slate-500">
            Déjà un compte ?{' '}
            <button type="button" onClick={() => switchTo('login')} className="font-semibold text-brand hover:underline">
              Se connecter
            </button>
          </p>
        </>
      ) : (
        <>
          <Input id="account-email" label="Adresse email" type="email" icon={<Mail className="size-4" />} autoComplete="email" required error={errors.email?.message} {...register('email')} />
          <InputPassword id="account-password" label="Mot de passe" autoComplete="current-password" required error={errors.password?.message} {...register('password')} />
          <p className="mt-3 text-sm text-slate-500">
            Pas encore de compte ?{' '}
            <button type="button" onClick={() => switchTo('register')} className="font-semibold text-brand hover:underline">
              Créer un compte
            </button>
          </p>
        </>
      )}
    </div>
  );
}
