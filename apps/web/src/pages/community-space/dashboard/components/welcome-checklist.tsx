import { BookOpenCheck, ChevronRight, Megaphone, PartyPopper, UserPlus, Wallet, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

import { canAccess, useCommunitySpace } from '../../community-space-context';

/** Shown once after the creation flow (?welcome=1): the first things to do in a new community */
function WelcomeChecklist() {
  const space = useCommunitySpace();
  const [params, setParams] = useSearchParams();
  if (params.get('welcome') !== '1') return null;

  const base = `/c/${space.community.slug}`;
  const tasks = [
    ...(canAccess(space, 'payments')
      ? [{ id: 'plans', icon: Wallet, label: 'Fixez le prix de vos formules', to: `${base}/payments/plans` }]
      : []),
    { id: 'rules', icon: BookOpenCheck, label: 'Écrivez les règles de la communauté', to: `${base}/settings/rules` },
    { id: 'post', icon: Megaphone, label: 'Publiez un message de bienvenue', to: `${base}/posts` },
    { id: 'members', icon: UserPlus, label: 'Invitez vos premiers membres', to: `${base}/members` },
  ];

  return (
    <section aria-labelledby="welcome-title" className="relative mb-6 rounded-2xl border border-brand/20 bg-brand/5 p-5">
      <button
        type="button"
        onClick={() => setParams({}, { replace: true })}
        aria-label="Masquer"
        className="absolute top-3 right-3 rounded-lg p-1.5 text-muted-foreground hover:bg-card hover:text-foreground"
      >
        <X className="size-4" />
      </button>
      <div className="flex items-center gap-2 text-brand">
        <PartyPopper className="size-5" />
        <h2 id="welcome-title" className="text-lg font-semibold text-foreground">
          {space.community.name} est en ligne !
        </h2>
      </div>
      <p className="mt-1 text-sm text-soft">Quelques étapes pour bien démarrer :</p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {tasks.map(({ id, icon: Icon, label, to }) => (
          <li key={id}>
            <Link to={to} className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 text-sm font-medium text-foreground shadow-2xs hover:text-brand">
              <Icon className="size-4 shrink-0 text-brand" />
              <span className="flex-1">{label}</span>
              <ChevronRight className="size-4 text-faint" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default WelcomeChecklist;
