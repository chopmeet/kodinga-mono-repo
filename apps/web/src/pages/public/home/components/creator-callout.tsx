import { ArrowUpRight, Rocket } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function CreatorCallout() {
  const { t } = useTranslation();
  return (
    <section id="creer" aria-labelledby="creer-title" className="scroll-mt-36 rounded-xl border border-brand-muted bg-brand-subtle/70 p-6">
      <span className="flex size-10 items-center justify-center rounded-lg bg-card text-primary shadow-2xs" aria-hidden>
        <Rocket className="size-5" />
      </span>
      <h2 id="creer-title" className="mt-5 text-lg font-bold text-foreground">
        {t('home.creator.title')}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-soft">{t('home.creator.text')}</p>
      <Link
        to="/create-community"
        className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-900 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-950"
      >
        {t('home.creator.button')}
        <ArrowUpRight className="size-4" />
      </Link>
    </section>
  );
}
