import { Check, EyeOff, Gift, Globe, Lock, Mail, Pencil, Wallet } from 'lucide-react';

import { cn, Input, InputPassword } from '@kodinga-mono-repo/ui';
import { PasswordCheck } from '@/pages/auth/components/password-check';
import type { CommunityCategory } from '@/utils/api/community/community.type';
import { BRAND_COLORS, type CreateCommunityFlow } from '../form/UseCreateCommunity';
import { OptionCard } from './option-card';

const fieldError = (message?: string) => (message ? <p className="mt-1.5 text-sm text-red-600">{message}</p> : null);

export function NameStep({ flow }: { flow: CreateCommunityFlow }) {
  const { register, formState } = flow.form;
  return (
    <div>
      <Input
        id="community-name"
        label="Nom de la communauté"
        placeholder="Ex. : Dakar DevOps & Cloud"
        autoComplete="off"
        autoFocus
        required
        maxLength={150}
        customClassInput="text-lg py-3"
        error={formState.errors.name?.message}
        {...register('name')}
      />
      <div className="mt-1 rounded-xl bg-slate-50 px-4 py-3 text-sm">
        <p className="text-slate-500">Adresse de votre communauté</p>
        {flow.slugEdited ? (
          <div className="mt-2 flex items-center gap-1 font-mono">
            <label htmlFor="community-slug" className="shrink-0 text-slate-500">
              kodinga.com/communities/
            </label>
            <input
              id="community-slug"
              className="custom-form-control min-w-0 flex-1 bg-white px-2 py-1"
              {...register('slug')}
            />
          </div>
        ) : (
          <p className="mt-1 flex flex-wrap items-center gap-x-3 font-mono text-slate-900">
            <span className="break-all">kodinga.com/communities/{flow.slug || '…'}</span>
            <button
              type="button"
              onClick={flow.editSlug}
              className="inline-flex items-center gap-1 font-sans text-sm font-semibold text-brand hover:underline"
            >
              <Pencil className="size-3.5" />
              Modifier
            </button>
          </p>
        )}
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

export function AccessStep({ flow }: { flow: CreateCommunityFlow }) {
  const { register } = flow.form;
  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="custom-form-label mb-2 block">Visibilité</legend>
        <div className="grid gap-3">
          <OptionCard icon={Globe} title="Publique" description="Visible dans l'annuaire, tout le monde peut la rejoindre." value="public" {...register('privacy_type')} />
          <OptionCard icon={Lock} title="Privée" description="Visible dans l'annuaire, vous validez chaque demande d'adhésion." value="private" {...register('privacy_type')} />
          <OptionCard icon={EyeOff} title="Secrète" description="Invisible dans l'annuaire, on n'y entre que sur invitation." value="secret" {...register('privacy_type')} />
        </div>
      </fieldset>
      <fieldset>
        <legend className="custom-form-label mb-2 block">Accès</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionCard icon={Gift} title="Gratuite" description="Idéal pour lancer et fédérer." value="free" {...register('pricing_type')} />
          <OptionCard icon={Wallet} title="Payante" description="Abonnement par Mobile Money ou carte." value="paid" {...register('pricing_type')} />
        </div>
        {flow.values.pricing_type === 'paid' && (
          <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Vous fixerez vos prix et formules juste après la création, dans « Abonnements & paiements ».
          </p>
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
      <p className="mt-3 text-sm text-slate-500">Elle colore votre bannière et votre avatar. Vous pourrez ajouter un logo plus tard.</p>
      {fieldError(formState.errors.brand_color?.message)}
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
