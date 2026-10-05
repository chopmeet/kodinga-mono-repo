// Mock data for the community details page, derived from the home communities.
// Replace with RTK Query endpoints once the api exposes them.
import { communities, type Community } from './home.data';

export type CommunityPost = {
  id: string;
  author: string;
  city: string;
  postedAt: string;
  category: string;
  title: string;
  excerpt: string;
  likes: number;
  comments: number;
  pinned?: boolean;
};

export type CommunityModule = {
  id: string;
  title: string;
  lessons: number;
  durationMin: number;
  preview: boolean;
};

export type CommunityEvent = {
  id: string;
  title: string;
  startsAt: string;
  durationMin: number;
  kind: 'Live' | 'Atelier' | 'AMA';
};

export type CommunityDetails = Community & {
  owner: { name: string; role: string };
  admins: number;
  about: string[];
  perks: string[];
  rules: string[];
  posts: CommunityPost[];
  modules: CommunityModule[];
  events: CommunityEvent[];
};

const owners: Record<string, CommunityDetails['owner']> = {
  'python-africa-core': { name: 'Moussa Diallo', role: 'Staff Engineer, Dakar' },
  'lagos-ai-data': { name: 'Chidi Okafor', role: 'ML Lead, Lagos' },
  'dakar-devops': { name: 'Awa Ndiaye', role: 'SRE, Dakar' },
  'nairobi-rustaceans': { name: 'Wanjiru Kamau', role: 'Systems Engineer, Nairobi' },
  'frontend-francophone': { name: 'Yao Kouassi', role: 'Design Systems, Abidjan' },
  'african-kernel-lab': { name: 'Tunde Bakare', role: 'Kernel Developer, Ibadan' },
  'solidity-web3-africa': { name: 'Amina Yusuf', role: 'Smart Contract Auditor, Accra' },
  'kigali-embedded': { name: 'Jean-Luc Habimana', role: 'Embedded Lead, Kigali' },
  'africode-mentorship': { name: 'Fatou Sow', role: 'Engineering Manager, Remote' },
};

const perksByAccess: Record<Community['access']['kind'], string[]> = {
  free: [
    'Accès complet au fil de discussion et aux archives',
    'Sessions live hebdomadaires avec les membres seniors',
    'Parcours de formation en libre accès',
    'Badges et XP sur le leaderboard continental',
  ],
  paid: [
    'Tout ce qui est inclus dans les guildes gratuites',
    'Revues de code et mentorat en petit groupe',
    'Formations avancées et projets encadrés',
    'Accès prioritaire aux offres et bounties partenaires',
  ],
  application: [
    'Cohortes restreintes, sélection sur dossier technique',
    'Encadrement par des ingénieurs systèmes expérimentés',
    'Contributions open source accompagnées',
    'Réseau privé de pairs et de recruteurs',
  ],
};

const rules = [
  'Bienveillance et respect, en français comme en anglais',
  'Pas de spam ni d’autopromotion hors du canal dédié',
  'Partagez du code reproductible quand vous demandez de l’aide',
  'Les offres d’emploi passent par le canal #jobs',
];

function buildDetails(c: Community): CommunityDetails {
  const [place, mainTech = 'la stack', secondTech = 'les bonnes pratiques'] = c.tags;

  return {
    ...c,
    owner: owners[c.id] ?? { name: 'Équipe Kodinga', role: 'Modération' },
    admins: 3 + (c.members % 5),
    about: [
      c.description,
      `${c.name} réunit des développeurs de ${place === 'Pan-Africa' ? 'tout le continent' : place} autour de ${mainTech} et ${secondTech}. On y partage des retours d’expérience concrets, des revues de code et des projets menés en production.`,
      'Chaque semaine : une session live, un défi technique et un fil d’entraide modéré par les admins. Les nouveaux membres sont accompagnés dès leur arrivée.',
    ],
    perks: perksByAccess[c.access.kind],
    rules,
    posts: [
      {
        id: 'welcome',
        author: owners[c.id]?.name ?? 'Équipe Kodinga',
        city: 'Admin',
        postedAt: 'Épinglé',
        category: 'Annonces',
        title: 'Bienvenue ! Présentez-vous en commentaire 👋',
        excerpt: 'Dites-nous d’où vous venez, sur quoi vous travaillez et ce que vous aimeriez apprendre ici.',
        likes: 214,
        comments: 389,
        pinned: true,
      },
      {
        id: 'retex',
        author: 'Kofi Mensah',
        city: 'Accra',
        postedAt: 'il y a 2 h',
        category: 'Retour d’expérience',
        title: `Ce qu’on a appris en passant ${mainTech} en production`,
        excerpt: 'Monitoring, coûts, erreurs de débutant : notre bilan après six mois, chiffres à l’appui.',
        likes: 87,
        comments: 23,
      },
      {
        id: 'help',
        author: 'Aïcha Traoré',
        city: 'Bamako',
        postedAt: 'il y a 5 h',
        category: 'Entraide',
        title: `Question sur ${secondTech} : quelle architecture pour démarrer ?`,
        excerpt: 'Je monte un premier projet et j’hésite entre deux approches. Vos retours sont les bienvenus.',
        likes: 31,
        comments: 18,
      },
    ],
    modules: [
      { id: 'start', title: 'Bien démarrer dans la guilde', lessons: 4, durationMin: 25, preview: true },
      { id: 'basics', title: `Fondamentaux ${mainTech}`, lessons: 12, durationMin: 180, preview: false },
      { id: 'practice', title: `${secondTech} en pratique`, lessons: 9, durationMin: 140, preview: false },
      { id: 'project', title: 'Projet fil rouge encadré', lessons: 6, durationMin: 240, preview: false },
    ],
    events: [
      { id: 'live', title: `Live : questions/réponses ${mainTech}`, startsAt: '2026-10-09T19:00:00Z', durationMin: 60, kind: 'Live' },
      { id: 'workshop', title: `Atelier pratique : ${secondTech}`, startsAt: '2026-10-14T17:00:00Z', durationMin: 90, kind: 'Atelier' },
      { id: 'ama', title: `AMA avec ${owners[c.id]?.name ?? 'les admins'}`, startsAt: '2026-10-21T18:00:00Z', durationMin: 45, kind: 'AMA' },
    ],
  };
}

export function getCommunityDetails(id: string | undefined): CommunityDetails | undefined {
  const community = communities.find((c) => c.id === id);
  return community && buildDetails(community);
}
