import type {
  ExperienceLevel,
  OpportunityApplicationStatus,
  OpportunityListItem,
  OpportunityStatus,
  OpportunityType,
  WorkplaceType,
} from '@/utils/api/opportunity/opportunity.type';

export const opportunityTypeLabel: Record<OpportunityType, string> = {
  full_time: 'CDI / temps plein',
  part_time: 'Temps partiel',
  contract: 'CDD / contrat',
  freelance: 'Freelance',
  internship: 'Stage',
  bounty: 'Bounty',
};

export const workplaceLabel: Record<WorkplaceType, string> = {
  remote: 'Télétravail',
  hybrid: 'Hybride',
  onsite: 'Sur site',
};

export const experienceLabel: Record<ExperienceLevel, string> = {
  all: 'Tous niveaux',
  junior: 'Junior',
  mid: 'Confirmé',
  senior: 'Senior',
  lead: 'Lead',
};

export const opportunityStatusStyle: Record<OpportunityStatus, { label: string; className: string }> = {
  open: { label: 'Ouverte', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  draft: { label: 'Brouillon', className: 'border-slate-200 bg-slate-50 text-slate-600' },
  closed: { label: 'Clôturée', className: 'border-slate-200 bg-slate-100 text-slate-500' },
};

export const applicationStatusLabel: Record<OpportunityApplicationStatus, string> = {
  pending: 'Nouvelle',
  reviewing: 'En cours d’examen',
  shortlisted: 'Présélectionnée',
  accepted: 'Retenue',
  rejected: 'Refusée',
};

export const applicationStatusStyle: Record<OpportunityApplicationStatus, string> = {
  pending: 'border-blue-200 bg-blue-50 text-blue-700',
  reviewing: 'border-amber-200 bg-amber-50 text-amber-700',
  shortlisted: 'border-violet-200 bg-violet-50 text-violet-700',
  accepted: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rejected: 'border-red-200 bg-red-50 text-red-700',
};

const amount = (value: string) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(value));
const currencyLabel = (currency: string) => (currency === 'XOF' ? 'FCFA' : currency);

/** "300 000 – 500 000 FCFA", "À partir de 300 000 FCFA", "" when none */
export function formatSalary({ salary_min, salary_max, currency }: Pick<OpportunityListItem, 'salary_min' | 'salary_max' | 'currency'>) {
  const unit = currencyLabel(currency);
  if (salary_min && salary_max) return `${amount(salary_min)} – ${amount(salary_max)} ${unit}`;
  if (salary_min) return `À partir de ${amount(salary_min)} ${unit}`;
  if (salary_max) return `Jusqu’à ${amount(salary_max)} ${unit}`;
  return '';
}

/** true once expires_at is past */
export const isExpired = (o: Pick<OpportunityListItem, 'expires_at'>) => !!o.expires_at && new Date(o.expires_at) < new Date();
