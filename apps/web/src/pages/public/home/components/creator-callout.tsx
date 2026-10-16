import { ArrowUpRight, Rocket } from 'lucide-react';
import { Link } from 'react-router-dom';

export function CreatorCallout() {
  return (
    <section id="creer" aria-labelledby="creer-title" className="scroll-mt-36 rounded-xl border border-blue-100 bg-blue-50/70 p-6">
      <span className="flex size-10 items-center justify-center rounded-lg bg-white text-primary shadow-2xs" aria-hidden>
        <Rocket className="size-5" />
      </span>
      <h2 id="creer-title" className="mt-5 text-lg font-bold text-slate-900">
        Et si vous créiez la vôtre ?
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">Rassemblez les bonnes personnes autour de ce qui vous passionne.</p>
      <Link
        to="/create-community"
        className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-900 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-950"
      >
        Créer ma communauté
        <ArrowUpRight className="size-4" />
      </Link>
    </section>
  );
}
