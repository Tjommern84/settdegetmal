'use client';

import Image from 'next/image';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useFormState } from 'react-dom';
import type { Session } from '@supabase/supabase-js';
import type { Goal, Service } from '../../../lib/domain';
import { AvailabilitySlot, formatSlotLabel } from '../../../lib/booking';
import { cityCoordinates, normalizeCity } from '../../../lib/matching';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import { trackEvent } from '../../../lib/analytics';
import { getMissingConsents, type ConsentType } from '../../../lib/consents';
import { ENABLE_PAYMENTS, ENABLE_PILOT_MODE, ENABLE_REVIEWS } from '../../../lib/featureFlags';
import {
  canReview,
  claimService,
  createLead,
  getReviewSummary,
  getReviews,
  getServiceOwner,
  submitReview,
  type LeadActionState,
  type ReviewActionState,
} from './actions';
import { Button, ButtonLink } from '../../../components/ui/Button';
import { Input, Textarea } from '../../../components/ui/Input';
import { Card } from '../../../components/ui/Card';
import { Chip } from '../../../components/ui/Chip';
import { container, input, label } from '../../../lib/ui';

const goalLabels: Record<Goal, string> = {
  weight_loss: 'Vektnedgang',
  strength: 'Styrke',
  mobility: 'Mobilitet',
  rehab: 'Rehab',
  endurance: 'Utholdenhet',
  start: 'Starte',
};

const goalSlugs: Record<Goal, string> = {
  weight_loss: 'vektnedgang',
  strength: 'styrke',
  mobility: 'mobilitet',
  rehab: 'rehab',
  endurance: 'utholdenhet',
  start: 'nybegynner',
};

const cityDisplayNames: Record<string, string> = {
  oslo: 'Oslo',
  bærum: 'Bærum',
  drammen: 'Drammen',
  lillestrøm: 'Lillestrøm',
  asker: 'Asker',
  bergen: 'Bergen',
  trondheim: 'Trondheim',
  stavanger: 'Stavanger',
  kristiansand: 'Kristiansand',
  tromsø: 'Tromsø',
};

const typeLabels: Record<Service['type'], string> = {
  pt: 'Personlig trener',
  gym: 'Treningssenter',
  yoga: 'Yoga',
  course: 'Kurs',
};

const priceLabels: Record<Service['price_level'], string> = {
  low: 'Lav',
  medium: 'Middels',
  high: 'Høy',
};

const venueLabels: Record<'home' | 'gym' | 'online', string> = {
  home: 'Hjemme',
  gym: 'Senter',
  online: 'Online',
};

const formatCoverage = (service: Service) =>
  service.coverage.map((rule) => {
    if (rule.type === 'region') {
      return rule.region === 'norway' ? 'Hele Norge' : 'Hele Norden';
    }
    if (rule.type === 'cities') {
      return rule.cities.join(', ');
    }
    return `Innenfor ${rule.radius_km} km fra (${rule.center.lat}, ${rule.center.lon})`;
  });

const getPreferredCityKey = (service: Service, rawCity: string) => {
  const normalizedFromQuery = normalizeCity(rawCity);
  if (normalizedFromQuery && normalizedFromQuery in cityCoordinates) {
    return normalizedFromQuery;
  }

  for (const rule of service.coverage) {
    if (rule.type === 'cities') {
      const candidate = normalizeCity(rule.cities[0] ?? '');
      if (candidate && candidate in cityCoordinates) {
        return candidate;
      }
    }
  }

  return 'oslo';
};

type FormState = {
  name: string;
  email: string;
  message: string;
};

type ReviewFormState = {
  rating: number;
  comment: string;
};

type ReviewItem = {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
};

type ProviderClientProps = {
  params: { id: string };
  service: Service | null;
};

