'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import LocalHighlights from '../../components/LocalHighlights';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { container, input, label } from '../../lib/ui';
import { trackEvent } from '../../lib/analytics';
import type { RankedService } from '../../lib/matching';
import type { ResultsFilters } from '../../lib/resultFilters';
import type { ChangeEvent } from 'react';
import {
  budgetLabels,
  goalLabels,
  goalSlugs,
  priceLabels,
  relatedGoalsDefault,
  serviceTypeLabels,
  sortLabels,
  venueLabels,
} from '../../lib/resultFilters';
import { useFormState } from 'react-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import { updateUserPreferencesFromSearch } from '../actions/recommendations';
import type { Recommendation } from '../actions/recommendationTypes';

const nearbyCities = ['Oslo', 'Bærum', 'Drammen', 'Asker', 'Lillestrøm'];

type ResultsViewProps = {
  filters: ResultsFilters;
  cityKey: string;
  rawCity: string;
  results: RankedService[];
  invalidCity: boolean;
  hasSupabase: boolean;
  locationLabel?: string;
  searchQuery?: string;
  lat?: number;
  lon?: number;
};

export default function ResultsView({
  filters,
  cityKey,
  rawCity,
  results,
  invalidCity,
  hasSupabase,
  locationLabel,
  searchQuery,
  lat,
  lon,
}: ResultsViewProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const searchTrackedRef = useRef<string | null>(null);
  const searchQueryParam = searchParams.get('q') ?? '';
  const [searchInput, setSearchInput] = useState(searchQueryParam);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);

  const [session, setSession] = useState<Session | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recommendationStatus, setRecommendationStatus] = useState<'idle' | 'loading' | 'error'>(
    'idle'
  );
  const [, preferencesAction] = useFormState(updateUserPreferencesFromSearch, {
    ok: false,
    message: '',
  });

  const normalizedParams = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (!params.get('location') && params.get('city')) {
      params.set('location', params.get('city') as string);
      params.delete('city');
    }
    return params;
  }, [searchParams]);

  useEffect(() => {
    setSearchInput(searchQueryParam);
  }, [searchQueryParam]);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setVisibleCount(10);
  }, [results]);

  const visibleResults = useMemo(() => results.slice(0, visibleCount), [results, visibleCount]);
  const canLoadMore = visibleCount < results.length;
  const loadMoreResults = useCallback(() => {
    setVisibleCount((prev) => Math.min(results.length, prev + 10));
  }, [results.length]);

  const normalizedQueryString = normalizedParams.toString();
  const explicitSearchQuery = searchQuery?.trim() ?? '';
  const activeQuery = explicitSearchQuery || searchQueryParam.trim();
  const hasActiveQuery = activeQuery.length > 0;
  const resetSearchHref = (() => {
    const params = new URLSearchParams(normalizedParams.toString());
    params.delete('q');
    const query = params.toString();
    return `/resultater${query ? `?${query}` : ''}`;
  })();

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchInput(value);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(normalizedParams.toString());
      const trimmedValue = value.trim();
      if (trimmedValue) {
        params.set('q', trimmedValue);
      } else {
        params.delete('q');
      }
      const queryString = params.toString();
      router.replace(`/resultater${queryString ? `?${queryString}` : ''}`);
    }, 300);
  };

  const queryString = normalizedQueryString;

  useEffect(() => {
    if (!rawCity || !cityKey) return;
    const signature = JSON.stringify({
      cityKey,
      filters,
    });
    if (searchTrackedRef.current === signature) return;
    searchTrackedRef.current = signature;
    trackEvent({
      type: 'search_performed',
      metadata: {
        location: rawCity,
        goal: filters.goal === 'any' ? null : filters.goal,
        serviceType: filters.serviceType === 'any' ? null : filters.serviceType,
        budget: filters.budget === 'any' ? null : filters.budget,
        venue: filters.venue,
        sort: filters.sortBy,
      },
    });
  }, [cityKey, filters, rawCity]);

  useEffect(() => {
    if (!supabase) return;
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) setSession(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (isMounted) setSession(newSession);
    });
    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const filtersSignature = `${filters.goal}-${filters.serviceType}-${filters.budget}-${filters.venue}-${locationLabel ?? ''}-${lat ?? ''}-${lon ?? ''}`;

  useEffect(() => {
    if (!session?.access_token) return;
    const payload = async () => {
      const formData = new FormData();
      formData.set('accessToken', session.access_token);
      formData.set('locationLabel', locationLabel ?? rawCity ?? cityKey);
      formData.set('cityKey', cityKey);
      if (typeof lat === 'number') {
        formData.set('lat', String(lat));
      }
      if (typeof lon === 'number') {
        formData.set('lon', String(lon));
      }
      formData.set('goal', filters.goal);
      formData.set('serviceType', filters.serviceType);
      formData.set('budget', filters.budget);
      formData.set('venue', filters.venue);
      await preferencesAction(formData);
    };
    payload();
  }, [session?.access_token, filtersSignature, cityKey, locationLabel, rawCity, lat, lon]);

  const existingResultIds = useMemo(
    () => new Set(results.map((item) => item.service.id)),
    [results]
  );

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!session?.access_token) {
        setRecommendations([]);
        return;
      }
      setRecommendationStatus('loading');
      try {
        const response = await fetch('/api/recommendations?limit=5', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (!response.ok) {
          throw new Error('Kunne ikke hente anbefalinger.');
        }
        const data = await response.json();
        const items: Recommendation[] = Array.isArray(data.recommendations)
          ? data.recommendations.filter((recommendation: Recommendation) => {
              return !existingResultIds.has(recommendation.serviceId);
            })
          : [];
        setRecommendations(items.slice(0, 5));
        setRecommendationStatus('idle');
      } catch {
        setRecommendations([]);
        setRecommendationStatus('error');
      }
    };
    fetchRecommendations();
  }, [session?.access_token, filtersSignature, existingResultIds]);

  const goalSlug = filters.goal === 'any' ? null : goalSlugs[filters.goal];

  const relatedGoals = useMemo(() => {
    if (filters.goal === 'any') return relatedGoalsDefault.slice(0, 4);
    return relatedGoalsDefault.filter((item) => item !== filters.goal).slice(0, 4);
  }, [filters.goal]);

  const hasNoResults = results.length === 0;
  const recommendationHeading = locationLabel
    ? `Anbefalt for deg i ${locationLabel}`
    : 'Anbefalt for deg';
  const recommendationHeadingSmall = locationLabel
    ? `Anbefalt for deg i ${locationLabel}`
    : 'Anbefalt for deg';
  const showRecommendations = recommendations.length > 0;
  const renderRecommendationList = (items: Recommendation[]) => (
    <div className="space-y-3">
      {items.map((recommendation) => {
        const href = queryString
          ? `/tilbyder/${recommendation.serviceId}?${queryString}`
          : `/tilbyder/${recommendation.serviceId}`;
        return (
          <div
            key={recommendation.serviceId}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-base font-semibold text-slate-900">{recommendation.name}</p>
                <p className="text-xs text-slate-500">{recommendation.description}</p>
              </div>
              <span className="text-xs text-slate-500">
                {recommendation.priceLevel === 'low' ? 'Lav pris' : recommendation.priceLevel}
              </span>
            </div>
            <p className="mt-2 text-xs text-rose-600">{recommendation.reason}</p>
            <div className="mt-3 flex flex-col gap-2">
              <ButtonLink href={href}>Se tilbud</ButtonLink>
              <span className="text-xs text-slate-500">Gratis å sende forespørsel</span>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (invalidCity) {
    return (
      <main className={`${container} py-16`}>
        <Card>
          <h1 className="text-2xl font-semibold text-slate-900">Vi finner ikke byen din</h1>
          <p className="mt-3 text-sm text-slate-600">
            Skriv inn en gyldig by for å få treff i nærheten av deg.
          </p>
          <ButtonLink href="/flyt" className="mt-6">
            Gå tilbake til flyten
          </ButtonLink>
        </Card>
      </main>
    );
  }

  return (
    <main className={`${container} py-12`}>
      {!hasSupabase && (
        <Card className="mb-6 border-amber-200 bg-amber-50 text-sm text-amber-700">
          Søket benytter lokal matching fordi DB-funksjonaliteten ikke var tilgjengelig.
        </Card>
      )}

      <section className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {locationLabel ? `Resultater nær ${locationLabel}` : 'Resultater'}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">
              Dette passer basert på valgene dine
            </h1>
            <p className="mt-2 text-sm text-slate-600">Rangert etter hva som matcher deg best.</p>
            {filters.goal !== 'any' && cityKey && goalSlug && (
              <Link
                href={`/trening/${cityKey}/${goalSlug}${queryString ? `?${queryString}` : ''}`}
                className="mt-3 inline-flex text-sm font-semibold text-slate-700 hover:text-slate-900"
              >
                Trening for {goalLabels[filters.goal]} i {rawCity || cityKey}
              </Link>
            )}
          </div>
        </div>

        <div className="sticky top-0 z-30 border-y border-slate-200 bg-white/95 px-3 py-3 backdrop-blur backdrop-saturate-150">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
              <label htmlFor="sort" className="text-xs uppercase tracking-wide text-slate-500">
                Sorter
              </label>
              <select
                id="sort"
                value={filters.sortBy}
                onChange={(event) => {
                  const params = new URLSearchParams(normalizedParams.toString());
                  params.set('sort', event.target.value);
                  router.replace(`/resultater?${params.toString()}`);
                }}
                className={`${input} min-w-[130px]`}
              >
                {Object.entries(sortLabels).map(([value, labelText]) => (
                  <option key={value} value={value}>
                    {labelText}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full max-w-[360px]">
              <label className="text-xs uppercase tracking-wide text-slate-500">Søk blant treff</label>
              <input
                id="search"
                type="search"
                value={searchInput}
                onChange={handleSearchChange}
                placeholder="yoga, rehab, crossfit"
                className={`${input} mt-1`}
              />
              {hasActiveQuery && (
                <p className="mt-1 text-xs text-slate-600">Viser treff for «{activeQuery}»</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <Card className="mt-6">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ditt valg</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip>Mål: {filters.goal === 'any' ? 'Alle' : goalLabels[filters.goal]}</Chip>
          <Chip>Type: {serviceTypeLabels[filters.serviceType]}</Chip>
          <Chip>Budsjett: {budgetLabels[filters.budget]}</Chip>
          <Chip>Sted: {venueLabels[filters.venue]}</Chip>
        </div>
      </Card>

      <div className="mt-6">
        <LocalHighlights
          cityKey={cityKey}
          cityLabel={rawCity || cityKey}
          title="Relaterte søk"
          goals={relatedGoals}
        />
      </div>

      {hasNoResults && (
        <Card className="mt-8 border-amber-200 bg-amber-50 text-sm text-amber-700">
          <p className="text-base font-semibold">
            {hasActiveQuery ? (
              <>Vi fant ingen treff som matcher «{activeQuery}» i {rawCity || cityKey}.</>
            ) : (
              <>
                Vi fant ingen treff i {rawCity || cityKey} – men det betyr ikke at du er tom for
                muligheter.
              </>
            )}
          </p>
          <div className="mt-3 space-y-1 text-sm text-amber-700">
            <p>Prøv nærliggende byer eller utvid området.</p>
          </div>
          {hasActiveQuery && (
            <div className="mt-4 flex flex-wrap gap-2">
              <ButtonLink href={resetSearchHref} variant="secondary">
                Nullstill søk
              </ButtonLink>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {nearbyCities.map((city) => {
              const params = new URLSearchParams(normalizedParams.toString());
              params.set('location', city);
              return (
                <Link
                  key={city}
                  href={`/resultater?${params.toString()}`}
                  className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700"
                >
                  {city}
                </Link>
              );
            })}
          </div>
          <div className="mt-4">
            <ButtonLink href="/flyt" variant="secondary">
              Endre valg
            </ButtonLink>
          </div>
        </Card>
      )}
      {hasNoResults && showRecommendations && (
        <Card className="mt-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Neste beste valg</p>
            <p className="mt-1 text-sm text-slate-600">{recommendationHeadingSmall}</p>
          </div>
          <div className="mt-4">{renderRecommendationList(recommendations)}</div>
        </Card>
      )}

      {!hasNoResults && (
        <>
          <div className="mt-8 grid gap-4">
            {visibleResults.map((item) => {
              const href = queryString
                ? `/tilbyder/${item.service.id}?${queryString}`
                : `/tilbyder/${item.service.id}`;
              return (
                <Card key={item.service.id} className="p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">{item.service.name}</h2>
                      <p className="mt-1 text-sm text-slate-600">{item.service.description}</p>
                    </div>
                    <div className="text-sm text-slate-500">{serviceTypeLabels[item.service.type]}</div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                    <Chip>Prisniv�: {priceLabels[item.service.price_level]}</Chip>
                    <Chip>
                      Rating: {item.service.rating_avg.toFixed(1)} ({item.service.rating_count})
                    </Chip>
                    <Chip variant="accent">{item.matchReason}</Chip>
                    {typeof item.distanceKm === 'number' && (
                      <Chip>{item.distanceKm.toFixed(1)} km unna</Chip>
                    )}
                  </div>

                  {item.reasons.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                      {item.reasons.slice(0, 2).map((reason) => (
                        <Chip key={reason} variant="outline">
                          {reason}
                        </Chip>
                      ))}
                      {item.reasons.length > 2 && (
                        <Chip variant="outline">+{item.reasons.length - 2} til</Chip>
                      )}
                    </div>
                  )}

                  <div className="mt-5 flex flex-col gap-2">
                    <ButtonLink
                      href={href}
                      className="w-full min-h-[48px]"
                      onClick={() => {
                        trackEvent({
                          type: 'result_clicked',
                          serviceId: item.service.id,
                          metadata: {
                            location: rawCity,
                            sort: filters.sortBy,
                          },
                        });
                      }}
                    >
                      Se tilbud
                    </ButtonLink>
                    <span className="text-xs text-slate-500">Gratis � sende foresp�rsel</span>
                  </div>
                </Card>
              );
            })}
          </div>
          {canLoadMore && (
            <div className="mt-4 flex justify-center">
              <Button type="button" variant="secondary" onClick={loadMoreResults}>
                Last flere
              </Button>
            </div>
          )}
        </>
      )}
      {!hasNoResults && showRecommendations && (
        <Card className="mt-8">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Neste beste valg</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{recommendationHeading}</h2>
            <p className="text-sm text-slate-600">
              Vi foreslår tjenester basert på det du nettopp søkte etter.
            </p>
          </div>
          <div className="mt-4">{renderRecommendationList(recommendations)}</div>
        </Card>
      )}
    </main>
  );
}
