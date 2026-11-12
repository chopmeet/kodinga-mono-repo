import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';

import { LogoMark } from '@/layouts/components/logo-mark';

// Labels: names that stay the same in every language, or keys of auth.aside
const highlights: { label: string; translate?: 'python' | 'security'; dot: string }[] = [
  { label: 'Rust', dot: 'bg-orange-400' },
  { label: 'Python & IA', translate: 'python', dot: 'bg-yellow-300' },
  { label: 'Cloud & DevOps', dot: 'bg-sky-300' },
  { label: 'Web3 & Fintech', dot: 'bg-violet-300' },
  { label: 'Mobile', dot: 'bg-emerald-300' },
  { label: 'Cybersécurité', translate: 'security', dot: 'bg-rose-300' },
];

type Props = {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};


function AuthWrapper({ title, subtitle, children, footer }: Props) {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-svh bg-card lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:p-8">
      {/* The orbit of the logo, large: two translucent rings crossing the panel, each with its "satellite" */}
      <aside className="relative hidden overflow-hidden rounded-3xl bg-linear-to-br from-[#0A47F8] via-blue-800 to-blue-950 lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.14)_1px,transparent_1px)] mask-b-from-10% mask-b-to-60% bg-size-[22px_22px]" />
        <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
          <ellipse cx="330" cy="470" rx="420" ry="150" transform="rotate(-28 330 470)" fill="none" stroke="white" strokeOpacity="0.16" strokeWidth="2" />
          <ellipse cx="300" cy="500" rx="300" ry="96" transform="rotate(-28 300 500)" fill="none" stroke="white" strokeOpacity="0.1" strokeWidth="1.5" />
          <circle cx="515" cy="242" r="8" fill="white" fillOpacity="0.9" />
          <circle cx="58" cy="650" r="5" fill="white" fillOpacity="0.55" />
        </svg>

        <p className="relative px-14 pt-14 text-xs font-semibold tracking-[0.2em] text-blue-200 uppercase xl:px-20">
          <span className="mr-2 inline-block size-1.5 rounded-full bg-white align-middle" aria-hidden />
          kodinga
        </p>

        <div className="relative px-14 xl:px-20">
          <h2 className="max-w-md text-4xl leading-[1.1] font-bold tracking-tight text-balance text-white xl:text-5xl">
            {t('auth.aside.titleStart')} <span className="text-blue-200">{t('auth.aside.titleHighlight')}</span>
          </h2>

          {/* A developer's way in: joining a community, in a terminal */}
          <figure aria-label={t('auth.aside.terminal')} className="mt-10 max-w-md overflow-hidden rounded-2xl border border-white/15 bg-white/10 shadow-2xl shadow-blue-950/40 backdrop-blur-md">
            <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3" aria-hidden>
              <span className="size-2.5 rounded-full bg-white/30" />
              <span className="size-2.5 rounded-full bg-white/30" />
              <span className="size-2.5 rounded-full bg-white/30" />
            </div>
            <pre className="px-5 py-4 font-mono text-sm leading-relaxed whitespace-pre-wrap text-blue-100">
              <span className="text-blue-300">$</span> kodinga join --stack python{'\n'}
              <span className="text-emerald-300">✓</span> <span className="text-white">{t('auth.aside.welcome')}</span>
            </pre>
          </figure>

          <ul className="mt-8 flex max-w-lg flex-wrap gap-2">
            {highlights.map(({ label, translate, dot }) => (
              <li key={label} className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-sm text-white backdrop-blur-sm">
                <span className={`size-2 rounded-full ${dot}`} aria-hidden />
                {translate ? t(`auth.aside.${translate}`) : label}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative px-14 pb-12 text-sm text-blue-200 xl:px-20">{t('layout.footer.madeIn')}</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <NavLink to="/" title="Kodinga" aria-label="Kodinga" className="inline-flex items-center gap-2">
            <LogoMark className="size-8 drop-shadow-sm" />
            <span className="text-xl font-bold tracking-tight text-foreground">
              kodinga<span className="text-brand">.</span>
            </span>
          </NavLink>

          <h1 className="mt-10 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h1>
          {subtitle && <div className="mt-3 text-[15px] text-muted-foreground">{subtitle}</div>}

          <div className="mt-8">{children}</div>

          {footer && <div className="mt-8 text-center text-sm leading-relaxed text-muted-foreground">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

export default AuthWrapper;
