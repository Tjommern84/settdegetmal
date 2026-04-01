import type { Service } from './domain';

export const services: Service[] = [
  {
    id: 'pt-drammen-elisabeth-holm',
    name: 'Elisabeth Holm PT',
    type: 'pt',
    description:
      'Personlig trener i Drammen med fokus på styrke, skadeforebygging og varig progresjon.',
    coverage: [
      {
        type: 'radius',
        center: { lat: 59.7439, lon: 10.2045 },
        radius_km: 20,
      },
    ],
    price_level: 'high',
    rating_avg: 4.8,
    rating_count: 128,
    tags: ['styrke', 'rehab', 'mobilitet', 'nybegynner'],
    goals: ['strength', 'rehab', 'mobility', 'start'],
    venues: ['gym', 'home'],
  },
  {
    id: 'pt-oslo-marius-dal',
    name: 'Marius Dal Performance',
    type: 'pt',
    description:
      'PT i Oslo for deg som vil bygge muskler, øke prestasjon og få struktur i hverdagen.',
    coverage: [
      {
        type: 'radius',
        center: { lat: 59.9139, lon: 10.7522 },
        radius_km: 15,
      },
      {
        type: 'cities',
        cities: ['Oslo', 'Bærum'],
      },
    ],
    price_level: 'high',
    rating_avg: 4.9,
    rating_count: 212,
    tags: ['styrke', 'prestasjon', 'oppfølging', 'avansert'],
    goals: ['strength', 'endurance'],
    venues: ['gym'],
  },
  {
    id: 'pt-bergen-havn',
    name: 'Havn PT Studio',
    type: 'pt',
    description:
      'Små grupper og 1:1-trening i Bergen med fokus på teknikk og trygg progresjon.',
    coverage: [
      {
        type: 'radius',
        center: { lat: 60.3913, lon: 5.3221 },
        radius_km: 12,
      },
    ],
    price_level: 'medium',
    rating_avg: 4.7,
    rating_count: 96,
    tags: ['teknikk', 'styrke', 'nybegynner'],
    goals: ['strength', 'start'],
    venues: ['gym'],
  },
  {
    id: 'pt-trondheim-kari-strand',
    name: 'Kari Strand PT',
    type: 'pt',
    description:
      'Personlig trener i Trondheim med spesialisering i mobilitet og funksjonell styrke.',
    coverage: [
      {
        type: 'radius',
        center: { lat: 63.4305, lon: 10.3951 },
        radius_km: 18,
      },
    ],
    price_level: 'medium',
    rating_avg: 4.6,
    rating_count: 74,
    tags: ['mobilitet', 'funksjonell', 'rehab'],
    goals: ['mobility', 'rehab', 'strength'],
    venues: ['gym', 'home'],
  },
  {
    id: 'pt-stavanger-jonas-hauge',
    name: 'Jonas Hauge Coaching',
    type: 'pt',
    description:
      'Trening i Stavanger for deg som vil ned i vekt eller komme i gang med en trygg plan.',
    coverage: [
      {
        type: 'radius',
        center: { lat: 58.969, lon: 5.7331 },
        radius_km: 25,
      },
    ],
    price_level: 'medium',
    rating_avg: 4.5,
    rating_count: 63,
    tags: ['vekttap', 'nybegynner', 'vaner'],
    goals: ['weight_loss', 'start', 'endurance'],
    venues: ['home', 'gym'],
  },
  {
    id: 'yoga-oslo-liv',
    name: 'Liv Yoga Studio',
    type: 'yoga',
    description:
      'Rolige yogatimer i Oslo og Bærum med fokus på pust, balanse og myk styrke.',
    coverage: [
      {
        type: 'cities',
        cities: ['Oslo', 'Bærum'],
      },
    ],
    price_level: 'medium',
    rating_avg: 4.8,
    rating_count: 189,
    tags: ['yoga', 'pust', 'mobilitet', 'stressreduksjon'],
    goals: ['mobility', 'rehab', 'start'],
    venues: ['gym', 'online'],
  },
  {
    id: 'yoga-bergen-sky',
    name: 'Sky Yoga Bergen',
    type: 'yoga',
    description:
      'Dynamiske yogaklasser i Bergen sentrum med både nybegynner- og nivågrupper.',
    coverage: [
      {
        type: 'cities',
        cities: ['Bergen'],
      },
    ],
    price_level: 'low',
    rating_avg: 4.4,
    rating_count: 52,
    tags: ['yoga', 'flyt', 'nybegynner'],
    goals: ['mobility', 'start', 'endurance'],
    venues: ['gym'],
  },
  {
    id: 'yoga-tromso-nordlys',
    name: 'Nordlys Yoga',
    type: 'yoga',
    description:
      'Kvalitetsyoga i Tromsø med fokus på bevegelighet og restitusjon.',
    coverage: [
      {
        type: 'cities',
        cities: ['Tromsø'],
      },
    ],
    price_level: 'medium',
    rating_avg: 4.6,
    rating_count: 78,
    tags: ['mobilitet', 'restitusjon', 'yoga'],
    goals: ['mobility', 'rehab'],
    venues: ['gym', 'online'],
  },
  {
    id: 'gym-norge-puls',
    name: 'Puls Treningssenter',
    type: 'styrke',
    description:
      'Landsdekkende treningssenterkjede med moderne utstyr og fleksible medlemskap.',
    coverage: [
      {
        type: 'region',
        region: 'norway',
      },
    ],
    price_level: 'medium',
    rating_avg: 4.3,
    rating_count: 1240,
    tags: ['styrke', 'kondisjon', 'gruppe'],
    goals: ['strength', 'endurance', 'weight_loss', 'start'],
    venues: ['gym'],
  },
  {
    id: 'gym-nordic-aktiva',
    name: 'Aktiva Nordic',
    type: 'styrke',
    description:
      'Nordisk treningssenterkjede med fokus på kvalitet, familie og fleksibilitet.',
    coverage: [
      {
        type: 'region',
        region: 'nordic',
      },
    ],
    price_level: 'high',
    rating_avg: 4.5,
    rating_count: 980,
    tags: ['familie', 'premium', 'fasiliteter'],
    goals: ['strength', 'endurance', 'weight_loss'],
    venues: ['gym'],
  },
  {
    id: 'gym-kristiansand-brygga',
    name: 'Brygga Treningssenter',
    type: 'styrke',
    description:
      'Populært senter i Kristiansand med gode styrke- og kondisjonssoner.',
    coverage: [
      {
        type: 'cities',
        cities: ['Kristiansand'],
      },
    ],
    price_level: 'low',
    rating_avg: 4.2,
    rating_count: 301,
    tags: ['styrke', 'kondisjon', 'lokalt'],
    goals: ['strength', 'endurance', 'start'],
    venues: ['gym'],
  },
  {
    id: 'gym-drammen-elva',
    name: 'Elva Fitness Drammen',
    type: 'styrke',
    description:
      'Treningssenter i Drammen med gode gruppetimer og personlig oppfølging.',
    coverage: [
      {
        type: 'cities',
        cities: ['Drammen'],
      },
    ],
    price_level: 'medium',
    rating_avg: 4.4,
    rating_count: 227,
    tags: ['gruppe', 'styrke', 'nybegynner'],
    goals: ['strength', 'start', 'endurance'],
    venues: ['gym'],
  },
  {
    id: 'course-oslo-bootcamp',
    name: 'Oslo Bootcamp',
    type: 'gruppe',
    description:
      '8-ukers treningsprogram for deg som vil ha fast opplegg og tydelig progresjon.',
    coverage: [
      {
        type: 'cities',
        cities: ['Oslo'],
      },
    ],
    price_level: 'medium',
    rating_avg: 4.6,
    rating_count: 154,
    tags: ['program', 'styrke', 'kondisjon'],
    goals: ['strength', 'endurance', 'weight_loss'],
    venues: ['gym', 'online'],
  },
  {
    id: 'course-trondheim-rehab',
    name: 'Rehab & Stabilitet Trondheim',
    type: 'gruppe',
    description:
      'Kurs for rehabilitering og stabilitet, ledet av fysioterapeut.',
    coverage: [
      {
        type: 'cities',
        cities: ['Trondheim'],
      },
    ],
    price_level: 'high',
    rating_avg: 4.7,
    rating_count: 88,
    tags: ['rehab', 'mobilitet', 'smertefri'],
    goals: ['rehab', 'mobility'],
    venues: ['gym', 'online'],
  },
  {
    id: 'course-bergen-senior',
    name: 'Senior Styrke Bergen',
    type: 'gruppe',
    description:
      'Trygge styrkeøkter for seniorer med fokus på balanse og funksjon.',
    coverage: [
      {
        type: 'cities',
        cities: ['Bergen'],
      },
    ],
    price_level: 'low',
    rating_avg: 4.5,
    rating_count: 67,
    tags: ['senior', 'balanse', 'nybegynner'],
    goals: ['start', 'mobility', 'strength'],
    venues: ['gym'],
  },
  {
    id: 'course-stavanger-nybegynner',
    name: 'Start Sterk Stavanger',
    type: 'gruppe',
    description:
      'Nybegynnerkurs med fokus på trygg introduksjon til styrketrening.',
    coverage: [
      {
        type: 'cities',
        cities: ['Stavanger'],
      },
    ],
    price_level: 'low',
    rating_avg: 4.3,
    rating_count: 49,
    tags: ['nybegynner', 'styrke', 'teknikk'],
    goals: ['start', 'strength'],
    venues: ['gym'],
  },
];