export default function ProviderClient({ params, service: initialService }: ProviderClientProps) {
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const backHref = queryString ? `/resultater?${queryString}` : '/resultater';
  const rawCity = searchParams.get('location') ?? searchParams.get('city') ?? '';

  const [service, setService] = useState<Service | null>(initialService);
  useEffect(() => {
    setService(initialService);
  }, [initialService]);
  const profileTrackedRef = useRef<string | null>(null);
  const cityKey = useMemo(
    () => (service ? getPreferredCityKey(service, rawCity) : ''),
    [service, rawCity]
  );
  const cityName = useMemo(() => {
    if (!cityKey) return '';
    const normalizedRaw = normalizeCity(rawCity);
    if (rawCity && normalizedRaw === cityKey) return rawCity;
    return cityDisplayNames[cityKey] ?? cityKey;
  }, [cityKey, rawCity]);

  const [formState, setFormState] = useState<FormState>({
    name: '',
    email: '',
    message: '',
  });
  const [reviewFormState, setReviewFormState] = useState<ReviewFormState>({
    rating: 5,
    comment: '',
  });
  const [session, setSession] = useState<Session | null>(null);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewSummary, setReviewSummary] = useState({ avg: 0, count: 0 });
  const [reviewStatus, setReviewStatus] = useState<'idle' | 'loading'>('idle');
  const [reviewEligibility, setReviewEligibility] = useState<{
    canReview: boolean;
    leadId?: string;
  }>({ canReview: false });
  const [missingConsents, setMissingConsents] = useState<ConsentType[]>([]);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const claimInitialState = { ok: false, status: 'not_found', message: '' } as const;
  const [claimState, claimAction] = useFormState(claimService, claimInitialState);

  const initialState: LeadActionState = { ok: false, message: '' };
  const [state, formAction] = useFormState(createLead, initialState);
  const [isRequestModalOpen, setRequestModalOpen] = useState(false);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const modalHadOpenRef = useRef(false);
  const openRequestModal = useCallback(() => setRequestModalOpen(true), []);
  const closeRequestModal = useCallback(() => setRequestModalOpen(false), []);
  const openRequestModalWithTrigger = useCallback(
    (trigger: HTMLButtonElement) => {
      lastTriggerRef.current = trigger;
      openRequestModal();
    },
    [openRequestModal]
  );
  const handleOpenRequestModal = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      openRequestModalWithTrigger(event.currentTarget);
    },
    [openRequestModalWithTrigger]
  );
  const [suggestedTimes, setSuggestedTimes] = useState(['', '', '']);
  const handleSuggestedTimeChange = (index: number, value: string) => {
    setSuggestedTimes((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };
  const availabilityHint = useMemo(() => {
    if (availabilityLoading) return 'Laster tilgjengelighet …';
    if (availability.length === 0) return 'Tilbyderen har ikke publisert tilgjengelighet enda.';
    const summary = availability.slice(0, 3).map((slot) => formatSlotLabel(slot)).join(', ');
    return `Tilbyderen er ofte tilgjengelig: ${summary}`;
  }, [availability, availabilityLoading]);
  const reviewInitialState: ReviewActionState = { ok: false, message: '' };
  const [reviewState, reviewAction] = useFormState(submitReview, reviewInitialState);

  useEffect(() => {
    if (!supabase) return;
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) setSession(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    const fullName =
      typeof session.user.user_metadata?.full_name === 'string'
        ? session.user.user_metadata.full_name
        : '';
    setFormState((prev) => ({
      name: prev.name || fullName,
      email: prev.email || session.user.email || '',
      message: prev.message,
    }));
  }, [session]);

  useEffect(() => {
    if (!session?.access_token) {
      setMissingConsents([]);
      return;
    }
    let isMounted = true;
    getMissingConsents(session.access_token)
      .then((missing) => {
        if (!isMounted) return;
        setMissingConsents(missing);
      })
      .catch(() => {
        if (!isMounted) return;
        setMissingConsents([]);
      });
    return () => {
      isMounted = false;
    };
  }, [session?.access_token]);

  useEffect(() => {
    if (state.ok) {
      setSuggestedTimes(['', '', '']);
    }
  }, [state.ok]);

  useEffect(() => {
    if (!isRequestModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRequestModal();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isRequestModalOpen, closeRequestModal]);

  useEffect(() => {
    if (isRequestModalOpen) {
      modalHadOpenRef.current = true;
      firstInputRef.current?.focus();
      return;
    }
    if (modalHadOpenRef.current) {
      lastTriggerRef.current?.focus();
      modalHadOpenRef.current = false;
    }
  }, [isRequestModalOpen]);

  useEffect(() => {
    if (!service || !ENABLE_REVIEWS) return;
    setReviewStatus('loading');
    const loadReviews = async () => {
      const [reviewList, summary] = await Promise.all([
        getReviews(service.id),
        getReviewSummary(service.id),
      ]);
      setReviews(reviewList);
      setReviewSummary(summary);
      setReviewStatus('idle');
    };
    loadReviews();
  }, [service]);

  useEffect(() => {
    if (!service) return;
    const loadOwner = async () => {
      const owner = await getServiceOwner(service.id);
      setOwnerUserId(owner);
    };
    loadOwner();
  }, [service, claimState.ok]);

  useEffect(() => {
    if (!service?.id) {
      setAvailability([]);
      setAvailabilityLoading(false);
      return;
    }
    let isMounted = true;
    const loadAvailability = async () => {
      setAvailabilityLoading(true);
      try {
        const response = await fetch(`/api/availability?serviceId=${service.id}`);
        if (!response.ok) return;
        const payload = (await response.json()) as AvailabilitySlot[];
        if (isMounted && Array.isArray(payload)) {
          setAvailability(payload);
        }
      } catch {
        // ignore
      } finally {
        if (isMounted) {
          setAvailabilityLoading(false);
        }
      }
    };
    loadAvailability();
    return () => {
      isMounted = false;
    };
  }, [service?.id]);

  useEffect(() => {
    if (!service || !session?.access_token || !ENABLE_REVIEWS) {
      setReviewEligibility({ canReview: false });
      return;
    }
    const checkEligibility = async () => {
      const eligibility = await canReview(service.id, session.access_token);
      setReviewEligibility(eligibility);
    };
    checkEligibility();
  }, [service, session]);

  useEffect(() => {
    if (!reviewState.ok || !service || !ENABLE_REVIEWS) return;
    setReviewFormState({ rating: 5, comment: '' });
    setReviewEligibility({ canReview: false });
    const refresh = async () => {
      const [reviewList, summary] = await Promise.all([
        getReviews(service.id),
        getReviewSummary(service.id),
      ]);
      setReviews(reviewList);
      setReviewSummary(summary);
    };
    refresh();
  }, [reviewState.ok, service]);

  useEffect(() => {
    if (!service) return;
    if (profileTrackedRef.current === service.id) return;
    profileTrackedRef.current = service.id;
    trackEvent({
      type: 'profile_viewed',
      serviceId: service.id,
      metadata: {
        referrer: typeof document !== 'undefined' ? document.referrer : undefined,
      },
    });
  }, [service]);

  if (!service) {
    return (
      <main className={`${container} py-16`}>
        <Card>
          <h1 className="text-2xl font-semibold text-slate-900">Tilbyder ikke funnet</h1>
          <p className="mt-3 text-sm text-slate-600">
            Vi fant dessverre ikke denne tilbyderen.
          </p>
          <ButtonLink href={backHref} className="mt-6">
            Tilbake til resultater
          </ButtonLink>
        </Card>
      </main>
    );
  }

  const coverageLines = formatCoverage(service);
  const isServiceActive = service.is_active !== false;
  const isOwner = Boolean(session?.user?.id && ownerUserId && session.user.id === ownerUserId);
  const localGoals = service.goals.slice(0, 3);
  const heroLogoInitials = service.name
    .split(' ')
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('');

  return (
    <main className={`${container} pt-12 pb-32`}>
      <Link href={backHref} className="text-sm font-medium text-slate-500 hover:text-slate-700">
        Tilbake til resultater
      </Link>

      {!isServiceActive && (
        <Card className="mt-6 border-amber-200 bg-amber-50 text-sm text-amber-700">
          Denne tjenesten er midlertidig deaktivert.
        </Card>
      )}

      {ENABLE_PILOT_MODE && isOwner && (
        <Card className="mt-4 border-amber-200 bg-amber-50 text-sm text-amber-700">
          Pilot – funksjoner kan endres.
        </Card>
      )}

      <Card className="mt-6 overflow-hidden">
        <div className="relative h-56 w-full bg-slate-900 sm:h-72">
          {service.cover_image_url ? (
            <Image
              src={service.cover_image_url}
              alt={`${service.name} cover`}
              fill
              sizes="100vw"
              priority
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-transparent" />
          <div className="absolute bottom-4 left-4 flex items-center gap-4">
            {service.logo_image_url ? (
              <Image
                src={service.logo_image_url}
                alt={`${service.name} logo`}
                width={72}
                height={72}
                className="h-16 w-16 rounded-full border border-white/40 object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/40 bg-white/20 text-sm font-semibold uppercase tracking-wide text-white">
                {heroLogoInitials}
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
                {typeLabels[service.type]}
              </p>
              <h1 className="text-3xl font-semibold text-white">{service.name}</h1>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              {cityKey && localGoals.length > 0 && (
                <Link
                  href={`/trening/${cityKey}/${goalSlugs[localGoals[0]]}${
                    queryString ? `?${queryString}` : ''
                  }`}
                  className="text-sm font-semibold text-slate-700 hover:text-slate-900"
                >
                  Trening for {goalLabels[localGoals[0]]} i {cityName}
                </Link>
              )}
            </div>
            <div className="text-sm text-slate-600 space-y-1">
              <div>Prisnivå: {priceLabels[service.price_level]}</div>
              <div>
                {reviewSummary.count > 0
                  ? `Rating: ${reviewSummary.avg.toFixed(1)} (${reviewSummary.count})`
                  : 'Ingen vurderinger enda'}
              </div>
            </div>
          </div>

          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Beskrivelse
            </h2>
            <p className="mt-3 text-sm text-slate-700">{service.description}</p>
          </section>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Passer for mål
              </h2>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-700">
                {service.goals.map((goal) => (
                  <Chip key={goal}>{goalLabels[goal]}</Chip>
                ))}
              </div>
            </section>
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Tilbys som
              </h2>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-700">
                {service.venues.map((venue) => (
                  <Chip key={venue}>{venueLabels[venue]}</Chip>
                ))}
              </div>
            </section>
          </div>

          {cityKey && localGoals.length > 0 && (
            <section className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Relaterte søk
              </h2>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-700">
                {localGoals.map((goal) => (
                  <Link
                    key={`${cityKey}-${goal}`}
                    href={`/trening/${cityKey}/${goalSlugs[goal]}`}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
                  >
                    Trening for {goalLabels[goal]} i {cityName}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Dekning
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {coverageLines.map((line, index) => (
                <li
                  key={`${service.id}-coverage-${index}`}
                  className="rounded-lg bg-slate-50 px-3 py-2"
                >
                  {line}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Tags
            </h2>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-700">
              {service.tags.map((tag) => (
                <Chip key={tag} variant="outline">
                  {tag}
                </Chip>
              ))}
            </div>
          </section>
        </div>

        {!ownerUserId && (
          <Card className="mt-8 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-900">
              Er du ansvarlig for denne tjenesten?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Claim profilen for å få tilgang til leads og dashboard.
            </p>
            {claimState.message && (
              <div
                className={`mt-3 rounded-lg px-4 py-2 text-sm ${
                  claimState.ok
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border border-amber-200 bg-amber-50 text-amber-700'
                }`}
              >
                {claimState.message}
              </div>
            )}
            <form className="mt-4" action={claimAction}>
              <input type="hidden" name="serviceId" value={service.id} />
              <input type="hidden" name="accessToken" value={session?.access_token ?? ''} />
              <Button type="submit" disabled={!session || !isSupabaseConfigured}>
                Claim tjeneste
              </Button>
            </form>
            {claimState.ok && (
              <ButtonLink href="/dashboard" variant="secondary" className="mt-4">
                Gå til dashboard
              </ButtonLink>
            )}
          </Card>
        )}
      </Card>

      <Card className="mt-10 p-8">
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-slate-900">Send forespørsel</h2>
            <p className="mt-2 text-sm text-slate-600">
              Fortell kort om behovet ditt, så lagrer vi forespørselen din.
            </p>
            <p className="text-xs text-slate-500">
              Dette er bare en forespørsel - ikke en bestilling.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              Trykk på «Send forespørsel» nederst for å åpne skjemaet.
            </p>
            <Button
              type="button"
              className="hidden min-h-[48px] md:inline-flex"
              onClick={handleOpenRequestModal}
            >
              Send forespørsel
            </Button>
          </div>
        </div>
      </Card>
      <Card className="mt-10 p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Vurderinger</h2>
            <p className="mt-1 text-sm text-slate-600">
              Verifiserte vurderinger fra kunder som har sendt forespørsel.
            </p>
          </div>
        </div>

        {!ENABLE_REVIEWS && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Vurderinger kommer etter lansering. Fokus nå er rask matching og svar.
          </div>
        )}

        {ENABLE_REVIEWS && reviewStatus === 'loading' && (
          <div className="mt-4 text-sm text-slate-500">Laster vurderinger ...</div>
        )}

        {ENABLE_REVIEWS && reviews.length > 0 && (
          <div className="mt-6 grid gap-4">
            {reviews.map((review) => (
              <Card key={review.id} className="bg-slate-50">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">
                      {'★'.repeat(review.rating)}
                      <span className="text-slate-300">{'★'.repeat(5 - review.rating)}</span>
                    </span>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Verifisert kunde
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-700">{review.comment}</p>
              </Card>
            ))}
          </div>
        )}

        {ENABLE_REVIEWS && reviewStatus === 'idle' && reviews.length === 0 && (
          <div className="mt-6 text-sm text-slate-600">
            Ingen vurderinger enda. Bli den første til å dele erfaringen din.
          </div>
        )}

        {ENABLE_REVIEWS && reviewEligibility.canReview && isSupabaseConfigured && session && (
          <form className="mt-8 grid gap-4" action={reviewAction}>
            <input type="hidden" name="lead_id" value={reviewEligibility.leadId} />
            <input type="hidden" name="accessToken" value={session.access_token} />
            <div className="grid gap-2">
              <label htmlFor="rating" className={label}>
                Rating
              </label>
              <select
                id="rating"
                name="rating"
                value={reviewFormState.rating}
                onChange={(event) =>
                  setReviewFormState((prev) => ({
                    ...prev,
                    rating: Number(event.target.value),
                  }))
                }
                className={input}
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {value} stjerner
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <label htmlFor="comment" className={label}>
                Kommentar
              </label>
              <Textarea
                id="comment"
                name="comment"
                rows={4}
                value={reviewFormState.comment}
                onChange={(event) =>
                  setReviewFormState((prev) => ({ ...prev, comment: event.target.value }))
                }
              />
            </div>
            {reviewState.message && (
              <div
                className={`rounded-lg px-4 py-3 text-sm ${
                  reviewState.ok
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                {reviewState.message}
              </div>
            )}
            <Button type="submit" disabled={reviewState.ok}>
              Send vurdering
            </Button>
          </form>
        )}
      </Card>
      <div className="sm:hidden">
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur backdrop-saturate-150">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">Trygt og enkelt – ingen binding.</p>
            <Button
              type="button"
              className="min-h-[48px] px-4"
              onClick={handleOpenRequestModal}
            >
              Send forespørsel
            </Button>
          </div>
        </div>
      </div>

      {isRequestModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-slate-900/60" onClick={closeRequestModal} />
          <div
            className="relative w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:rounded-2xl sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Send forespørsel</h2>
              <button
                type="button"
                className="rounded-full p-2 text-slate-500 transition hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500"
                onClick={closeRequestModal}
              >
                <span className="sr-only">Lukk</span>
                ×
              </button>
            </div>
            <p className="text-sm text-slate-600">
              Fortell kort om behovet ditt, så lagrer vi forespørselen din.
            </p>
            <p className="text-xs text-slate-500">
              Dette er bare en forespørsel - ikke en bestilling.
            </p>
            <div className="mt-4 space-y-4">
              {!state.ok && state.message && (
                <div
                  className={`rounded-lg px-4 py-3 text-sm ${
                    state.ok
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border border-rose-200 bg-rose-50 text-rose-700'
                  }`}
                >
                  {state.message}
                </div>
              )}
              {!state.ok ? (
                <>
                  {missingConsents.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                      Du må godta vilkår og personvern før du kan sende forespørsel. Les mer på{' '}
                      <Link href="/vilkar" className="font-semibold underline">
                        vilkår
                      </Link>{' '}
                      og{' '}
                      <Link href="/personvern" className="font-semibold underline">
                        personvern
                      </Link>
                      .
                    </div>
                  )}
                  {!isServiceActive && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                      Denne tjenesten er deaktivert og kan ikke motta forespørsel.
                    </div>
                  )}
                  {!isSupabaseConfigured && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                      Supabase er ikke konfigurert. Legg inn miljøvariabler for å aktivere innlogging.
                    </div>
                  )}
                  {!ENABLE_PAYMENTS && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                      Forespørselssystemet er midlertidig stengt mens vi klargjør betaling.
                    </div>
                  )}
                  {!session && isSupabaseConfigured && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                      Logg inn for å sende forespørsel.
                    </div>
                  )}
                  <form className="grid gap-4" action={formAction}>
                    <input type="hidden" name="serviceId" value={service.id} />
                    <input type="hidden" name="accessToken" value={session?.access_token ?? ''} />
                    <div className="grid gap-2">
                      <label htmlFor="name" className={label}>
                        Navn
                      </label>
                      <Input
                        id="name"
                        type="text"
                        name="name"
                        value={formState.name}
                        onChange={(event) =>
                          setFormState((prev) => ({ ...prev, name: event.target.value }))
                        }
                        disabled={!session || !isSupabaseConfigured || !isServiceActive}
                        ref={firstInputRef}
                      />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="email" className={label}>
                        E-post
                      </label>
                      <Input
                        id="email"
                        type="email"
                        name="email"
                        value={formState.email}
                        onChange={(event) =>
                          setFormState((prev) => ({ ...prev, email: event.target.value }))
                        }
                        disabled={!session || !isSupabaseConfigured || !isServiceActive}
                      />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="message" className={label}>
                        Melding
                      </label>
                      <Textarea
                        id="message"
                        rows={5}
                        name="message"
                        value={formState.message}
                        onChange={(event) =>
                          setFormState((prev) => ({ ...prev, message: event.target.value }))
                        }
                        disabled={!session || !isSupabaseConfigured || !isServiceActive}
                      />
                    </div>
                    <div className="grid gap-2">
                      <p className={label}>Foreslå tid (valgfritt)</p>
                      <p className="text-xs text-slate-500">{availabilityHint}</p>
                      <div className="mt-2 grid gap-3 md:grid-cols-3">
                        {suggestedTimes.map((value, index) => (
                          <div key={index} className="space-y-1">
                            <p className="text-xs font-semibold text-slate-500">Tid {index + 1}</p>
                            <Input
                              type="datetime-local"
                              name="suggestions[]"
                              value={value}
                              onChange={(event) => handleSuggestedTimeChange(index, event.target.value)}
                              disabled={!session || !isSupabaseConfigured || !isServiceActive}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      Du forplikter deg ikke - du starter bare en dialog.
                    </p>
                    <Button
                      type="submit"
                      disabled={!session || !isSupabaseConfigured || !isServiceActive || !ENABLE_PAYMENTS}
                      className="w-full min-h-[48px]"
                    >
                      Send forespørsel
                    </Button>
                  </form>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                    <p className="font-semibold text-slate-900">Forespørsel sendt.</p>
                    <p>{state.message}</p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <ButtonLink href="/min-side" variant="secondary" className="w-full text-center">
                      Gå til Mine forespørsler
                    </ButtonLink>
                    <Button
                      variant="secondary"
                      className="w-full sm:w-auto"
                      type="button"
                      onClick={closeRequestModal}
                    >
                      Lukk
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
