import type {
  BudgetPref,
  Goal,
  ServiceTypePref,
  VenuePreference,
} from './domain';
import type { SortBy } from './matching';

export const sortLabels: Record<SortBy, string> = {
  best_match: 'Beste match',
  nearest: 'Nærmest',
  rating: 'Høyest rating',
  price_low: 'Lav pris',
  price_high: 'Høy pris',
};

export const typeLabels: Record<ServiceTypePref, string> = {
  styrke: 'Styrketrening',
  kondisjon: 'Kondisjon',
  gruppe: 'Gruppetimer',
  yoga: 'Yoga & Mobilitet',
  mindbody: 'Mind–body',
  spesialisert: 'Spesialisert trening',
  livsstil: 'Livsstil & Helse',
  outdoor: 'Outdoor',
  sport: 'Sport & Prestasjon',
  pt: 'Personlig trener',
  teknologi: 'Digital trening',
  any: 'Alle',
};

export const priceLabels: Record<'low' | 'medium' | 'high', string> = {
  low: 'Lav',
  medium: 'Middels',
  high: 'Høy',
};

export const goalLabels: Record<Goal, string> = {
  weight_loss: 'Vektnedgang',
  strength: 'Styrke',
  mobility: 'Mobilitet',
  rehab: 'Rehab',
  endurance: 'Utholdenhet',
  start: 'Starte',
};

export const goalSlugs: Record<Goal, string> = {
  weight_loss: 'vektnedgang',
  strength: 'styrke',
  mobility: 'mobilitet',
  rehab: 'rehab',
  endurance: 'utholdenhet',
  start: 'nybegynner',
};

export const serviceTypeLabels: Record<ServiceTypePref, string> = {
  styrke: 'Styrketrening',
  kondisjon: 'Kondisjon',
  gruppe: 'Gruppetimer',
  yoga: 'Yoga & Mobilitet',
  mindbody: 'Mind–body',
  spesialisert: 'Spesialisert trening',
  livsstil: 'Livsstil & Helse',
  outdoor: 'Outdoor',
  sport: 'Sport & Prestasjon',
  pt: 'Personlig trener',
  teknologi: 'Digital trening',
  any: 'Alle',
};

export const budgetLabels: Record<BudgetPref, string> = {
  low: 'Lav',
  medium: 'Middels',
  high: 'Høy',
  any: 'Alle',
};

export const venueLabels: Record<VenuePreference, string> = {
  home: 'Hjemme',
  gym: 'Senter',
  either: 'Spiller ingen rolle',
};

export function parseSort(value: string | null): SortBy {
  if (value === 'nearest' || value === 'rating' || value === 'price_low' || value === 'price_high') {
    return value;
  }
  return 'best_match';
}

export function parseGoal(value: string | null): Goal | 'any' {
  if (
    value === 'weight_loss' ||
    value === 'strength' ||
    value === 'mobility' ||
    value === 'rehab' ||
    value === 'endurance' ||
    value === 'start'
  ) {
    return value;
  }
  return 'any';
}

export function parseServiceType(value: string | null): ServiceTypePref {
  if (
    value === 'styrke' || value === 'kondisjon' || value === 'gruppe' ||
    value === 'yoga' || value === 'mindbody' || value === 'spesialisert' ||
    value === 'livsstil' || value === 'outdoor' || value === 'sport' ||
    value === 'pt' || value === 'teknologi'
  ) {
    return value;
  }
  return 'any';
}

export function parseBudget(value: string | null): BudgetPref {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }
  return 'any';
}

export function parseVenue(value: string | null): VenuePreference {
  if (value === 'home' || value === 'gym') {
    return value;
  }
  return 'either';
}

export const relatedGoalsDefault: Goal[] = ['strength', 'weight_loss', 'start', 'mobility', 'endurance'];

export const categoryLabels: Record<string, string> = {
  'trene-selv': 'Trene selv',
  'trene-sammen': 'Trene sammen',
  oppfolging: 'Oppfølging & coaching',
  'aktivitet-sport': 'Aktivitet & sport',
};

export type ResultsFilters = {
  sortBy: SortBy;
  goal: Goal | 'any';
  serviceType: ServiceTypePref;
  budget: BudgetPref;
  venue: VenuePreference;
};
