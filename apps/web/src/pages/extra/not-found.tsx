import { ArrowLeft, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { Button } from '@kodinga/ui';
import { Logo } from '@/layouts/components/header';


function NotFound() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Opened from a link outside the app (or typed): no page to go back to, the home page instead
  const canGoBack = window.history.state?.idx > 0;

  return (
    <div className="flex min-h-svh flex-col bg-slate-50">
      <header className="mx-auto flex h-20 w-full max-w-6xl items-center px-4 sm:px-6">
        <Logo />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-16 text-center">
        <img src="/images/not-found.svg" alt={t('common.notFound.illustration')} className="w-full max-w-md sm:max-w-lg" />
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl">{t('common.notFound.title')}</h1>
          <p className="mt-3 text-slate-600">{t('common.notFound.text')}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {canGoBack && (
            <Button variant="outline" className="h-11" onClick={() => navigate(-1)}>
              <ArrowLeft /> {t('common.notFound.back')}
            </Button>
          )}
          <Button asChild className="h-11">
            <Link to="/">
              <Home /> {t('common.notFound.home')}
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}

export default NotFound;
