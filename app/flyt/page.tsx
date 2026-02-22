'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Answers, Budget, Goal, HomeOrGym, ServiceType } from '../../lib/types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { container } from '../../lib/ui';

type LocationSuggestion = {
  label: string;
  city?: string | null;
  country?: string | null;
  lat: number;
  lon: number;
};

const goals: Goal[] = [
  'Komme i form',
  'Bygge muskler',
  'Vektnedgang',
  'Bevegelighet',
  'Bedre kondisjon',
];

const serviceTypes: ServiceType[] = ['PT', 'Treningssenter', 'Yoga', 'Hjemmetrening'];
const budgets: Budget[] = ['Spiller ingen rolle', 'Lav', 'Middels', 'Høy'];
const homeOrGymOptions: HomeOrGym[] = ['Hjemme', 'Senter', 'Spiller ingen rolle'];

const steps = [
  { key: 'goal', title: 'Hva er hovedmålet ditt?' },
  { key: 'serviceType', title: 'Hvilken type tilbud ønsker du?' },
  { key: 'location', title: 'Hvor holder du til?' },
  { key: 'budget', title: 'Hva er budsjettet ditt?' },
  { key: 'homeOrGym', title: 'Foretrekker du hjemme eller senter?' },
] as const;

const optionBase =
  'w-full rounded-xl border px-4 py-3 text-left text-sm transition min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2';

export default function FlowPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({
    goal: goals[0],
    serviceType: serviceTypes[0],
    location: '',
    budget: budgets[0],
    homeOrGym: homeOrGymOptions[2],
  });
  const [locationQuery, setLocationQuery] = useState('');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  const isLastStep = stepIndex === steps.length - 1;

  const progress = useMemo(() => {
    return Math.round(((stepIndex + 1) / steps.length) * 100);
  }, [stepIndex]);

  const goNext = () => {
    if (isLastStep) {
      const params = new URLSearchParams({
        goal: answers.goal,
        serviceType: answers.serviceType,
        location: answers.location,
        budget: answers.budget,
        homeOrGym: answers.homeOrGym,
        locationLabel: answers.locationLabel ?? answers.location,
      });
      if (typeof answers.locationLat === 'number') {
        params.set('lat', answers.locationLat.toString());
      }
      if (typeof answers.locationLon === 'number') {
        params.set('lon', answers.locationLon.toString());
      }
      router.push(`/resultater?${params.toString()}`);
      return;
    }
    setStepIndex((prev) => prev + 1);
  };

  const goBack = () => {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  useEffect(() => {
    setLocationQuery(answers.location);
  }, [answers.location]);

  useEffect(() => {
    if (!locationQuery.trim()) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoadingSuggestions(true);
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(locationQuery.trim())}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          setSuggestions([]);
          return;
        }
        const data = (await response.json()) as LocationSuggestion[];
        setSuggestions(data);
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [locationQuery]);

  const selectSuggestion = (suggestion: LocationSuggestion) => {
    setAnswers((prev) => ({
      ...prev,
      location: suggestion.label,
      locationLabel: suggestion.label,
      locationLat: suggestion.lat,
      locationLon: suggestion.lon,
    }));
    setLocationQuery(suggestion.label);
    setSuggestions([]);
  };

  const handleLocationChange = (value: string) => {
    setAnswers((prev) => ({
      ...prev,
      location: value,
      locationLabel: undefined,
      locationLat: undefined,
      locationLon: undefined,
    }));
    setLocationQuery(value);
  };

  return (
    <main className={`${container} py-10 pb-24`}>
      <div className="mx-auto w-full max-w-md space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Steg {stepIndex + 1} av {steps.length}</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-slate-900 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <Card className="p-6 sm:p-8">
          <h1 className="text-2xl font-semibold text-slate-900">{steps[stepIndex].title}</h1>

        {steps[stepIndex].key === 'goal' && (
          <div className="mt-6 grid gap-3">
            {goals.map((goal) => (
              <button
                key={goal}
                type="button"
                onClick={() => setAnswers((prev) => ({ ...prev, goal }))}
                className={`${optionBase} ${
                  answers.goal === goal
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                }`}
              >
                {goal}
              </button>
            ))}
          </div>
        )}

        {steps[stepIndex].key === 'serviceType' && (
          <div className="mt-6 grid gap-3">
            {serviceTypes.map((serviceType) => (
              <button
                key={serviceType}
                type="button"
                onClick={() => setAnswers((prev) => ({ ...prev, serviceType }))}
                className={`${optionBase} ${
                  answers.serviceType === serviceType
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                }`}
              >
                {serviceType}
              </button>
            ))}
          </div>
        )}

        {steps[stepIndex].key === 'location' && (
          <div className="mt-6">
            <div className="relative">
              <Input
                type="text"
                value={locationQuery}
                onChange={(event) => handleLocationChange(event.target.value)}
                placeholder="F.eks. Oslo eller Bergen"
                aria-label="Hvor holder du til"
              />
              {suggestions.length > 0 && (
                <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-lg">
                  {suggestions.map((suggestion) => (
                    <button
                      key={`${suggestion.label}-${suggestion.lat}-${suggestion.lon}`}
                      type="button"
                      onClick={() => selectSuggestion(suggestion)}
                      className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <div className="font-semibold">{suggestion.label}</div>
                      <div className="text-xs text-slate-500">
                        {suggestion.city ? `${suggestion.city}` : suggestion.country ?? ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Vi bruker lokasjon for å finne tilbydere i nærheten din.
            </p>
            {isLoadingSuggestions && (
              <p className="mt-2 text-xs text-blue-600">Laster forslag …</p>
            )}
          </div>
        )}

        {steps[stepIndex].key === 'budget' && (
          <div className="mt-6 grid gap-3">
            {budgets.map((budget) => (
              <button
                key={budget}
                type="button"
                onClick={() => setAnswers((prev) => ({ ...prev, budget }))}
                className={`${optionBase} ${
                  answers.budget === budget
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                }`}
              >
                {budget}
              </button>
            ))}
          </div>
        )}

        {steps[stepIndex].key === 'homeOrGym' && (
          <div className="mt-6 grid gap-3">
            {homeOrGymOptions.map((homeOrGym) => (
              <button
                key={homeOrGym}
                type="button"
                onClick={() => setAnswers((prev) => ({ ...prev, homeOrGym }))}
                className={`${optionBase} ${
                  answers.homeOrGym === homeOrGym
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                }`}
              >
                {homeOrGym}
              </button>
            ))}
          </div>
        )}

        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:static md:px-0 md:border-0">
        <div className="mx-auto flex max-w-md flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Button
            type="button"
            variant="secondary"
            onClick={goBack}
            disabled={stepIndex === 0}
            className="min-h-[48px] w-full md:w-auto md:flex-1"
          >
            Tilbake
          </Button>
          <Button
            type="button"
            onClick={goNext}
            className="min-h-[48px] w-full md:w-auto md:flex-1"
          >
            {isLastStep ? 'Vis forslag' : 'Neste'}
          </Button>
          {isLastStep && (
            <span className="text-xs text-slate-500 md:hidden">Du forplikter deg ikke til noe</span>
          )}
        </div>
      </div>
    </main>
  );
}
