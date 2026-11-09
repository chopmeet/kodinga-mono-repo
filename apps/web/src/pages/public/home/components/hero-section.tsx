import {
  Brain,
  Cloud,
  Code,
  Cog,
  Cpu,
  type LucideIcon,
  ArrowRight,
  ChevronDown,
  Search,
  Shapes,
  ShieldCheck,
  Smartphone,
  Users,
  Wallet,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { cn, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@kodinga/ui';
import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import { type StackId, stacks } from '@/data/home.data';
import { useAppDispatch, useAppSelector } from '@/redux/hook';
import { onSetHeroSearchVisible, onSetSearchQuery } from '@/redux/slice/Search.slice';
import { scrollToResults } from '@/utils/Utils';

const HEADER_HEIGHT = 72;
// Stacks shown as buttons (after "Tout explorer"); the others go into "Plus…" so the row never wraps
const VISIBLE_STACKS = 4;

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
        'flex h-11 shrink-0 items-center gap-2 rounded-lg border px-4 text-sm font-medium whitespace-nowrap shadow-2xs transition-colors sm:h-12 sm:px-5 sm:text-[15px]',
        active
          ? 'border-blue-900 bg-blue-900 text-white'
          : 'border-white/80 bg-white/85 text-slate-700 backdrop-blur hover:border-slate-200 hover:text-slate-900'
      )}
    >
      <Icon className="size-4.5" />
      {label}
    </button>
  );
}

export function HeroSection({ stack, onStackChange }: Props) {
  const { t } = useTranslation();
  const label = (id: StackId) => t(`home.stacks.${id}`);
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
    <section className="relative isolate overflow-hidden px-4 pt-16 pb-14 sm:px-6 sm:pt-20 sm:pb-16 lg:px-8">
      <GlassBackdrop className="-z-10" />
      <div className="mx-auto flex max-w-[1440px] flex-col items-center text-center">
        <p className="md:flex items-center gap-2.5 text-xs font-semibold tracking-[0.2em] text-slate-600 uppercase hidden">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden />
          {t('home.hero.eyebrow')}
        </p>
        <h1 className="mt-6 max-w-6xl text-4xl leading-[1.05] font-bold tracking-tight text-balance text-slate-900 sm:text-5xl lg:text-6xl 2xl:text-7xl">
          {t('home.hero.titleStart')} <span className="text-primary">{t('home.hero.titleHighlight')}</span>
        </h1>

        <div ref={searchRef} role="search" className="mt-10 w-full max-w-3xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              scrollToResults();
            }}
            className="flex items-center gap-3 rounded-xl border border-white/80 bg-white/95 p-2 pl-5 shadow-lg shadow-blue-900/5"
          >
            <Search className="size-5 shrink-0 text-slate-500" aria-hidden />
            <input
              id="community-search"
              type="search"
              aria-label={t('home.hero.searchLabel')}
              placeholder={t('home.hero.searchPlaceholder')}
              value={query}
              onChange={(e) => dispatch(onSetSearchQuery(e.target.value))}
              className="h-12 min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-500"
            />
            <button
              type="submit"
              aria-label={t('home.hero.seeResults')}
              className="flex h-12 shrink-0 items-center gap-2 rounded-lg bg-blue-900 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-blue-950"
            >
              <span className="hidden sm:inline">{t('home.hero.explore')}</span>
              <ArrowRight className="size-4.5" />
            </button>
          </form>
        </div>

        {/* Shrinks to its content: centered when it fits, scrolls from the start when it does not */}
        <div className="no-scrollbar mx-auto mt-7 flex w-fit max-w-full gap-2.5 overflow-x-auto px-1 py-1 sm:gap-3">
          <StackChip active={stack === null} icon={Shapes} label={t('home.hero.exploreAll')} onClick={() => onStackChange(null)} />
          {stacks.slice(0, VISIBLE_STACKS).map((s) => (
            <StackChip
              key={s.id}
              active={stack === s.id}
              icon={stackIcons[s.id]}
              label={label(s.id)}
              onClick={() => onStackChange(stack === s.id ? null : s.id)}
            />
          ))}
          {stacks.length > VISIBLE_STACKS && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  'flex h-11 shrink-0 items-center gap-2 rounded-lg border px-4 text-sm font-medium whitespace-nowrap shadow-2xs transition-colors sm:h-12 sm:px-5 sm:text-[15px]',
                  stacks.slice(VISIBLE_STACKS).some((s) => s.id === stack)
                    ? 'border-blue-900 bg-blue-900 text-white'
                    : 'border-white/80 bg-white/85 text-slate-700 backdrop-blur hover:border-slate-200 hover:text-slate-900'
                )}
              >
                {stack && stacks.slice(VISIBLE_STACKS).some((s) => s.id === stack) ? label(stack) : t('home.hero.more')}
                <ChevronDown className="size-4" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {stacks.slice(VISIBLE_STACKS).map((s) => {
                  const Icon = stackIcons[s.id];
                  return (
                    <DropdownMenuItem key={s.id} onSelect={() => onStackChange(stack === s.id ? null : s.id)}>
                      <Icon />
                      {label(s.id)}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <p className="mt-10 flex items-center gap-2 text-sm text-slate-500">
          <Users className="size-4" aria-hidden />
          {t('home.hero.tagline')}
        </p>
      </div>
    </section>
  );
}
