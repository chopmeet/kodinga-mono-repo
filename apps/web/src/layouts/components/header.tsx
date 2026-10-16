import { ArrowUpRight, Check, ChevronDown, Globe, Plus, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';

import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  SearchInput,
} from '@kodinga-mono-repo/ui';
import { useAppDispatch, useAppSelector } from '@/redux/hook';
import { onSetSearchQuery } from '@/redux/slice/Search.slice';
import { languages } from '@/utils/i18n';
import { isAdmin, scrollToResults } from '@/utils/Utils';

function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const current = languages.find((l) => l.code === i18n.resolvedLanguage) ?? languages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-[15px] font-medium text-slate-700" aria-label={t('header.language')}>
          <Globe className="size-4.5" />
          <span className="hidden sm:inline">{current.short}</span>
          <ChevronDown className="hidden size-4 opacity-70 sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onSelect={() => i18n.changeLanguage(lang.code)}
            className={cn(lang.code === current.code && 'font-semibold text-brand')}
          >
            <span className="w-6 font-mono text-xs">{lang.short}</span>
            <span>{lang.label}</span>
            {lang.code === current.code && <Check className="ml-auto size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Kodinga logo: blue "K" tile + wordmark (the wordmark hides when the search takes the room) */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <NavLink to="/" title="Kodinga" className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-lg font-bold text-white shadow-sm">K</span>
      {/* Phones: the "K" tile alone, so the actions fit */}
      <span className={cn('hidden text-2xl font-bold tracking-tight text-slate-900 sm:inline', compact && 'md:hidden lg:inline')}>
        kodinga<span className="text-primary">.</span>
      </span>
    </NavLink>
  );
}

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  cn('text-[15px] font-medium whitespace-nowrap transition-colors hover:text-slate-900', isActive ? 'text-slate-900' : 'text-slate-500');

function Header() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const dispatch = useAppDispatch();
  const { token, user } = useAppSelector((s) => s.user);
  const { query, heroSearchVisible } = useAppSelector((s) => s.search);

  // Home only: the hero search bar moves here once it has scrolled under the header
  const showSearch = pathname === '/' && !heroSearchVisible;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur-md">
      {/* 3 columns; on lg+ the side columns are equal so the middle stays centered */}
      <nav className="mx-auto grid h-[72px] max-w-[1440px] grid-cols-[auto_1fr_auto] items-center gap-3 px-4 sm:gap-6 sm:px-6 lg:grid-cols-[1fr_auto_1fr] lg:px-8">
        <div className="justify-self-start">
          <Logo compact={showSearch} />
        </div>

        <div role={showSearch ? 'search' : undefined} className="min-w-0 lg:w-[34rem]">
          {showSearch ? (
            <SearchInput
              id="header-search"
              size="md"
              className="animate-in duration-200 fade-in slide-in-from-top-2"
              label={t('header.search')}
              clearLabel={t('header.clearSearch')}
              placeholder={t('header.search')}
              value={query}
              onValueChange={(value) => dispatch(onSetSearchQuery(value))}
              onSubmit={scrollToResults}
              submitLabel={t('header.seeResults')}
            />
          ) : (
            <div className="hidden items-center justify-center gap-9 md:flex">
              <NavLink to="/" end className={navLinkClassName}>
                {t('header.explore')}
              </NavLink>
              {user?.username && (
                <NavLink to={`/profiles/${user.username}`} className={navLinkClassName}>
                  {t('header.profile')}
                </NavLink>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5 justify-self-end sm:gap-4">
          <LanguageSwitcher />
          {token ? (
            <NavLink
              to={isAdmin(user) ? '/admin/dashboard' : '/c'}
              aria-label={t('header.mySpace')}
              title={t('header.mySpace')}
              className="flex size-10 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <UserRound className="size-5" />
            </NavLink>
          ) : (
            <NavLink to="/auth/login" className="px-2 text-[15px] font-medium whitespace-nowrap text-slate-900 hover:text-primary">
              {t('header.login')}
            </NavLink>
          )}
          {/* Straight into the creation flow (open to visitors) */}
          <NavLink
            to="/create-community"
            aria-label={t('header.create')}
            className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-blue-900 px-3 text-[15px] font-semibold whitespace-nowrap text-white shadow-sm transition-colors hover:bg-blue-950 sm:px-5"
          >
            <Plus className="size-4 sm:hidden" />
            <span className="hidden sm:inline">{t('header.create')}</span>
            <ArrowUpRight className="hidden size-4 sm:block" />
          </NavLink>
        </div>
      </nav>
    </header>
  );
}

export default Header;
