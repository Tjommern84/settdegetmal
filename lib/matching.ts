import type {
  BudgetPref,
  Goal,
  Service,
  ServiceTypePref,
  VenuePreference,
} from './domain';

export const cityCoordinates: Record<string, { lat: number; lon: number }> = {
  oslo: { lat: 59.9139, lon: 10.7522 },
  'bærum': { lat: 59.8899, lon: 10.5233 },
  drammen: { lat: 59.7439, lon: 10.2045 },
  'lillestrøm': { lat: 59.9550, lon: 11.0492 },
  asker: { lat: 59.8333, lon: 10.4392 },
  bergen: { lat: 60.3913, lon: 5.3221 },
  trondheim: { lat: 63.4305, lon: 10.3951 },
  stavanger: { lat: 58.9690, lon: 5.7331 },
  kristiansand: { lat: 58.1599, lon: 8.0182 },
  tromsø: { lat: 69.6492, lon: 18.9553 },
  horten: { lat: 59.4167, lon: 10.4833 },
  tønsberg: { lat: 59.2669, lon: 10.4076 },
  sandefjord: { lat: 59.1310, lon: 10.2167 },
  larvik: { lat: 59.0561, lon: 10.0289 },
  fredrikstad: { lat: 59.2181, lon: 10.9298 },
  sarpsborg: { lat: 59.2839, lon: 11.1097 },
  moss: { lat: 59.4350, lon: 10.6578 },
  hamar: { lat: 60.7945, lon: 11.0679 },
  bodø: { lat: 67.2804, lon: 14.4049 },
  ålesund: { lat: 62.4722, lon: 6.1495 },
};

const normalizeSpaces = (value: string) => value.trim().replace(/\s+/g, ' ');

