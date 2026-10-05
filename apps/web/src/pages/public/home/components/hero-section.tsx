import {
  Brain,
  Cloud,
  Code,
  Cog,
  Cpu,
  type LucideIcon,
  Shapes,
  ShieldCheck,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { useEffect, useRef } from 'react';

import { cn, SearchInput } from '@kodinga-mono-repo/ui';
import { type StackId, stacks } from '@/data/home.data';
import { useAppDispatch, useAppSelector } from '@/redux/hook';
import { onSetHeroSearchVisible, onSetSearchQuery } from '@/redux/slice/Search.slice';
import { scrollToResults } from '@/utils/Utils';

const HEADER_HEIGHT = 64;

const stackIcons: Record<StackId, LucideIcon> = {
  rust: Cog,
  'python-ai': Brain,
  'cloud-devops': Cloud,
  'web3-fintech': Wallet,
  'mobile-flutter': Smartphone,
  systems: Cpu,
  typescript: Code,
  cybersecurity: ShieldCheck,
};

type Props = {
  stack: StackId | null;
  onStackChange: (id: StackId | null) => void;
};

function StackChip({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors sm:h-12 sm:px-5 sm:text-[15px]',
        active
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900'
      )}
    >
      <Icon className="size-4.5" />
      {label}
    </button>
  );
}

export function HeroSection({ stack, onStackChange }: Props) {
  const query = useAppSelector((s) => s.search.query);
  const dispatch = useAppDispatch();
  const searchRef = useRef<HTMLDivElement>(null);

  // Tell the header when this search bar scrolls under it, so it shows its compact copy
  useEffect(() => {
    const el = searchRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => dispatch(onSetHeroSearchVisible(entry.isIntersecting)),
      { rootMargin: `-${HEADER_HEIGHT}px 0px 0px 0px` }
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      dispatch(onSetHeroSearchVisible(true));
    };
  }, [dispatch]);

  return (
    <section className="bg-linear-to-b from-stone-100/80 via-stone-50 to-white px-4 pt-14 pb-10 sm:px-6 sm:pt-20 sm:pb-12 lg:px-8">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center text-center">
        <h1 className="max-w-4xl text-3xl leading-[1.1] font-bold tracking-tight text-slate-900 sm:text-5xl">
          Trouvez votre{' '}
          <span className="text-primary">communauté tech</span>
        </h1>

        <div ref={searchRef} role="search" className="mt-9 w-full max-w-3xl">
          <SearchInput
            id="community-search"
            size="lg"
            label="Rechercher une communauté"
            clearLabel="Effacer la recherche"
            placeholder="Une stack, une ville, une communauté…"
            value={query}
            onValueChange={(value) => dispatch(onSetSearchQuery(value))}
            onSubmit={scrollToResults}
            submitLabel="Voir les résultats"
          />
        </div>

        <div className="mt-8 flex max-w-5xl flex-wrap justify-center gap-2.5 sm:gap-3">
          <StackChip active={stack === null} icon={Shapes} label="Tout explorer" onClick={() => onStackChange(null)} />
          {stacks.map((s) => (
            <StackChip
              key={s.id}
              active={stack === s.id}
              icon={stackIcons[s.id]}
              label={s.label}
              onClick={() => onStackChange(stack === s.id ? null : s.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
