import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { cn } from '@kodinga/ui';
import { useAppSelector } from '@/redux/hook';
import { languages } from '@/utils/i18n';
import { scrollToResults, useUser } from '@/utils/Utils';

type FooterLink = { label: string; to?: string; onClick?: () => void };

/** Ways to pay a paid community (PayDunya) */
const PAYMENTS = ['Orange Money', 'Wave', 'MTN MoMo', 'Moov Money', 'Carte bancaire'];

function Column({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <nav aria-label={title}>
      <h2 className="text-xs font-semibold tracking-[0.16em] text-blue-200/70 uppercase">{title}</h2>
      <ul className="mt-5 space-y-3 text-[15px]">
        {links.map((link) => (
          <li key={link.label}>
            {link.onClick ? (
              <button type="button" onClick={link.onClick} className="text-white/80 transition-colors hover:text-white">
                {link.label}
              </button>
            ) : (
              <Link to={link.to ?? '/'} className="text-white/80 transition-colors hover:text-white">
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

function FooterLogo() {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5" aria-label="Kodinga, accueil">
      <span className="flex size-10 items-center justify-center rounded-lg bg-white text-lg font-bold text-blue-900">K</span>
      <span className="text-2xl font-bold tracking-tight text-white">
        kodinga<span className="text-blue-300">.</span>
      </span>
    </Link>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return <li className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">{children}</li>;
}

/** Footer of the public pages: call to action, links, ways to pay, language */
function Footer() {
  const { i18n } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const signedIn = !!useAppSelector((s) => s.user.token);
  const user = useUser();
  const year = new Date().getFullYear();

  // "Explorer" scrolls to the directory of the home page (and goes there first from elsewhere)
  const explore = () => {
    if (pathname === '/') scrollToResults();
    else {
      navigate('/');
      setTimeout(scrollToResults, 300);
    }
  };

  const platform: FooterLink[] = [
    { label: 'Explorer les communautés', onClick: explore },
    { label: 'Créer une communauté', to: '/create-community' },
    { label: 'Hackathons & défis', to: '/hackathons' },
    { label: 'Offres & missions', to: '/opportunities' },
  ];
  const account: FooterLink[] = signedIn
    ? [
        { label: 'Mes communautés', to: '/dashboard/communities' },
        { label: 'Messages', to: '/messages' },
        ...(user?.username ? [{ label: 'Mon profil public', to: `/profiles/${user.username}` }] : []),
      ]
    : [
        { label: 'Se connecter', to: '/auth/login' },
        { label: 'Créer un compte', to: '/auth/register' },
        { label: 'Mot de passe oublié', to: '/auth/forgot-password' },
      ];

  return (
    <footer className="relative overflow-hidden bg-blue-950 text-white">
      {/* Soft light, like the hero of the home page */}
      <div aria-hidden className="pointer-events-none absolute -top-40 right-0 size-144 rounded-full bg-blue-600/25 blur-3xl" />

      <div className="relative mx-auto max-w-360 px-4 sm:px-6 lg:px-8">
        {/* Call to action */}
        <div className="flex flex-col items-start justify-between gap-6 border-b border-white/10 py-12 md:flex-row md:items-center">
          <div>
            <p className="text-2xl font-semibold tracking-tight sm:text-3xl">Votre communauté tech mérite son espace.</p>
            <p className="mt-2 text-white/70">Lancez-la en quelques minutes, gratuite ou payante, et réunissez les développeurs qui vous ressemblent.</p>
          </div>
          <Link
            to="/create-community"
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-lg bg-white px-6 font-semibold text-blue-950 shadow-sm transition-colors hover:bg-blue-50"
          >
            Créer une communauté <ArrowUpRight className="size-4" />
          </Link>
        </div>

        <div className="grid gap-12 py-14 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div className="max-w-sm">
            <FooterLogo />
            <p className="mt-5 leading-relaxed text-white/70">
              La plateforme d’échange des développeurs africains, par les développeurs : communautés, formations, événements, hackathons et opportunités.
            </p>
            <p className="mt-8 flex items-center gap-2 text-sm font-medium text-white/80">
              <ShieldCheck className="size-4 text-blue-300" aria-hidden /> Paiements sécurisés
            </p>
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Moyens de paiement">
              {PAYMENTS.map((p) => (
                <Pill key={p}>{p}</Pill>
              ))}
            </ul>
          </div>
          <Column title="Plateforme" links={platform} />
          <Column title={signedIn ? 'Mon espace' : 'Compte'} links={account} />
        </div>

        {/* Legal line: kept on the left, the bottom right corner belongs to the floating assistant */}
        <div className="flex flex-col gap-4 border-t border-white/10 py-6 text-sm text-white/60 sm:flex-row sm:items-center sm:gap-8 sm:pr-56">
          <p>
            © {year} Kodinga · Fait en Afrique, pour les développeurs d’Afrique <span aria-hidden>🌍</span>
          </p>
          <div className="flex items-center gap-1" role="group" aria-label="Langue">
            {languages.map((lang) => {
              const active = i18n.resolvedLanguage === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => i18n.changeLanguage(lang.code)}
                  aria-pressed={active}
                  title={lang.label}
                  className={cn('rounded-md px-2.5 py-1 text-xs font-semibold transition-colors', active ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white')}
                >
                  {lang.short}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
