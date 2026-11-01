// Same values as the api (apps/gamification/models/reputation.py)

/** LEVEL_THRESHOLDS; the level counts every point of the member, on all of Kodinga */
export const LEVELS: { level: number; title: string; from: number }[] = [
  { level: 1, title: 'Initié', from: 0 },
  { level: 2, title: 'Développeur', from: 50 },
  { level: 3, title: 'Praticien', from: 150 },
  { level: 4, title: 'Artisan du code', from: 350 },
  { level: 5, title: 'Expert', from: 750 },
  { level: 6, title: 'Mentor', from: 1500 },
  { level: 7, title: 'Architecte', from: 3000 },
  { level: 8, title: 'Légende Kodinga', from: 6000 },
];

export const pointsFormat = new Intl.NumberFormat('fr-FR');
