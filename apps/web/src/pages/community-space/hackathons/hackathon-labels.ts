import type { ApplicationStatus, HackathonFormat, HackathonStatus } from '@/utils/api/hackathon/hackathon.type';

export const hackathonStatusStyle: Record<HackathonStatus, { label: string; className: string }> = {
  draft: { label: 'Brouillon', className: 'border-slate-200 bg-slate-50 text-slate-600' },
  published: { label: 'Publié', className: 'border-blue-200 bg-blue-50 text-blue-800' },
  registration_open: { label: 'Inscriptions ouvertes', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  registration_closed: { label: 'Inscriptions closes', className: 'border-sky-200 bg-sky-50 text-sky-800' },
  in_progress: { label: 'En cours', className: 'border-red-200 bg-red-50 text-red-700' },
  submission_closed: { label: 'Soumissions closes', className: 'border-violet-200 bg-violet-50 text-violet-800' },
  judging: { label: 'Évaluation', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  completed: { label: 'Terminé', className: 'border-slate-200 bg-slate-100 text-slate-700' },
  cancelled: { label: 'Annulé', className: 'border-slate-200 bg-slate-50 text-slate-500' },
};

export const hackathonFormatLabel: Record<HackathonFormat, string> = {
  online: 'En ligne',
  in_person: 'Présentiel',
  hybrid: 'Hybride',
};

export const applicationStatusStyle: Record<ApplicationStatus, { label: string; className: string }> = {
  pending: { label: 'En attente', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  accepted: { label: 'Acceptée', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  rejected: { label: 'Refusée', className: 'border-red-200 bg-red-50 text-red-700' },
  waitlisted: { label: "Liste d'attente", className: 'border-sky-200 bg-sky-50 text-sky-800' },
  withdrawn: { label: 'Retirée', className: 'border-slate-200 bg-slate-50 text-slate-500' },
};

/**
 * The step that usually follows each status (button "étape suivante"); "draft" goes through the
 * publish endpoint, the others through lifecycle/. Completed and cancelled are final.
 */
export const NEXT_STEP: Partial<Record<HackathonStatus, { status: HackathonStatus; label: string }>> = {
  draft: { status: 'published', label: 'Publier' },
  published: { status: 'registration_open', label: 'Ouvrir les inscriptions' },
  registration_open: { status: 'registration_closed', label: 'Clore les inscriptions' },
  registration_closed: { status: 'in_progress', label: 'Lancer le hackathon' },
  in_progress: { status: 'submission_closed', label: 'Clore les soumissions' },
  submission_closed: { status: 'judging', label: "Lancer l'évaluation" },
  judging: { status: 'completed', label: 'Terminer le hackathon' },
};

export const isFinal = (status: HackathonStatus) => status === 'completed' || status === 'cancelled';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const formatDay = (iso: string) => dayFormat.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));
