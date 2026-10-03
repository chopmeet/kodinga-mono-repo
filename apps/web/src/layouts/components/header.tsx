import { Check, ChevronDown, Globe, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';

import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kodinga-mono-repo/ui';
import { useAppSelector } from '@/redux/hook';
import { languages } from '@/utils/i18n';
import { isAdmin } from '@/utils/Utils';

const menuItems = [
  { id: 'home', titleKey: 'header.home', path: '/' },
  { id: 'blog', titleKey: 'header.blog', path: '/blog' },
] as const;

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
  const { token, user } = useAppSelector((s) => s.user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActivePath = (path: string) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path);

  const authLink = (onClick?: () => void) =>
    token ? (
      <Button asChild size="sm" className="w-full md:w-auto">
        <NavLink to={isAdmin(user) ? '/admin/dashboard' : '/'} onClick={onClick}>
          {t('header.mySpace')}
        </NavLink>
      </Button>
    ) : (
      <Button asChild size="sm" className="w-full bg-brand text-white hover:bg-brand-hover md:w-auto">
        <NavLink to="/login" onClick={onClick}>
          {t('header.login')}
        </NavLink>
      </Button>
    );

  return (
    <header className="sticky top-0 z-50 border-t-3 border-brand bg-white/95 shadow-sm backdrop-blur">
      {/* md+: 3 equal-sided columns so the links stay centered whatever the side widths */}
      <nav className="mx-auto flex h-[calc(4rem-3px)] max-w-[1440px] items-center justify-between gap-6 px-4 sm:px-6 md:grid md:grid-cols-[1fr_auto_1fr] lg:px-8">
        <NavLink to="/" title="Kodinga" className="flex items-center gap-2 justify-self-start">
          <span className="flex size-8 items-center justify-center rounded-lg bg-slate-900 font-mono text-sm font-bold text-brand">
            K
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">Kodinga</span>
        </NavLink>

        <ul className="hidden items-center gap-1 md:flex">
          {menuItems.map((item) => (
            <li key={item.id}>
              <NavLink
                to={item.path}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-100 hover:text-slate-900',
                  isActivePath(item.path) ? 'text-brand' : 'text-slate-600'
                )}
              >
                {t(item.titleKey)}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2 justify-self-end">
          <LanguageSwitcher />
          <div className="hidden md:block">{authLink()}</div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            className="inline-flex items-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus:ring-2 focus:ring-slate-200 focus:outline-none md:hidden"
          >
            <span className="sr-only">
              {mobileMenuOpen ? t('header.closeMenu') : t('header.openMenu')}
            </span>
            {mobileMenuOpen ? (
              <X aria-hidden className="size-6" />
            ) : (
              <Menu aria-hidden className="size-6" />
            )}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div id="mobile-menu" className="border-t border-slate-100 px-4 pt-2 pb-4 md:hidden">
          <ul className="flex flex-col gap-1">
            {menuItems.map((item) => (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'block rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100',
                    isActivePath(item.path) ? 'text-brand' : 'text-slate-700'
                  )}
                >
                  {t(item.titleKey)}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-3 px-3">{authLink(() => setMobileMenuOpen(false))}</div>
        </div>
      )}
    </header>
  );
}

export default Header;
