import type { ApplicationStatus, HackathonFormat, HackathonStatus } from '@/utils/api/hackathon/hackathon.type';
import { dateFormat } from '@/utils/format';
import { translatedLabels, translatedStyles } from '@/utils/translated';

// Texts in locales/*/labels.ts, read in the current language
export const hackathonStatusStyle = translatedStyles<HackathonStatus>('labels.hackathonStatus.', {
  draft: 'border-slate-200 bg-slate-50 text-slate-600',
  published: 'border-blue-200 bg-blue-50 text-blue-800',
  registration_open: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  registration_closed: 'border-sky-200 bg-sky-50 text-sky-800',
  in_progress: 'border-red-200 bg-red-50 text-red-700',
  submission_closed: 'border-violet-200 bg-violet-50 text-violet-800',
  judging: 'border-amber-200 bg-amber-50 text-amber-800',
  completed: 'border-slate-200 bg-slate-100 text-slate-700',
  cancelled: 'border-slate-200 bg-slate-50 text-slate-500',
});

export const hackathonFormatLabel = translatedLabels<HackathonFormat>('labels.hackathonFormat.', ['online', 'in_person', 'hybrid']);

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

export const formatDay = (iso: string) => dateFormat({ day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
export const formatDateTime = (iso: string) =>
  dateFormat({ day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
