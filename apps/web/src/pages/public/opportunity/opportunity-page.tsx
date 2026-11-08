import { ArrowLeft, Building2, CalendarClock, CheckCircle2, ExternalLink, Mail, MapPin, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Loader } from '@kodinga/ui';
import { experienceLabel, formatSalary, opportunityTypeLabel, workplaceLabel } from '@/pages/community-space/opportunities/opportunity-labels';
import { Markdown } from '@/pages/shared/markdown';
import type { OpportunityApplicationStatus } from '@/utils/api/opportunity/opportunity.type';
import UseOpportunityPage, { type ApplyValues, type OpportunityPage } from './form/UseOpportunityPage';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

// Seen by the candidate (the poster sees "Nouvelle" for a pending one)
const candidateStatus: Record<OpportunityApplicationStatus, { label: string; className: string }> = {
  pending: { label: 'Envoyée', className: 'bg-blue-50 text-blue-900' },
  reviewing: { label: 'En cours d’examen', className: 'bg-amber-50 text-amber-800' },
  shortlisted: { label: 'Présélectionnée', className: 'bg-violet-50 text-violet-800' },
  accepted: { label: 'Retenue', className: 'bg-emerald-50 text-emerald-800' },
  rejected: { label: 'Non retenue', className: 'bg-slate-100 text-slate-600' },
};

const isUrl = (v: string) => !v.trim() || /^https?:\/\/\S+\.\S+/.test(v.trim());

