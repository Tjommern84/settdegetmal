import type { Metadata } from 'next';
import { cityCoordinates, getRankedServices, normalizeCity } from '../../lib/matching';
import type { RankedService } from '../../lib/matching';
import ResultsView from './ResultsView';
import {
  parseBudget,
  parseGoal,
  parseServiceType,
  parseSort,
  parseVenue,
  type ResultsFilters,
} from '../../lib/resultFilters';
import { getRankedServicesFromDb, fetchLegacyServices } from '../../lib/matchingDb';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const ogImageUrl = `${appUrl}/og-default.svg`;

export function generateMetadata({
  searchParams,
}: {
  searchParams?: { location?: string; city?: string; locationLabel?: string };
}): Metadata {
  const rawCity = searchParams?.location ?? searchParams?.city ?? '';
  const displayLabel = searchParams?.locationLabel ?? rawCity;

  if (!displayLabel) {
    return {
      title: 'Resultater - settdegetmal.no',
      description: 'Finn treningstilbud som passer ditt mål og budsjett.',
    };
  }

  return {
    title: `Treningstilbud i ${displayLabel} - settdegetmal.no`,
    description: `Se treningstilbud i ${displayLabel}. Match PT, treningssenter, yoga og kurs som passer ditt mål.`,
    openGraph: {
      title: `Treningstilbud i ${displayLabel} - settdegetmal.no`,
      description: `Se treningstilbud i ${displayLabel}. Match PT, treningssenter, yoga og kurs som passer ditt mål.`,
      url: appUrl,
      type: 'website',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: 'settdegetmal.no',
        },
      ],
    },
  };
}

type SearchParams = {
  location?: string;
  city?: string;
  locationLabel?: string;
  lat?: string;
  lon?: string;
  goal?: string;
  serviceType?: string;
  budget?: string;
  venue?: string;
  sort?: string;
  q?: string;
};

export default async function ResultsPage({ searchParams }: { searchParams?: SearchParams }) {
  const cityRaw = searchParams?.location ?? searchParams?.city ?? '';
  const cityKey = normalizeCity(cityRaw);
  const locationLabel = searchParams?.locationLabel ?? cityRaw ?? '';
  const latParam = searchParams?.lat ? Number(searchParams.lat) : NaN;
  const lonParam = searchParams?.lon ? Number(searchParams.lon) : NaN;
  const hasCoords = Number.isFinite(latParam) && Number.isFinite(lonParam);
  const validLocation = Boolean((cityKey && cityKey in cityCoordinates) || hasCoords);
  const rawSearchQuery = searchParams?.q ?? '';
  const normalizedSearchQuery = rawSearchQuery.trim();
  const filters: ResultsFilters = {
    sortBy: parseSort(searchParams?.sort ?? null),
    goal: parseGoal(searchParams?.goal ?? null),
    serviceType: parseServiceType(searchParams?.serviceType ?? null),
    budget: parseBudget(searchParams?.budget ?? null),
    venue: parseVenue(searchParams?.venue ?? null),
  };

  let dbResults: RankedService[] | null = null;
  let usedDb = false;

  if (validLocation) {
    try {
      dbResults = await getRankedServicesFromDb({
        ...filters,
        city: cityKey,
        lat: hasCoords ? latParam : undefined,
        lon: hasCoords ? lonParam : undefined,
        query: normalizedSearchQuery || undefined,
      });
      usedDb = true;
    } catch {
      dbResults = null;
      usedDb = false;
    }
  }

  let finalResults = dbResults ?? [];

  if (!usedDb && validLocation && cityKey && cityKey in cityCoordinates) {
    const legacyServices = await fetchLegacyServices();
    finalResults = getRankedServices(
      {
        city: cityKey,
        sortBy: filters.sortBy,
        goal: filters.goal,
        serviceType: filters.serviceType,
        budget: filters.budget,
        venue: filters.venue,
      },
      legacyServices
    );
  }

  return (
    <ResultsView
      filters={filters}
      cityKey={cityKey}
      rawCity={cityRaw}
      results={validLocation ? finalResults : []}
      invalidCity={!validLocation}
      hasSupabase={usedDb}
      locationLabel={locationLabel}
      searchQuery={normalizedSearchQuery}
      lat={hasCoords ? latParam : undefined}
      lon={hasCoords ? lonParam : undefined}
    />
  );
}
