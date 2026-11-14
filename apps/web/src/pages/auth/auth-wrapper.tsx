import { Globe } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';

import { LogoMark } from '@/layouts/components/logo-mark';
import { ConnectedWorld } from './components/connected-world';

/** login: "grandissez ensemble" (also forgot / reset / verify); register: "un compte, mille possibilités" */
export type AuthPanel = 'login' | 'register';

type Props = {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  panel?: AuthPanel;
};


function AuthWrapper({ title, subtitle, children, footer, panel = 'login' }: Props) {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-svh bg-card lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
      <div className="flex min-h-svh flex-col px-5 py-6 sm:px-10 lg:py-8 xl:px-16">
        <header className="flex items-center justify-between gap-4">
          <NavLink to="/" title="Kodinga" aria-label="Kodinga" className="inline-flex items-center gap-2">
            <LogoMark className="size-9 drop-shadow-sm" />
            <span className="text-2xl font-bold tracking-tight text-foreground">
              kodinga<span className="text-brand">.</span>
            </span>
          </NavLink>
          <Link to="/" className="text-[13px] font-medium whitespace-nowrap text-soft transition-colors hover:text-foreground sm:text-sm">
            {t('auth.layout.explore')}
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[31rem]">
            <h1 className="text-3xl leading-[1.1] font-bold tracking-tight text-balance text-foreground sm:text-[2.6rem]">{title}</h1>
            {subtitle && <div className="mt-4 text-base leading-relaxed text-soft">{subtitle}</div>}

            <div className="mt-9">{children}</div>

            {footer && <div className="mt-8 border-t border-border-soft pt-6 text-center text-[15px] leading-relaxed text-muted-foreground">{footer}</div>}
          </div>
        </main>

        <p className="text-center text-xs text-faint lg:text-left">{t('auth.layout.footer', { year: new Date().getFullYear() })}</p>
      </div>

      {/* Stays in view while a long form scrolls */}
      <div className="hidden lg:sticky lg:top-0 lg:block lg:h-svh lg:p-3">
        <AuthAside panel={panel} />
      </div>
    </div>
  );
}


function AuthAside({ panel }: { panel: AuthPanel }) {
  const { t } = useTranslation();
  return (
    <aside className="relative flex h-full flex-col overflow-hidden rounded-3xl bg-linear-to-br from-[#7C9DDB] via-[#3467CB] to-[#0A2B8C] text-white">
      <div className="pointer-events-none absolute -top-40 -left-40 size-[32rem] rounded-full bg-white/15 blur-3xl" aria-hidden />

      <div className="relative flex items-center justify-between gap-4 px-10 pt-10 xl:px-12">
        <p className="flex items-center gap-2.5 text-xs font-semibold tracking-[0.2em] text-white/85 uppercase">
          <Globe className="size-4" aria-hidden />
          {t('auth.aside.world')}
        </p>
        <p className="flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs text-white/90 backdrop-blur-sm">
          <span className="relative flex size-1.5" aria-hidden>
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-300 motion-reduce:animate-none" />
            <span className="relative size-1.5 rounded-full bg-emerald-300" />
          </span>
          {t('auth.aside.live')}
        </p>
      </div>

      <div className="relative flex flex-1 items-center px-4 xl:px-8">
        <ConnectedWorld panel={panel} />
      </div>

      <div className="relative px-10 pb-12 xl:px-12">
        <p className="flex items-center gap-2.5 text-xs font-semibold tracking-[0.2em] text-white/85 uppercase">
          <span className="flex size-4 items-center justify-center rounded-full bg-white" aria-hidden>
            <span className="size-1.5 rounded-full bg-[#2F5FC4]" />
          </span>
          {t(`auth.aside.${panel}.eyebrow`)}
        </p>
        <h2 className="mt-4 max-w-xl text-3xl leading-[1.12] font-bold tracking-tight text-balance xl:text-[2.6rem]">{t(`auth.aside.${panel}.title`)}</h2>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-white/80">{t(`auth.aside.${panel}.text`)}</p>
      </div>
    </aside>
  );
}

export default AuthWrapper;
