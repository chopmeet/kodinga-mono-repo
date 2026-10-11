import { ArrowRight, Rocket } from 'lucide-react';
import { Link } from 'react-router-dom';

import { creatorSteps } from '@/data/home.data';

export function CreatorCallout() {
  return (
    <div
      id="creer"
      className="scroll-mt-36 rounded-xl border border-orange-200/80 bg-gradient-to-b from-orange-50/50 to-white p-5 shadow-2xs"
    >
      <div className="flex items-center gap-2 text-sm font-bold text-brand">
        <Rocket className="size-5" />
        <h4>Créateurs de communauté</h4>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
        Lancez votre propre guilde de développeurs africains en moins de 2 minutes.
      </p>

      <ol className="mt-4 space-y-3">
        {creatorSteps.map((step, i) => (
          <li key={step.title} className="flex items-start gap-3">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
              {i + 1}
            </div>
            <div>
              <h5 className="text-xs font-bold text-slate-900">{step.title}</h5>
              <p className="text-[11px] text-slate-500">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>

      <Link
        to="/create-community"
        className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-brand-hover"
      >
        <span>Lancer ma guilde Kodinga</span>
        <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
