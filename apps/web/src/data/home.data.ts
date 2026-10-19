// Mock data for the home page. Replace with RTK Query endpoints
// (utils/api/community/community.api.ts) once the api exposes them.

export type CategoryId = 'all' | 'trending' | 'top' | 'free' | 'mentoring' | 'regional';

export type StackId =
  | 'rust'
  | 'python-ai'
  | 'cloud-devops'
  | 'web3-fintech'
  | 'mobile-flutter'
  | 'systems'
  | 'typescript'
  | 'cybersecurity';

export type SortId = 'active' | 'members' | 'recent';

export type Community = {
  id: string;
  name: string;
  description: string;
  initials: string;
  avatarClassName: string;
  coverClassName: string;
  /** Cover photo; coverClassName is the gradient shown while it loads */
  image: string;
  badge: string;
  online: number;
  members: number;
  createdAt: string;
  access: { kind: 'free' | 'paid' | 'application'; label: string };
  tags: string[];
  stacks: StackId[];
  categories: CategoryId[];
  cta?: string;
};

export const categories: { id: CategoryId; label: string; emoji?: string }[] = [
  { id: 'all', label: 'Toutes les communautés' },
  { id: 'trending', label: 'En plein essor', emoji: '🔥' },
  { id: 'top', label: 'Top 10 Continent', emoji: '👑' },
  { id: 'free', label: 'Gratuites' },
  { id: 'mentoring', label: 'Mentorat & Pro' },
  { id: 'regional', label: 'Par Hubs régionaux' },
];

export const stacks: { id: StackId; label: string }[] = [
  { id: 'rust', label: 'Rust' },
  { id: 'python-ai', label: 'Python & IA' },
  { id: 'cloud-devops', label: 'Cloud & DevOps' },
  { id: 'web3-fintech', label: 'Web3 & Fintech' },
  { id: 'mobile-flutter', label: 'Mobile & Flutter' },
  { id: 'systems', label: 'Systèmes & Kernel' },
  { id: 'typescript', label: 'TypeScript & Next.js' },
  { id: 'cybersecurity', label: 'Cybersécurité' },
];

export const sortOptions: { id: SortId; label: string }[] = [
  { id: 'active', label: 'Plus actives (temps réel)' },
  { id: 'members', label: 'Plus de membres' },
  { id: 'recent', label: 'Récemment créées' },
];

export const heroStats = [
  { value: '1,240+', label: 'guildes actives', dotClassName: 'bg-emerald-500' },
  { value: '48,500+', label: 'développeurs', dotClassName: 'bg-brand' },
  { value: '38', label: 'pays africains', dotClassName: 'bg-blue-500' },
];

