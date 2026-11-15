import { ArrowLeft, Building2, CalendarClock, CheckCircle2, ExternalLink, Mail, MapPin, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Loader } from '@kodinga/ui';
import { experienceLabel, formatSalary, opportunityTypeLabel, workplaceLabel } from '@/pages/community-space/opportunities/opportunity-labels';
import { Markdown } from '@/pages/shared/markdown';
import type { OpportunityApplicationStatus } from '@/utils/api/opportunity/opportunity.type';
import { dateFormat as format } from '@/utils/format';
import { translatedStyles } from '@/utils/translated';
import UseOpportunityPage, { type ApplyValues, type OpportunityPage } from './form/UseOpportunityPage';

const longDate = (iso: string) => format({ day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));

// Seen by the candidate (the poster sees "Nouvelle" for a pending one)
const candidateStatus = translatedStyles<OpportunityApplicationStatus>('discover.offer.candidate.', {
  pending: 'bg-brand-subtle text-brand-strong',
  reviewing: 'bg-amber-50 text-amber-800',
  shortlisted: 'bg-violet-50 text-violet-800',
  accepted: 'bg-emerald-50 text-emerald-800',
  rejected: 'bg-muted text-soft',
});

const isUrl = (v: string) => !v.trim() || /^https?:\/\/\S+\.\S+/.test(v.trim());

