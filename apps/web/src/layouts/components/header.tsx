import { ArrowUpRight, Check, ChevronDown, Globe, Plus } from 'lucide-react';
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
        <Button variant="ghost" size="sm" className="gap-1.5" aria-label={t('header.language')}>
          <Globe className="size-4" />
          <span className="font-mono text-xs font-semibold">{current.short}</span>
          <ChevronDown className="size-3 opacity-60" />
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

function Header() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const dispatch = useAppDispatch();
  const { token, user } = useAppSelector((s) => s.user);
  const { query, heroSearchVisible } = useAppSelector((s) => s.search);

  // Home only: the hero search bar moves here once it has scrolled under the header
  const showSearch = pathname === '/' && !heroSearchVisible;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
      {/* 3 columns; on md+ the side columns are equal so the search stays centered */}
      <nav className="mx-auto grid h-16 max-w-[1440px] grid-cols-[auto_1fr_auto] items-center gap-3 px-4 sm:gap-6 sm:px-6 md:grid-cols-[1fr_minmax(0,30rem)_1fr] lg:px-8">
        <NavLink to="/" title="Kodinga" className="flex items-center gap-2 justify-self-start">
          <span className="flex size-9 items-center justify-center rounded-xl bg-slate-900 font-mono text-base font-bold text-brand">
            K
          </span>
          <span
            className={cn(
              'text-xl font-bold tracking-tight text-slate-900',
              showSearch && 'hidden sm:inline'
            )}
          >
            kodinga<span className="text-brand">.</span>
          </span>
        </NavLink>

        <div role={showSearch ? 'search' : undefined} className="min-w-0">
          {showSearch && (
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
          )}
        </div>

        <div className="flex items-center gap-1 justify-self-end sm:gap-3">
          <LanguageSwitcher />
          {token ? (
            <NavLink
              to={isAdmin(user) ? '/admin/dashboard' : '/c'}
              className="hidden px-2 text-sm font-medium text-slate-900 hover:text-brand sm:block"
            >
              {t('header.mySpace')}
            </NavLink>
          ) : (
            <NavLink
              to="/auth/login"
              className="px-2 text-sm font-medium whitespace-nowrap text-slate-900 hover:text-brand"
            >
              {t('header.login')}
            </NavLink>
          )}
          {/* Plain anchor: from another page it loads home then jumps to the creators block */}
          <a
            href="/#creer"
            aria-label={t('header.create')}
            className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-brand px-3 whitespace-nowrap text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-hover sm:px-5"
          >
            <Plus className="size-4 sm:hidden" />
            <span className="hidden sm:inline">{t('header.create')}</span>
            <ArrowUpRight className="hidden size-4 sm:block" />
          </a>
        </div>
      </nav>
    </header>
  );
}

export default Header;