export function normalizeCity(input: string): string {
  const cleaned = normalizeSpaces(input).toLowerCase();
  if (cleaned.length === 0) return '';
  if (cleaned in cityCoordinates) return cleaned;
  return '';
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

type CoverageMatch = {
  matches: boolean;
  distanceKm?: number;
  reason: string;
};

const formatCities = (cities: string[]) => cities.join('/');

export function matchesCoverage(service: Service, userCity: string): CoverageMatch {
  const normalizedCity = normalizeCity(userCity);
  if (!normalizedCity) {
    return { matches: false, reason: 'Ukjent by' };
  }

  let bestMatch: CoverageMatch | null = null;

  for (const rule of service.coverage) {
    if (rule.type === 'region') {
      const matches =
        rule.region === 'nordic' || (rule.region === 'norway' && normalizedCity in cityCoordinates);
      if (matches) {
        const reason =
          rule.region === 'nordic' ? 'Tilgjengelig i hele Norden' : 'Tilgjengelig i hele Norge';
        bestMatch = bestMatch ?? { matches: true, reason };
      }
    }

    if (rule.type === 'cities') {
      const normalizedCities = rule.cities.map((city) => normalizeCity(city));
      if (normalizedCities.includes(normalizedCity)) {
        const reason = `Dekker ${formatCities(rule.cities)}`;
        bestMatch = bestMatch ?? { matches: true, reason };
      }
    }

    if (rule.type === 'radius') {
      const distanceKm = haversineKm(rule.center, cityCoordinates[normalizedCity]);
      if (distanceKm <= rule.radius_km) {
        const reason = `Innenfor ${rule.radius_km} km`;
        if (!bestMatch || (bestMatch.distanceKm ?? Infinity) > distanceKm) {
          bestMatch = { matches: true, distanceKm, reason };
        }
      }
    }
  }

  return bestMatch ?? { matches: false, reason: 'Dekning utenfor området' };
}

export type SortBy =
  | 'best_match'
  | 'nearest'
  | 'rating'
  | 'price_low'
  | 'price_high';

export type MatchParams = {
  city: string;
  sortBy: SortBy;
  goal?: Goal | 'any';
  serviceType?: ServiceTypePref;
  budget?: BudgetPref;
  venue?: VenuePreference;
};

export type RankedService = {
  service: Service;
  distanceKm?: number;
  matchReason: string;
  score: number;
  reasons: string[];
  lat?: number;
  lon?: number;
};

const priceOrder: Record<Service['price_level'], number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const venueLabel: Record<'home' | 'gym' | 'online', string> = {
  home: 'Hjemme',
  gym: 'Senter',
  online: 'Online',
};

const scoreRating = (ratingAvg: number) => {
  if (ratingAvg >= 4.7) return 3;
  if (ratingAvg >= 4.4) return 2;
  if (ratingAvg >= 4.1) return 1;
  return 0;
};

const scoreDistance = (distanceKm?: number) => {
  if (distanceKm === undefined) return 0;
  if (distanceKm <= 5) return 3;
  if (distanceKm <= 15) return 2;
  if (distanceKm <= 30) return 1;
  return 0;
};

export function getRankedServices(params: MatchParams, all: Service[]): RankedService[] {
  const goalPref = params.goal ?? 'any';
  const serviceTypePref = params.serviceType ?? 'any';
  const budgetPref = params.budget ?? 'any';
  const venuePref = params.venue ?? 'either';

  const matches = all
    .map((service) => {
      const match = matchesCoverage(service, params.city);
      if (!match.matches) return null;

      let score = 0;
      const reasons: string[] = [];

      if (goalPref !== 'any' && service.goals.includes(goalPref)) {
        score += 4;
        reasons.push('Mål match');
      }

      if (serviceTypePref !== 'any' && service.type === serviceTypePref) {
        score += 3;
        reasons.push('Type match');
      }

      if (budgetPref !== 'any' && service.price_level === budgetPref) {
        score += 2;
        reasons.push('Budsjett match');
      }

      if (venuePref !== 'either') {
        const venueKey = venuePref === 'home' ? 'home' : 'gym';
        if (service.venues.includes(venueKey)) {
          score += 2;
          reasons.push(`Passer ${venueLabel[venueKey]}`);
        }
      }

      const ratingScore = scoreRating(service.rating_avg);
      if (ratingScore > 0) {
        score += ratingScore;
        reasons.push('God rating');
      }

      const distanceScore = scoreDistance(match.distanceKm);
      if (distanceScore > 0) {
        score += distanceScore;
        reasons.push('Nær deg');
      }

      const limitedReasons = reasons.slice(0, 4);

      return {
        service,
        distanceKm: match.distanceKm,
        matchReason: match.reason,
        score,
        reasons: limitedReasons,
      } as RankedService;
    })
    .filter((item): item is RankedService => item !== null);

  const sorted = matches.sort((a, b) => {
    if (params.sortBy === 'best_match') {
      if (b.score !== a.score) return b.score - a.score;
      return b.service.rating_avg - a.service.rating_avg;
    }

    if (params.sortBy === 'nearest') {
      const aDist = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const bDist = b.distanceKm ?? Number.POSITIVE_INFINITY;
      if (aDist !== bDist) return aDist - bDist;
      return b.service.rating_avg - a.service.rating_avg;
    }

    if (params.sortBy === 'rating') {
      if (b.service.rating_avg !== a.service.rating_avg) {
        return b.service.rating_avg - a.service.rating_avg;
      }
      return b.service.rating_count - a.service.rating_count;
    }

    if (params.sortBy === 'price_low') {
      if (priceOrder[a.service.price_level] !== priceOrder[b.service.price_level]) {
        return priceOrder[a.service.price_level] - priceOrder[b.service.price_level];
      }
      return b.service.rating_avg - a.service.rating_avg;
    }

    if (params.sortBy === 'price_high') {
      if (priceOrder[a.service.price_level] !== priceOrder[b.service.price_level]) {
        return priceOrder[b.service.price_level] - priceOrder[a.service.price_level];
      }
      return b.service.rating_avg - a.service.rating_avg;
    }

    return 0;
  });

  return sorted.slice(0, 10);
}

