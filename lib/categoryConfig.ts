export type MainCategory =
  | 'trene-selv'
  | 'trene-sammen'
  | 'oppfolging'
  | 'aktivitet-sport';

export type TagOption = { label: string; value: string };

export type CategoryConfig = {
  key: MainCategory;
  label: string;
  description: string;
  tags: TagOption[];
  accent: string;
  images: string[];
  /** Legacy service types that belong to this category. */
  serviceTypes: string[];
};

export const CATEGORIES: CategoryConfig[] = [
  {
    key: 'trene-selv',
    label: 'Trene selv',
    description: 'Gym, styrke og egentreningsøkter',
    tags: [
      { label: 'Styrke',        value: 'styrke' },
      { label: 'Kondisjon',     value: 'kondisjon' },
      { label: 'CrossFit',      value: 'crossfit' },
      { label: 'Functional',    value: 'functional' },
      { label: 'Hjemmetrening', value: 'hjemmetrening' },
    ],
    accent: 'from-amber-300/60 via-orange-300/40 to-rose-300/30',
    images: [
      '/bilder/Treningssenter/pexels-glebkrs-2628215.jpg',
      '/bilder/Treningssenter/pexels-ivan-s-4162477.jpg',
      '/bilder/Treningssenter/pexels-roman-odintsov-4553611.jpg',
    ],
    serviceTypes: ['styrke', 'kondisjon', 'teknologi'],
  },
  {
    key: 'trene-sammen',
    label: 'Trene sammen',
    description: 'Gruppetimer, yoga, bootcamp og fellesøvelser',
    tags: [
      { label: 'Gruppetime', value: 'gruppetime' },
      { label: 'Yoga',       value: 'yoga' },
      { label: 'Outdoor',    value: 'outdoor' },
      { label: 'Bootcamp',   value: 'bootcamp' },
      { label: 'Løpegruppe', value: 'løpegruppe' },
    ],
    accent: 'from-fuchsia-300/60 via-pink-300/40 to-rose-300/30',
    images: [
      '/bilder/Gruppetimer/pexels-airfit-6150627.jpg',
      '/bilder/Gruppetimer/pexels-katetrysh-4090009.jpg',
      '/bilder/Gruppetimer/pexels-pavel-danilyuk-6339488.jpg',
    ],
    serviceTypes: ['gruppe', 'yoga', 'mindbody', 'outdoor'],
  },
  {
    key: 'oppfolging',
    label: 'Oppfølging & coaching',
    description: 'PT, coaching, rehab og ernæring',
    tags: [
      { label: 'PT',        value: 'pt' },
      { label: 'Rehab',     value: 'rehab' },
      { label: 'Online',    value: 'online' },
      { label: 'Ernæring',  value: 'ernæring' },
      { label: 'Smågruppe', value: 'small-group' },
    ],
    accent: 'from-sky-300/60 via-cyan-300/40 to-teal-300/30',
    images: [
      '/bilder/Personlig%20trener/pexels-jonathanborba-3076510.jpg',
      '/bilder/Personlig%20trener/pexels-julia-larson-6456323.jpg',
      '/bilder/Personlig%20trener/pexels-kampus-6922165.jpg',
    ],
    serviceTypes: ['pt', 'spesialisert', 'livsstil'],
  },
  {
    key: 'aktivitet-sport',
    label: 'Aktivitet & sport',
    description: 'Idrettslag, friluft og naturbasert aktivitet',
    tags: [
      { label: 'Fotball',     value: 'fotball' },
      { label: 'Ski',         value: 'ski' },
      { label: 'Håndball',    value: 'håndball' },
      { label: 'Svømming',    value: 'svømming' },
      { label: 'Orientering', value: 'orientering' },
      { label: 'Friidrett',   value: 'friidrett' },
      { label: 'Kampsport',   value: 'kampsport' },
      { label: 'Padel',       value: 'padel' },
      { label: 'Langrenn',    value: 'langrenn' },
      { label: 'Klatring',    value: 'klatring' },
    ],
    accent: 'from-emerald-300/60 via-teal-300/40 to-cyan-300/30',
    images: [
      '/bilder/Idrettslag%20%26%20Sport/pexels-micaasato-1198172.jpg',
      '/bilder/Outdoor/pexels-rdne-5837154.jpg',
      '/bilder/Idrettslag%20%26%20Sport/pexels-pavel-danilyuk-6203514.jpg',
    ],
    serviceTypes: ['sport'],
  },
];

export const CATEGORY_LABELS: Record<MainCategory, string> = {
  'trene-selv': 'Trene selv',
  'trene-sammen': 'Trene sammen',
  oppfolging: 'Oppfølging & coaching',
  'aktivitet-sport': 'Aktivitet & sport',
};

export function getCategoryConfig(key: string): CategoryConfig | undefined {
  return CATEGORIES.find((c) => c.key === key);
}

export function parseMainCategory(value: string): MainCategory | null {
  if (
    value === 'trene-selv' ||
    value === 'trene-sammen' ||
    value === 'oppfolging' ||
    value === 'aktivitet-sport'
  ) {
    return value;
  }
  return null;
}
