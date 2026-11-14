import { Check, EyeOff, Gift, Globe, Lock, Mail, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn, Input, InputPassword, SelectInput } from '@kodinga/ui';
import { PasswordCheck } from '@/pages/auth/components/password-check';
import type { CommunityCategory } from '@/utils/api/community/community.type';
import { useGetProPlansQuery } from '@/utils/api/community/community.api';
import { intervalLabel, planPrice, xof } from '@/utils/Utils';
import { BRAND_COLORS, type CreateCommunityFlow, MIN_MEMBERSHIP_PRICE } from '../form/UseCreateCommunity';
import { ImageField } from './image-field';
import { OptionCard } from './option-card';

const fieldError = (message?: string) => (message ? <p className="mt-1.5 text-sm text-red-600">{message}</p> : null);

export function NameStep({ flow }: { flow: CreateCommunityFlow }) {
  const { t } = useTranslation();
  const { register, formState } = flow.form;
  return (
    <div>
      <Input
        id="community-name"
        label={t('create.name.label')}
        placeholder={t('create.name.placeholder')}
        autoComplete="off"
        autoFocus
        required
        maxLength={150}
        customClassInput="py-3"
        customClassLabel="normal-case! tracking-normal! text-[15px]! font-semibold! text-foreground!"
        error={formState.errors.name?.message}
        {...register('name')}
      />
      <div className="mt-2">
        <p className="mb-2 block text-[15px] font-semibold text-foreground" id="community-address-label">
          {t('create.name.address')}
        </p>
        <div className="rounded-lg border border-border bg-muted/80 px-4 py-3.5" aria-labelledby="community-address-label">
          {flow.slugEdited ? (
            <div className="flex items-center gap-1">
              <label htmlFor="community-slug" className="shrink-0 text-soft">
                kodinga.app/communities/
              </label>
              <input id="community-slug" className="custom-form-control min-w-0 flex-1 bg-card px-2 py-1" {...register('slug')} />
            </div>
          ) : (
            <p className="flex flex-wrap items-center gap-x-4 text-soft">
              <span className="break-all">kodinga.app/communities/{flow.slug || '…'}</span>
              <button type="button" onClick={flow.editSlug} className="text-sm font-semibold text-brand-strong hover:underline">
                {t('create.name.edit')}
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
  const { t } = useTranslation();
  const { register, formState, setValue } = flow.form;
  const selected = flow.values.category_id;
  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="custom-form-label mb-2 block">{t('create.topic.category')}</legend>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('create.topic.loading')}</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('create.topic.none')}</p>
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
                    active ? 'border-brand bg-brand text-white' : 'border-border bg-card text-body hover:border-border-strong'
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
          label={t('create.topic.tagline')}
          placeholder={t('create.topic.taglinePlaceholder')}
          fieldHelp={t('create.topic.taglineHelp', { count: flow.values.tagline.length })}
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
  return monthly ? planPrice(monthly) : null;
}

export function AccessStep({ flow }: { flow: CreateCommunityFlow }) {
  const { t } = useTranslation();
  const { register, formState } = flow.form;
  const proPrice = useProPrice();
  const paid = flow.values.pricing_type === 'paid';
  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="custom-form-label mb-2 block">{t('create.access.visibility')}</legend>
        <div className="grid gap-3">
          <OptionCard
            icon={Globe}
            title={t('create.access.public')}
            description={paid ? t('create.access.publicPaid') : t('create.access.publicText')}
            value="public"
            disabled={paid}
            className={paid ? 'cursor-not-allowed opacity-60' : undefined}
            {...register('privacy_type')}
          />
          <OptionCard icon={Lock} title={t('create.access.private')} description={t('create.access.privateText')} value="private" {...register('privacy_type')} />
          <OptionCard icon={EyeOff} title={t('create.access.secret')} description={t('create.access.secretText')} value="secret" {...register('privacy_type')} />
        </div>
      </fieldset>
      <fieldset>
        <legend className="custom-form-label mb-2 block">{t('create.access.access')}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionCard icon={Gift} title={t('create.access.free')} description={t('create.access.freeText')} value="free" {...register('pricing_type')} />
          <OptionCard
            icon={Wallet}
            title={t('create.access.paid')}
            description={
              flow.pro.isPro
                ? t('create.access.paidReady')
                : flow.canChoosePaid
                  ? t('create.access.paidChosen')
                  : proPrice
                    ? t('create.access.paidPro', { price: proPrice })
                    : t('create.access.paidProNoPrice')
            }
            value="paid"
            disabled={!flow.canChoosePaid}
            className={!flow.canChoosePaid ? 'cursor-not-allowed opacity-60' : undefined}
            {...register('pricing_type')}
          />
        </div>
        {!flow.canChoosePaid && (
          <p className="mt-3 text-sm text-soft">
            {t('create.access.paidLocked')}{' '}
            <button type="button" onClick={flow.switchToPro} className="font-semibold text-brand hover:underline">
              {t('create.access.goPro')}
            </button>
          </p>
        )}
        {paid && (
          <div className="mt-4 rounded-xl border border-border bg-subtle p-4">
            <p className="text-sm font-semibold text-foreground">{t('create.access.priceTitle')}</p>
            <p className="mb-3 text-sm text-muted-foreground">
              {t('create.access.priceText')}
            </p>
            <div className="grid gap-x-3 sm:grid-cols-2">
              <Input
                id="membership-price"
                type="number"
                label={t('create.access.price')}
                required
                min={MIN_MEMBERSHIP_PRICE}
                step={500}
                fieldHelp={t('create.access.minimum', { price: xof(MIN_MEMBERSHIP_PRICE) })}
                error={formState.errors.membership_price?.message}
                {...register('membership_price')}
              />
              <SelectInput
                label={t('create.access.billing')}
                options={(Object.keys(intervalLabel) as (keyof typeof intervalLabel)[]).map((value) => ({ value, label: intervalLabel[value].label }))}
                {...register('membership_interval')}
              />
              <Input
                id="membership-plan-name"
                label={t('create.access.planName')}
                placeholder={t('create.access.planPlaceholder')}
                fieldHelp={t('create.access.planHelp')}
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
  const { t } = useTranslation();
  const { register, setValue, formState } = flow.form;
  const current = flow.values.brand_color.toLowerCase();
  return (
    <fieldset>
      <legend className="custom-form-label mb-3 block">{t('create.look.color')}</legend>
      <div className="flex flex-wrap items-center gap-3">
        {BRAND_COLORS.map((color) => {
          const active = current === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              aria-label={t('create.look.colorOf', { color })}
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
        <label className="flex items-center gap-2 text-sm text-soft">
          <input type="color" className="size-10 cursor-pointer rounded-full border border-border bg-card p-1" {...register('brand_color')} />
          {t('create.look.other')}
        </label>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{t('create.look.colorHelp')}</p>
      {fieldError(formState.errors.brand_color?.message)}

      <div className="mt-6 grid gap-x-6 border-t border-border-soft pt-5 sm:grid-cols-[auto_1fr]">
        <ImageField
          label={t('create.look.logo')}
          help={t('create.look.logoHelp')}
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
          label={t('create.look.banner')}
          help={t('create.look.bannerHelp')}
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
  const { t } = useTranslation();
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
            <Input id="account-first-name" label={t('auth.register.firstName')} autoComplete="given-name" required error={errors.first_name?.message} {...register('first_name')} />
            <Input id="account-last-name" label={t('auth.register.lastName')} autoComplete="family-name" required error={errors.last_name?.message} {...register('last_name')} />
          </div>
          <Input id="account-email" label={t('auth.common.email')} type="email" icon={<Mail className="size-4" />} autoComplete="email" required error={errors.email?.message} {...register('email')} />
          <InputPassword id="account-password" label={t('auth.common.password')} autoComplete="new-password" required error={errors.password?.message} {...register('password')} />
          {password.length > 0 && (
            <div className="mb-3">
              <PasswordCheck password={password} />
            </div>
          )}
          <label htmlFor="account-terms" className="flex items-start gap-3 text-sm leading-relaxed text-soft">
            <input id="account-terms" type="checkbox" className="mt-0.5 size-4 shrink-0 accent-(--primary)" {...register('terms_accepted')} />
            <span>{t('auth.register.terms')}</span>
          </label>
          {fieldError(errors.terms_accepted?.message)}
          <p className="mt-3 text-sm text-muted-foreground">
            {t('create.account.hasAccount')}{' '}
            <button type="button" onClick={() => switchTo('login')} className="font-semibold text-brand hover:underline">
              {t('create.account.login')}
            </button>
          </p>
        </>
      ) : (
        <>
          <Input id="account-email" label={t('auth.common.email')} type="email" icon={<Mail className="size-4" />} autoComplete="email" required error={errors.email?.message} {...register('email')} />
          <InputPassword id="account-password" label={t('auth.common.password')} autoComplete="current-password" required error={errors.password?.message} {...register('password')} />
          <p className="mt-3 text-sm text-muted-foreground">
            {t('create.account.noAccount')}{' '}
            <button type="button" onClick={() => switchTo('register')} className="font-semibold text-brand hover:underline">
              {t('create.account.register')}
            </button>
          </p>
        </>
      )}
    </div>
  );
}
