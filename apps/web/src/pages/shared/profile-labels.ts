import type { AvailabilityStatus, EmploymentType, SkillLevel } from '@/utils/api/profile/profile.type';

// Labels of the developer profile, shared by /account and the public profile

export const availabilityLabel: Record<AvailabilityStatus, string> = {
  available: 'Disponible',
  open_to_offers: 'À l’écoute des offres',
  busy: 'Occupé',
  unavailable: 'Non disponible',
};

export const skillLevelLabel: Record<SkillLevel, string> = {
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  advanced: 'Avancé',
  expert: 'Expert',
};

export const employmentLabel: Record<EmploymentType, string> = {
  full_time: 'Temps plein',
  part_time: 'Temps partiel',
  freelance: 'Freelance',
  contract: 'CDD / Prestation',
  internship: 'Stage / Alternance',
  apprenticeship: 'Apprentissage',
};

const monthYear = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' });

/** "mars 2022 – aujourd’hui" */
export function period(start: string, end: string | null, current: boolean) {
  const from = monthYear.format(new Date(start));
  return `${from} – ${current || !end ? 'aujourd’hui' : monthYear.format(new Date(end))}`;
}
