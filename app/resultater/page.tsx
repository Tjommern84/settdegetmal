import type { Metadata } from 'next';
import Link from 'next/link';
import { cityCoordinates, normalizeCity } from '../../lib/matching';
import type { RankedService } from '../../lib/matching';
import { geocodeNorwegianCity } from '../../lib/geocode';
import { searchServices } from '../../lib/matchingDb';
import { parseServiceType, parseSort, parseVenue } from '../../lib/resultFilters';
import { parseMainCategory, CATEGORY_LABELS } from '../../lib/categoryConfig';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import ResultsView from './ResultsView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TYPE_LABELS: Record<string, string> = {
  styrke: 'Treningssenter',
  pt: 'Personlig trener',
  yoga: 'Yoga & Bevegelighet',
  gruppe: 'Gruppetimer',
  kondisjon: 'Kondisjon',
  outdoor: 'Outdoor',
  sport: 'Idrettslag & Sport',
  mindbody: 'Mind-body',
  spesialisert: 'Klinisk & Rehab',
  livsstil: 'Livsstil & Helse',
  teknologi: 'Digital trening',
  any: 'Alle kategorier',
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const rawCat = typeof searchParams.cat === 'string' ? searchParams.cat : '';
  const rawType = typeof searchParams.type === 'string' ? searchParams.type : '';
  const mainCat = parseMainCategory(rawCat);
  const label = mainCat
    ? CATEGORY_LABELS[mainCat]
    : TYPE_LABELS[rawType] ?? 'Finn treningstilbud';
  return { title: `${label} – SettDegEtMål` };
}

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // ── Parse params ──────────────────────────────────────────────────────────

  const rawCat     = typeof searchParams.cat      === 'string' ? searchParams.cat      : '';
  const rawTags    = typeof searchParams.tags     === 'string' ? searchParams.tags     : '';
  const rawType    = typeof searchParams.type     === 'string' ? searchParams.type     : '';
  const rawVenue   = typeof searchParams.venue    === 'string' ? searchParams.venue    : '';
  const rawLocation = typeof searchParams.location === 'string' ? searchParams.location : '';
  const rawBorough = typeof searchParams.bydel    === 'string'
    ? searchParams.bydel
    : typeof searchParams.borough === 'string' ? searchParams.borough : '';
  const rawSort   = typeof searchParams.sort   === 'string' ? searchParams.sort   : '';
  const rawQuery  = typeof searchParams.q      === 'string' ? searchParams.q      : '';
  const rawRadius = typeof searchParams.radius === 'string' ? parseInt(searchParams.radius, 10) : NaN;
  const radiusKm  = !Number.isNaN(rawRadius) && rawRadius > 0 ? rawRadius : 10;

  const mainCategory = parseMainCategory(rawCat);
  const serviceType  = parseServiceType(rawType);
  const venue        = parseVenue(rawVenue);
  const sort         = parseSort(rawSort);
  const tagsArray    = rawTags
    ? rawTags.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  // ── Resolve coordinates ───────────────────────────────────────────────────

  let lat: number | undefined;
  let lon: number | undefined;
  let locationLabel: string | null = null;

  const rawLat = typeof searchParams.lat === 'string' ? parseFloat(searchParams.lat) : NaN;
  const rawLon = typeof searchParams.lon === 'string' ? parseFloat(searchParams.lon) : NaN;

  if (!Number.isNaN(rawLat) && !Number.isNaN(rawLon)) {
    lat = rawLat;
    lon = rawLon;
    locationLabel = rawLocation || null;
  } else if (rawLocation) {
    const normalized = normalizeCity(rawLocation);
    if (normalized && cityCoordinates[normalized]) {
      lat = cityCoordinates[normalized].lat;
      lon = cityCoordinates[normalized].lon;
      locationLabel = rawLocation;
    } else {
      const geo = await geocodeNorwegianCity(rawLocation);
      if (geo) {
        lat = geo.lat;
        lon = geo.lon;
        locationLabel = rawLocation;
      }
    }
  }

  // ── Category label for heading ────────────────────────────────────────────

  const categoryLabel = mainCategory
    ? CATEGORY_LABELS[mainCategory]
    : venue === 'home'
    ? 'Hjemmetrening'
    : TYPE_LABELS[serviceType] ?? TYPE_LABELS.any;

  // ── Fetch results ─────────────────────────────────────────────────────────

  let results: RankedService[] = [];
  let fetchError: string | null = null;
  const requestedBorough = rawBorough ? rawBorough.trim() : undefined;
  const isOsloSearch = !!locationLabel && normalizeCity(locationLabel) === 'oslo';

  if (!isSupabaseConfigured) {
    fetchError = 'Supabase er ikke konfigurert.';
  } else {
    try {
      const baseParams = {
        type:         serviceType !== 'any' ? serviceType : undefined,
        venue:        venue !== 'either' ? venue : undefined,
        city:         locationLabel ? locationLabel.split(',')[0].trim().toLowerCase() : undefined,
        lat,
        lon,
        sort,
        query:        rawQuery || undefined,
        mainCategory: mainCategory ?? undefined,
        tags:         tagsArray.length > 0 ? tagsArray : undefined,
        limit:        50,
      };

      results = await searchServices({
        ...baseParams,
        borough: isOsloSearch ? requestedBorough : undefined,
      });

      // Fallback: if borough filter yields nothing, retry without it
      if (results.length === 0 && isOsloSearch && requestedBorough) {
        results = await searchServices(baseParams);
      }
    } catch (err) {
      console.error('[ResultsPage] searchServices failed:', err);
      if (err instanceof Error) {
        fetchError = err.message;
      } else if (err && typeof err === 'object' && 'message' in err) {
        fetchError = String((err as { message?: unknown }).message ?? 'Ukjent feil');
      } else {
        fetchError = 'Ukjent feil';
      }
    }
  }

  const nationwide = results.filter((r) => r.matchReason.includes('hele'));
  const local      = results.filter((r) => !r.matchReason.includes('hele'));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-6"
        >
          ← Tilbake
        </Link>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">{categoryLabel}</h1>
          {locationLabel && (
            <p className="mt-1 text-slate-500 text-sm">
              Nær {locationLabel}
              {rawBorough ? ` · ${rawBorough}` : ''}
              {tagsArray.length > 0 && (
                <span className="ml-2 text-slate-400">
                  · {tagsArray.join(', ')}
                </span>
              )}
            </p>
          )}
        </div>

        {fetchError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            Kunne ikke hente resultater: {fetchError}
          </div>
        ) : (
          <ResultsView
            nationwide={nationwide}
            local={local}
            categoryLabel={categoryLabel}
            locationLabel={locationLabel}
            sort={sort}
            centerLat={lat}
            centerLon={lon}
            radiusKm={radiusKm}
          />
        )}
      </div>
    </main>
  );
}
