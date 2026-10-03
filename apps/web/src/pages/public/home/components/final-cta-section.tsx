import { Terminal, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';

export function FinalCtaSection() {
  return (
    <section className="border-t border-slate-200 bg-white px-4 py-14 sm:px-6 lg:px-8">
      <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-center text-white shadow-md sm:p-12">
        <div className="relative z-10 flex flex-col items-center gap-4">
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 font-mono text-xs font-bold tracking-widest text-brand-soft uppercase">
            [REJOIGNEZ LE MOUVEMENT // GRATUIT &amp; ACCESSIBLE]
          </span>
          <h2 className="max-w-xl text-2xl font-bold tracking-tight sm:text-4xl">
            Prêt à bâtir le futur tech de l'Afrique avec vos pairs ?
          </h2>
          <p className="max-w-lg text-sm leading-relaxed text-slate-300">
            Trouvez une guilde adaptée à votre stack ou devenez leader d'une communauté dans votre
            région. Inscription en 30 secondes avec GitHub ou Google.
          </p>

          <div className="mt-4 flex w-full max-w-md flex-wrap items-center justify-center gap-3">
            <Link
              to="/login"
              className="flex w-full flex-1 items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-xs font-semibold text-slate-900 transition-colors hover:bg-slate-100 sm:w-auto sm:text-sm"
            >
              <Terminal className="size-4.5" />
              <span>Continuer avec GitHub</span>
            </Link>
            <Link
              to="/login"
              className="flex w-full flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-brand-hover sm:w-auto sm:text-sm"
            >
              <UserPlus className="size-4.5" />
              <span>Créer une communauté</span>
            </Link>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-4 font-mono text-[11px] text-slate-400">
            <span>✓ 100% GRATUIT POUR LES APPRENANTS</span>
            <span>✓ MOBILE MONEY &amp; CRYPTO ACCEPTÉS</span>
          </div>
        </div>
      </div>
    </section>
  );
}
