import type {
  ExperienceLevel,
  OpportunityApplicationStatus,
  OpportunityListItem,
  OpportunityStatus,
  OpportunityType,
  WorkplaceType,
} from '@/utils/api/opportunity/opportunity.type';
import { numberFormat } from '@/utils/format';
import i18n from '@/utils/i18n';
import { translatedLabels, translatedStyles } from '@/utils/translated';

// Texts in locales/*/labels.ts, read in the current language
export const opportunityTypeLabel = translatedLabels<OpportunityType>('labels.opportunityType.', [
  'full_time',
  'part_time',
  'contract',
  'freelance',
  'internship',
  'bounty',
]);

export const workplaceLabel = translatedLabels<WorkplaceType>('labels.workplace.', ['remote', 'hybrid', 'onsite']);

export const experienceLabel = translatedLabels<ExperienceLevel>('labels.experience.', ['all', 'junior', 'mid', 'senior', 'lead']);

export const opportunityStatusStyle = translatedStyles<OpportunityStatus>('labels.opportunityStatus.', {
  open: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  draft: 'border-slate-200 bg-slate-50 text-slate-600',
  closed: 'border-slate-200 bg-slate-100 text-slate-500',
});

export const applicationStatusLabel = translatedLabels<OpportunityApplicationStatus>('labels.applicationStatus.', [
  'pending',
  'reviewing',
  'shortlisted',
  'accepted',
  'rejected',
]);

export const applicationStatusStyle: Record<OpportunityApplicationStatus, string> = {
  pending: 'border-blue-200 bg-blue-50 text-blue-700',
  reviewing: 'border-amber-200 bg-amber-50 text-amber-700',
  shortlisted: 'border-violet-200 bg-violet-50 text-violet-700',
  accepted: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rejected: 'border-red-200 bg-red-50 text-red-700',
};

const amount = (value: string) => numberFormat({ maximumFractionDigits: 0 }).format(Number(value));
const currencyLabel = (currency: string) => (currency === 'XOF' ? 'FCFA' : currency);

/** "300 000 – 500 000 FCFA", "À partir de 300 000 FCFA", "" when none */
export function formatSalary({ salary_min, salary_max, currency }: Pick<OpportunityListItem, 'salary_min' | 'salary_max' | 'currency'>) {
  const unit = currencyLabel(currency);
  if (salary_min && salary_max) return i18n.t('labels.salary.range', { min: amount(salary_min), max: amount(salary_max), unit });
  if (salary_min) return i18n.t('labels.salary.from', { min: amount(salary_min), unit });
  if (salary_max) return i18n.t('labels.salary.upTo', { max: amount(salary_max), unit });
  return '';
}

/** true once expires_at is past */
export const isExpired = (o: Pick<OpportunityListItem, 'expires_at'>) => !!o.expires_at && new Date(o.expires_at) < new Date();