export const communities: Community[] = [
  {
    id: 'python-africa-core',
    name: 'Python Africa Core',
    description:
      'La guilde continentale pour le backend haute performance : Django, FastAPI, Celery et architectures asynchrones à grande échelle.',
    initials: 'Py',
    avatarClassName: 'bg-blue-900 text-amber-400',
    coverClassName: 'from-blue-700 via-indigo-600 to-amber-500',
    image: '/images/communities/python-africa-core.jpg',
    badge: '#1 en Backend',
    online: 412,
    members: 5800,
    createdAt: '2025-03-12',
    access: { kind: 'free', label: 'GRATUIT' },
    tags: ['Pan-Africa', 'FastAPI', 'Async'],
    stacks: ['python-ai'],
    categories: ['top'],
  },
  {
    id: 'lagos-ai-data',
    name: 'Lagos AI & Data Engineers',
    description:
      "Fine-tuning de LLMs multilingues pour langues africaines, pipelines PyTorch, MLOps et cas d'usage FinTech réels.",
    initials: 'AI',
    avatarClassName: 'bg-emerald-800 text-emerald-200',
    coverClassName: 'from-emerald-600 via-teal-700 to-slate-900',
    image: '/images/communities/lagos-ai-data.jpg',
    badge: '#1 en IA & Data',
    online: 540,
    members: 6200,
    createdAt: '2025-01-20',
    access: { kind: 'paid', label: '15$/MOIS' },
    tags: ['Lagos, NG', 'PyTorch', 'LLMs'],
    stacks: ['python-ai'],
    categories: ['top', 'regional'],
  },
  {
    id: 'dakar-devops',
    name: 'Dakar DevOps & Cloud Sovereign',
    description:
      'Infrastructures bare-metal, Kubernetes cluster management, automatisation Terraform et résilience réseau transafricain.',
    initials: 'K8s',
    avatarClassName: 'bg-orange-700 text-orange-100',
    coverClassName: 'from-orange-600 via-amber-600 to-rose-700',
    image: '/images/communities/dakar-devops.jpg',
    badge: '#1 en DevOps',
    online: 194,
    members: 2700,
    createdAt: '2025-05-02',
    access: { kind: 'free', label: 'GRATUIT' },
    tags: ['Dakar, SN', 'Kubernetes', 'CI/CD'],
    stacks: ['cloud-devops'],
    categories: ['top', 'regional'],
  },
  {
    id: 'nairobi-rustaceans',
    name: 'Nairobi Rustaceans',
    description:
      'Sécurité mémoire, moteurs fintech bas niveau, microservices Tokio et cryptographie haute vitesse dans la Silicon Savannah.',
    initials: 'Rs',
    avatarClassName: 'bg-stone-900 text-orange-400',
    coverClassName: 'from-stone-800 via-orange-900 to-amber-700',
    image: '/images/communities/nairobi-rustaceans.jpg',
    badge: '🔥 En plein essor',
    online: 289,
    members: 3100,
    createdAt: '2026-06-18',
    access: { kind: 'free', label: 'GRATUIT' },
    tags: ['Nairobi, KE', 'Rust', 'Tokio'],
    stacks: ['rust'],
    categories: ['trending', 'regional'],
  },
  {
    id: 'frontend-francophone',
    name: 'Frontend Francophone Masters',
    description:
      'Excellence UX/UI, Next.js 15, design systems, accessibilité et stratégies offline-first adaptées aux réseaux mobiles africains.',
    initials: '⚛️',
    avatarClassName: 'bg-sky-600 text-white',
    coverClassName: 'from-sky-500 via-indigo-600 to-purple-600',
    image: '/images/communities/frontend-francophone.jpg',
    badge: '#2 en UI / Web',
    online: 310,
    members: 4200,
    createdAt: '2025-09-07',
    access: { kind: 'free', label: 'GRATUIT' },
    tags: ['Abidjan, CI', 'React', 'Next.js'],
    stacks: ['typescript'],
    categories: ['top', 'regional'],
  },
  {
    id: 'african-kernel-lab',
    name: 'African Kernel & Systems Lab',
    description:
      'Pilotes Linux, architectures microprocesseurs RISC-V, systèmes temps réel et protocoles réseau souverains.',
    initials: 'C/C++',
    avatarClassName: 'bg-zinc-900 text-emerald-400',
    coverClassName: 'from-zinc-900 via-stone-800 to-emerald-950',
    image: '/images/communities/african-kernel-lab.jpg',
    badge: 'Systèmes bas niveau',
    online: 98,
    members: 1400,
    createdAt: '2026-02-11',
    access: { kind: 'application', label: 'CANDIDATURE' },
    tags: ['Pan-Africa', 'Linux Kernel', 'C/Assembly'],
    stacks: ['systems'],
    categories: [],
    cta: 'Postuler',
  },
  {
    id: 'solidity-web3-africa',
    name: 'Solidity & Web3 Africa',
    description:
      'Smart contracts audités, passerelles Mobile Money décentralisées, protocoles DeFi transfrontaliers et zéro-knowledge proofs.',
    initials: 'Ξ',
    avatarClassName: 'bg-purple-900 text-purple-200',
    coverClassName: 'from-violet-700 via-purple-800 to-indigo-900',
    image: '/images/communities/solidity-web3-africa.jpg',
    badge: 'FinTech & Rails',
    online: 240,
    members: 3600,
    createdAt: '2026-04-29',
    access: { kind: 'free', label: 'GRATUIT' },
    tags: ['Pan-Africa', 'Solidity', 'ZK-Rollups'],
    stacks: ['web3-fintech'],
    categories: ['trending'],
  },
  {
    id: 'kigali-embedded',
    name: 'Kigali Green & Embedded Tech',
    description:
      'Systèmes embarqués frugaux, micro-grids solaires connectés, capteurs agritech LoRaWAN et micrologiciels bas-carbone.',
    initials: 'IoT',
    avatarClassName: 'bg-emerald-900 text-emerald-300',
    coverClassName: 'from-emerald-700 via-teal-600 to-green-700',
    image: '/images/communities/kigali-embedded.jpg',
    badge: 'IoT & Énergie',
    online: 115,
    members: 1900,
    createdAt: '2026-07-15',
    access: { kind: 'free', label: 'GRATUIT' },
    tags: ['Kigali, RW', 'LoRaWAN', 'Embedded C'],
    stacks: ['systems'],
    categories: ['trending', 'regional'],
  },
  {
    id: 'africode-mentorship',
    name: 'AfriCode Mentorship & Jobs',
    description:
      'Préparation aux entretiens FAANG / scale-ups globales, revues de code hebdomadaires avec des Senior Staff et accès direct aux offres remote.',
    initials: 'Job',
    avatarClassName: 'bg-amber-900 text-amber-200',
    coverClassName: 'from-amber-600 via-orange-600 to-red-600',
    image: '/images/communities/africode-mentorship.jpg',
    badge: 'Carrière & Remote',
    online: 680,
    members: 7100,
    createdAt: '2024-11-03',
    access: { kind: 'paid', label: 'PRO // 20$/MOIS' },
    tags: ['Pan-Africa', 'Interview Prep', 'Remote Work'],
    stacks: [],
    categories: ['mentoring'],
    cta: 'Explorer',
  },
];