function ApplyModal({ page, open, onClose }: { page: OpportunityPage; open: boolean; onClose: () => void }) {
  const [v, setV] = useState<ApplyValues>({ resume_url: '', cover_letter: '', portfolio_url: '' });
  const [error, setError] = useState<string | null>(null);
  const set = (changes: Partial<ApplyValues>) => setV((c) => ({ ...c, ...changes }));

  const send = async () => {
    if (!v.resume_url.trim() && !v.portfolio_url.trim() && !v.cover_letter.trim()) return setError('Ajoutez au moins votre CV, un portfolio ou un message.');
    if (!isUrl(v.resume_url) || !isUrl(v.portfolio_url)) return setError('Les liens doivent commencer par https://');
    setError(null);
    if (await page.apply({ resume_url: v.resume_url.trim(), cover_letter: v.cover_letter.trim(), portfolio_url: v.portfolio_url.trim() })) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !page.isApplying && onClose()}>
      <DialogContent position="top" className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Postuler : {page.offer?.title}</DialogTitle>
          <DialogDescription>{page.offer?.company_name} reçoit votre candidature et vous répond par notification.</DialogDescription>
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
            <span className="custom-form-label">Lien vers votre CV</span>
            <input type="url" value={v.resume_url} onChange={(e) => set({ resume_url: e.target.value })} placeholder="https://…/cv.pdf" className="custom-form-control bg-background px-4 py-2" />
            <span className="text-xs text-slate-500">Google Drive, Dropbox, site personnel… (lien public).</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="custom-form-label">Portfolio ou GitHub</span>
            <input type="url" value={v.portfolio_url} onChange={(e) => set({ portfolio_url: e.target.value })} placeholder="https://github.com/…" className="custom-form-control bg-background px-4 py-2" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="custom-form-label">Message au recruteur</span>
            <textarea rows={6} value={v.cover_letter} onChange={(e) => set({ cover_letter: e.target.value })} placeholder="Pourquoi ce poste, ce que vous apportez…" className="custom-form-control bg-background px-4 py-2" />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={page.isApplying}>
            Annuler
          </Button>
          <Button type="submit" form="apply-form" isLoading={page.isApplying}>
            Envoyer ma candidature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** What the visitor can do: sign in, apply (here, on the site of the company or by email), follow */
function ApplyCard({ page }: { page: OpportunityPage }) {
  const [open, setOpen] = useState(false);
  const o = page.offer;
  if (!o) return null;
  const status = page.application ? candidateStatus[page.application.status] : null;

  let body;
  if (page.isPoster) {
    body = <p className="text-sm text-slate-600">Vous avez publié cette offre : les candidatures se gèrent dans l’espace de la communauté.</p>;
  } else if (page.hasApplied) {
    body = (
      <>
        <p className="flex items-center gap-2 font-semibold text-emerald-800">
          <CheckCircle2 className="size-5" /> Candidature envoyée
        </p>
        {page.application && (
          <p className="text-sm text-slate-600">
            Le {dateFormat.format(new Date(page.application.created_at))}.
            {status && (
              <>
                {' '}
                Statut : <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>{status.label}</span>
              </>
            )}
          </p>
        )}
      </>
    );
  } else if (!page.isOpen) {
    body = <p className="text-sm text-slate-600">Cette offre n’accepte plus de candidatures.</p>;
  } else if (!page.signedIn) {
    body = (
      <Button asChild>
        <Link to={page.loginUrl}>Se connecter pour postuler</Link>
      </Button>
    );
  } else if (o.apply_url) {
    body = (
      <Button asChild>
        <a href={o.apply_url} target="_blank" rel="noreferrer">
          <ExternalLink /> Postuler sur le site
        </a>
      </Button>
    );
  } else {
    body = (
      <>
        <Button onClick={() => setOpen(true)}>Postuler</Button>
        {o.apply_email && (
          <a href={`mailto:${o.apply_email}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-900 hover:underline">
            <Mail className="size-4" /> ou écrire à {o.apply_email}
          </a>
        )}
      </>
    );
  }

  return (
    <section aria-label="Candidature" className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5">
      {body}
      <ApplyModal page={page} open={open} onClose={() => setOpen(false)} />
    </section>
  );
}

/** /opportunities/:opportunitySlug — an offer shared in a community */
function OpportunityPageView() {
  const page = UseOpportunityPage();
  const o = page.offer;

  if (page.isLoading) return <Loader inline className="py-24" message="Chargement de l’offre…" />;
  if (!o) {
    return (
      <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-slate-900">{page.notFound ? 'Offre introuvable' : 'Impossible de charger l’offre'}</h1>
        <Button asChild variant="outline">
          <Link to={page.back.to}>Retour</Link>
        </Button>
      </section>
    );
  }

  const salary = formatSalary(o);
  const facts = [
    { icon: MapPin, text: [workplaceLabel[o.workplace_type], o.location].filter(Boolean).join(' · ') },
    salary && { icon: Wallet, text: salary },
    o.expires_at && { icon: CalendarClock, text: `Jusqu’au ${dateFormat.format(new Date(o.expires_at))}` },
  ].filter(Boolean) as { icon: typeof MapPin; text: string }[];

  return (
    <div className="min-h-full bg-slate-50/60">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-285 px-4 py-8 sm:px-6 lg:px-8">
          <Link to={page.back.to} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="size-4" /> {page.back.label}
          </Link>
          <div className="mt-5 flex gap-4">
            {o.company_logo_url ? (
              <img src={o.company_logo_url} alt="" className="size-16 shrink-0 rounded-xl border border-slate-100 object-cover" />
            ) : (
              <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400" aria-hidden>
                <Building2 className="size-8" />
              </span>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-blue-900 uppercase">
                {opportunityTypeLabel[o.opportunity_type] ?? o.opportunity_type}
                {experienceLabel[o.experience_level] && ` · ${experienceLabel[o.experience_level]}`}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{o.title}</h1>
              <p className="mt-1 text-slate-600">
                {o.company_website && /^https?:\/\//.test(o.company_website) ? (
                  <a href={o.company_website} target="_blank" rel="noreferrer" className="hover:text-blue-900 hover:underline">
                    {o.company_name}
                  </a>
                ) : (
                  o.company_name
                )}
              </p>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
                {facts.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-1.5">
                    <Icon className="size-4 text-slate-400" aria-hidden /> {text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-285 items-start gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_320px] lg:px-8">
        <article className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">Le poste</h2>
            <div className="mt-3">{o.description ? <Markdown source={o.description} /> : <p className="text-slate-500">Pas de description.</p>}</div>
          </section>
          {o.requirements && (
            <section>
              <h2 className="text-lg font-semibold text-slate-900">Profil recherché</h2>
              <div className="mt-3">
                <Markdown source={o.requirements} />
              </div>
            </section>
          )}
          {o.technologies.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-slate-900">Technologies</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {o.technologies.map((t) => (
                  <li key={t.id} className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-900">
                    {t.name}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
        <aside className="order-first lg:sticky lg:top-24 lg:order-none">
          <ApplyCard page={page} />
          <p className="mt-3 px-1 text-xs text-slate-500">
            {o.applications_count} candidature{o.applications_count > 1 ? 's' : ''} · publiée le {dateFormat.format(new Date(o.created_at))}
          </p>
        </aside>
      </div>
    </div>
  );
}

export default OpportunityPageView;
