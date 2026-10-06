import { Brain, Cloud, Cog, type LucideIcon, ShieldCheck, Smartphone, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

const highlights: { label: string; icon: LucideIcon; iconClassName: string }[] = [
  { label: 'Rust', icon: Cog, iconClassName: 'bg-orange-500' },
  { label: 'Python & IA', icon: Brain, iconClassName: 'bg-blue-600' },
  { label: 'Cloud & DevOps', icon: Cloud, iconClassName: 'bg-sky-500' },
  { label: 'Web3 & Fintech', icon: Wallet, iconClassName: 'bg-violet-600' },
  { label: 'Mobile', icon: Smartphone, iconClassName: 'bg-emerald-500' },
  { label: 'Cybersécurité', icon: ShieldCheck, iconClassName: 'bg-slate-800' },
];

type Props = {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};


function AuthWrapper({ title, subtitle, children, footer }: Props) {
  return (
    <div className="grid min-h-svh bg-white lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:p-8">
      <aside className="relative hidden overflow-hidden rounded-3xl bg-primary lg:flex lg:items-center">
        {/* Soft light blobs for depth */}
        <div className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-white/10 blur-3xl" />

        <div className="relative px-14 xl:px-20">
          <h2 className="max-w-md text-4xl leading-tight text-white xl:text-5xl">
            Apprenez et codez avec votre communauté
          </h2>
          <ul className="mt-10 flex max-w-lg flex-wrap gap-3">
            {highlights.map(({ label, icon: Icon, iconClassName }) => (
              <li
                key={label}
                className="flex items-center gap-2.5 rounded-xl bg-white px-4 py-2.5 text-[15px] text-slate-800 shadow-sm"
              >
                <span className={`flex size-5 items-center justify-center rounded-md text-white ${iconClassName}`}>
                  <Icon className="size-3" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <NavLink to="/" title="Kodinga" className="inline-flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-slate-900 font-mono text-sm font-bold text-brand">
              K
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              kodinga<span className="text-brand">.</span>
            </span>
          </NavLink>

          <h1 className="mt-10 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
          {subtitle && <div className="mt-3 text-[15px] text-slate-500">{subtitle}</div>}

          <div className="mt-8">{children}</div>

          {footer && <div className="mt-8 text-center text-sm leading-relaxed text-slate-500">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

export default AuthWrapper;
