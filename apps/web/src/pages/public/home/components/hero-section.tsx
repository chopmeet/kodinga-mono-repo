import { Flame, Plus } from 'lucide-react';

import { heroStats } from '@/data/home.data';

export function HeroSection() {
  return (
    <section className="border-b border-slate-200 bg-linear-to-b from-slate-50/70 via-white to-white px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center text-center">
        <h1 className="max-w-4xl text-3xl leading-[1.15] font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
          Trouvez votre <span className="text-brand">communauté tech</span> africaine.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
          Rejoignez des guildes par stack, apprenez ensemble avec les parcours LMS intégrés,
          participez à des sessions live et montez en compétences au contact des meilleurs
          ingénieurs du continent.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href="#creer"
            className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-hover hover:shadow"
          >
            <Plus className="size-4.5" />
            <span>Créer une communauté</span>
          </a>
          <a
            href="#grille-communautes"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-2xs transition-all hover:bg-slate-50"
          >
            <Flame className="size-4.5 text-brand" />
            <span>Voir les plus actives</span>
          </a>
        </div>

        <div className="mt-8 flex w-full max-w-2xl flex-wrap items-center justify-center gap-4 border-t border-slate-100 pt-6 font-mono text-xs text-slate-500 sm:gap-8">
          {heroStats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${stat.dotClassName}`} />
              <span>
                <strong className="font-semibold text-slate-900">{stat.value}</strong>{' '}
                {stat.label}
              </span>
            </div>
          ))}
          <div className="hidden items-center gap-1.5 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>100% axé tech &amp; ingénierie</span>
          </div>
        </div>
      </div>
    </section>
  );
}