export const creatorSteps = [
  {
    title: 'Créez votre guilde en 1 clic',
    description: "Personnalisez votre nom, stack cible, ville et conditions d'accès.",
  },
  {
    title: 'Flux + LMS interactif inclus',
    description: 'Partagez du code, organisez des sessions live et créez des cours à modules.',
  },
  {
    title: 'Monétisez ou restez gratuit',
    description: 'Acceptez les paiements par Mobile Money (Wave, Orange, M-Pesa) ou CB.',
  },
];

export const activities = [
  { who: 'Awa S. (Dakar)', action: 'a rejoint', target: '#rust-africa', markerClassName: 'text-brand' },
  { who: 'Chidi O. (Lagos)', action: 'a résolu le bounty #402 (+500 XP)', markerClassName: 'text-emerald-600' },
  { who: 'Kofi M. (Accra)', action: 'a lancé une masterclass Kubernetes', markerClassName: 'text-blue-600' },
];

export const testimonials = [
  {
    quote:
      'En 6 mois sur Kodinga, la Guilde Dakar Cloud a réuni 2 700 ingénieurs. Les sessions lives et le module de cours intégré nous ont permis de décrocher 18 recrutements dans des scale-ups internationales.',
    name: 'Awa Ndiaye',
    role: 'Fondatrice • Dakar DevOps',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDAC_lzSGM9cVn5hX02OwtEYadL3dOo4A2z9giwQfZy6lESeMMo6e9ll1LkDI_2BecBuN3eiBseU_mvQWE6HRl5GMPH74KK6hlazwLyqUdwbbNd7wWOWYa-ISTEw3cLUgKqhG-Mn_InU6oJA-nH0xV8vulvr_BiIS6pH41HQhMo0CzmtkifYRlU4ZF37n21szgrVnLcG3mTPX5CqZHKyKvYPcwmApo9crOihJFDO4nOMguRahtNGy2A',
  },
  {
    quote:
      'Le système de gamification par XP et badges motive nos membres à soumettre des PRs tous les matins. Nous avons financé nos premiers clusters IA grâce aux bounties de la plateforme.',
    name: 'Jean-Luc Habimana',
    role: 'Lead • Kigali Embedded & AI',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuD3v_vkgoxWEkwRxHAixAlZG-oZ06um6C0lGbzrSuzVdcZOgCm6ub8DnsqLBK0BF1aIf2hsiq9FaKca4oIzW2UxJGdOKO4N8f7BoE9WMHv-HJroT7O305F9bDoDD2RPNmom9vR_6RBEAocjnaGNMVLSpvGGIkVBbV6v0EMezwSEPlBYfV3qrqItQXYxc3nrxm3FwONtkPTOsPYSqBPSTqpy1yPuf_d2UmxDNuPQQ9eniD1nqMSiiidy',
  },
  {
    quote:
      "L'interopérabilité entre développeurs anglophones et francophones fait la force de Kodinga. Nous codons des modules Rust partagés entre Lagos, Abidjan et Johannesburg sans friction.",
    name: 'Babatunde Adebayo',
    role: 'Co-fondateur • Open-Fintech Lagos',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDsNbjN5Da_JQau_PpZdjlcjWRbHbPc8cgyUsdkbzFXultg4qe3oAx_PslUzENnOD-sUJbfpujK1ezrR_yxdQu0t5WG5bmKABtHXEUQA8xS1f5u3Z5QXeKSaW_D3r_dTdniMR0IRMyEfBsXjA3jZQceGXpBg_DSrWGWuyZh4oS-pSbqXquiWmDfKfY_e2Jc4fWjApXBTs7-vXNmeKJH9hnkmOiPeLJuFcHQTznBNE654_nT0gOkuAu4',
  },
];