function ApplyModal({ page, open, onClose }: { page: OpportunityPage; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [v, setV] = useState<ApplyValues>({ resume_url: '', cover_letter: '', portfolio_url: '' });
  const [error, setError] = useState<string | null>(null);
  const set = (changes: Partial<ApplyValues>) => setV((c) => ({ ...c, ...changes }));

  const send = async () => {
    if (!v.resume_url.trim() && !v.portfolio_url.trim() && !v.cover_letter.trim()) return setError(t('discover.offer.modal.needOne'));
    if (!isUrl(v.resume_url) || !isUrl(v.portfolio_url)) return setError(t('discover.offer.modal.httpsOnly'));
    setError(null);
    if (await page.apply({ resume_url: v.resume_url.trim(), cover_letter: v.cover_letter.trim(), portfolio_url: v.portfolio_url.trim() })) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !page.isApplying && onClose()}>
      <DialogContent position="top" className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('discover.offer.modal.title', { title: page.offer?.title })}</DialogTitle>
          <DialogDescription>{t('discover.offer.modal.description', { company: page.offer?.company_name })}</DialogDescription>
        </DialogHeader>
        <form
          id="apply-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex flex-col gap-3"
        >
          <label className="flex flex-col gap-1">
            <span className="custom-form-label">{t('discover.offer.modal.resume')}</span>
            <input type="url" value={v.resume_url} onChange={(e) => set({ resume_url: e.target.value })} placeholder="https://…/cv.pdf" className="custom-form-control bg-background px-4 py-2" />
            <span className="text-xs text-muted-foreground">{t('discover.offer.modal.resumeHelp')}</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="custom-form-label">{t('discover.offer.modal.portfolio')}</span>
            <input type="url" value={v.portfolio_url} onChange={(e) => set({ portfolio_url: e.target.value })} placeholder="https://github.com/…" className="custom-form-control bg-background px-4 py-2" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="custom-form-label">{t('discover.offer.modal.message')}</span>
            <textarea rows={6} value={v.cover_letter} onChange={(e) => set({ cover_letter: e.target.value })} placeholder={t('discover.offer.modal.messagePlaceholder')} className="custom-form-control bg-background px-4 py-2" />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={page.isApplying}>
            {t('common.actions.cancel')}
          </Button>
          <Button type="submit" form="apply-form" isLoading={page.isApplying}>
            {t('discover.offer.modal.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** What the visitor can do: sign in, apply (here, on the site of the company or by email), follow */
function ApplyCard({ page }: { page: OpportunityPage }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const o = page.offer;
  if (!o) return null;
  const status = page.application ? candidateStatus[page.application.status] : null;

  let body;
  if (page.isPoster) {
    body = <p className="text-sm text-soft">{t('discover.offer.poster')}</p>;
  } else if (page.hasApplied) {
    body = (
      <>
        <p className="flex items-center gap-2 font-semibold text-emerald-800">
          <CheckCircle2 className="size-5" /> {t('discover.offer.applied')}
        </p>
        {page.application && (
          <p className="text-sm text-soft">
            {t('discover.offer.appliedOn', { date: longDate(page.application.created_at) })}
            {status && (
              <>
                {' '}
                {t('discover.offer.status')} <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>{status.label}</span>
              </>
            )}
          </p>
        )}
      </>
    );
  } else if (!page.isOpen) {
    body = <p className="text-sm text-soft">{t('discover.offer.closed')}</p>;
  } else if (!page.signedIn) {
    body = (
      <Button asChild>
        <Link to={page.loginUrl}>{t('discover.offer.loginToApply')}</Link>
      </Button>
    );
  } else if (o.apply_url) {
    body = (
      <Button asChild>
        <a href={o.apply_url} target="_blank" rel="noreferrer">
          <ExternalLink /> {t('discover.offer.applyOnSite')}
        </a>
      </Button>
    );
  } else {
    body = (
      <>
        <Button onClick={() => setOpen(true)}>{t('discover.offer.apply')}</Button>
        {o.apply_email && (
          <a href={`mailto:${o.apply_email}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-strong hover:underline">
            <Mail className="size-4" /> {t('discover.offer.orWrite', { email: o.apply_email })}
          </a>
        )}
      </>
    );
  }

  return (
    <section aria-label={t('discover.offer.application')} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      {body}
      <ApplyModal page={page} open={open} onClose={() => setOpen(false)} />
    </section>
  );
}

/** /opportunities/:opportunitySlug — an offer shared in a community */
function OpportunityPageView() {
  const { t } = useTranslation();
  const page = UseOpportunityPage();
  const o = page.offer;

  if (page.isLoading) return <Loader inline className="py-24" message={t('discover.offer.loading')} />;
  if (!o) {
    return (
      <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-foreground">{page.notFound ? t('discover.offer.notFound') : t('discover.offer.loadFailed')}</h1>
        <Button asChild variant="outline">
          <Link to={page.back.to}>{t('common.actions.back')}</Link>
        </Button>
      </section>
    );
  }

  const salary = formatSalary(o);
  const facts = [
    { icon: MapPin, text: [workplaceLabel[o.workplace_type], o.location].filter(Boolean).join(' · ') },
    salary && { icon: Wallet, text: salary },
    o.expires_at && { icon: CalendarClock, text: t('discover.offer.until', { date: longDate(o.expires_at) }) },
  ].filter(Boolean) as { icon: typeof MapPin; text: string }[];

  return (
    <div className="min-h-full bg-subtle/60">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-285 px-4 py-8 sm:px-6 lg:px-8">
          <Link to={page.back.to} className="inline-flex items-center gap-2 text-sm text-soft hover:text-foreground">
            <ArrowLeft className="size-4" /> {page.back.label}
          </Link>
          <div className="mt-5 flex gap-4">
            {o.company_logo_url ? (
              <img src={o.company_logo_url} alt="" className="size-16 shrink-0 rounded-xl border border-border-soft object-cover" />
            ) : (
              <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-muted text-faint" aria-hidden>
                <Building2 className="size-8" />
              </span>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-brand-strong uppercase">
                {opportunityTypeLabel[o.opportunity_type] ?? o.opportunity_type}
                {experienceLabel[o.experience_level] && ` · ${experienceLabel[o.experience_level]}`}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{o.title}</h1>
              <p className="mt-1 text-soft">
                {o.company_website && /^https?:\/\//.test(o.company_website) ? (
                  <a href={o.company_website} target="_blank" rel="noreferrer" className="hover:text-brand-strong hover:underline">
                    {o.company_name}
                  </a>
                ) : (
                  o.company_name
                )}
              </p>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-soft">
                {facts.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-1.5">
                    <Icon className="size-4 text-faint" aria-hidden /> {text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-285 items-start gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_320px] lg:px-8">
        <article className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 sm:p-8">
          <section>
            <h2 className="text-lg font-semibold text-foreground">{t('discover.offer.role')}</h2>
            <div className="mt-3">{o.description ? <Markdown source={o.description} /> : <p className="text-muted-foreground">{t('discover.offer.noDescription')}</p>}</div>
          </section>
          {o.requirements && (
            <section>
              <h2 className="text-lg font-semibold text-foreground">{t('discover.offer.profile')}</h2>
              <div className="mt-3">
                <Markdown source={o.requirements} />
              </div>
            </section>
          )}
          {(o.technologies ?? []).length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-foreground">{t('discover.offer.technologies')}</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {(o.technologies ?? []).map((tech) => (
                  <li key={tech.id} className="rounded-full bg-brand-subtle px-3 py-1 text-sm font-medium text-brand-strong">
                    {tech.name}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
        <aside className="order-first lg:sticky lg:top-24 lg:order-none">
          <ApplyCard page={page} />
          <p className="mt-3 px-1 text-xs text-muted-foreground">
            {t('discover.offer.footer', { count: o.applications_count, date: longDate(o.created_at) })}
          </p>
        </aside>
      </div>
    </div>
  );
}

export default OpportunityPageView;
