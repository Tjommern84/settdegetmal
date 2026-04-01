'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { RankedService } from '../../lib/matching';
import type { SortBy } from '../../lib/matching';
import { sortLabels, serviceTypeLabels } from '../../lib/resultFilters';

const PAGE_SIZE = 10;

type Props = {
  nationwide: RankedService[];
  local: RankedService[];
  categoryLabel: string;
  locationLabel: string | null;
  sort: SortBy;
};

function ServiceCard({ item }: { item: RankedService }) {
  const { service } = item;
  const typeLabel =
    (serviceTypeLabels as Record<string, string>)[service.type] ?? service.type;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 text-base leading-snug">
            {service.name}
          </h3>
          {service.description && (
            <p className="mt-1 text-sm text-slate-500 line-clamp-2">{service.description}</p>
          )}
        </div>
        <span className="shrink-0 mt-1 sm:mt-0 text-xs font-medium text-slate-400">
          {typeLabel}
        </span>
      </div>

      {/* Badges */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.matchReason && (
          <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">
            {item.matchReason}
          </span>
        )}
        {typeof item.distanceKm === 'number' && (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
            {item.distanceKm.toFixed(1)} km
          </span>
        )}
        {service.rating_avg > 0 && (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
            ★ {service.rating_avg.toFixed(1)}
          </span>
        )}
      </div>

      {/* Contact info */}
      {(service.address || service.phone || service.email || service.website) && (
        <div className="mt-3 space-y-0.5 text-xs text-slate-500">
          {service.address && <p>📍 {service.address}</p>}
          {service.phone && (
            <p>
              📞{' '}
              <a href={`tel:+47${service.phone}`} className="hover:underline hover:text-slate-700">
                {service.phone}
              </a>
            </p>
          )}
          {service.email && (
            <p>
              ✉️{' '}
              <a href={`mailto:${service.email}`} className="hover:underline hover:text-slate-700">
                {service.email}
              </a>
            </p>
          )}
          {service.website && (
            <p>
              🌐{' '}
              <a
                href={
                  service.website.startsWith('http')
                    ? service.website
                    : `https://${service.website}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline hover:text-slate-700"
              >
                {service.website.replace(/^https?:\/\//, '')}
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ResultSection({
  title,
  items,
}: {
  title: string;
  items: RankedService[];
}) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const shown = items.slice(0, visible);
  const canLoadMore = visible < items.length;

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-700 mb-3">{title}</h2>
      <div className="space-y-3">
        {shown.map((item) => (
          <ServiceCard key={item.service.id} item={item} />
        ))}
      </div>
      {canLoadMore && (
        <button
          type="button"
          onClick={() => setVisible((v) => Math.min(items.length, v + PAGE_SIZE))}
          className="mt-4 w-full rounded-lg border border-slate-300 bg-white py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Last {Math.min(PAGE_SIZE, items.length - visible)} til
        </button>
      )}
    </div>
  );
}

export default function ResultsView({
  nationwide,
  local,
  categoryLabel,
  locationLabel,
  sort,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Fire-and-forget: background city refresh (24hr cooldown enforced server-side)
  useEffect(() => {
    const city = locationLabel?.split(',')[0].trim().toLowerCase();
    if (!city) return;
    fetch('/api/refresh-city', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city }),
    }).catch(() => { /* ignore errors — this is best-effort */ });
  }, [locationLabel]);

  const handleSortChange = useCallback(
    (newSort: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('sort', newSort);
      router.replace(`/resultater?${params.toString()}`);
    },
    [router, searchParams]
  );

  const hasResults = nationwide.length > 0 || local.length > 0;

  const localHeading = useMemo(() => {
    if (locationLabel) return `Nær ${locationLabel}`;
    return 'I ditt område';
  }, [locationLabel]);

  return (
    <div>
      {/* Sort bar */}
      <div className="flex items-center gap-3 mb-6">
        <label htmlFor="sort" className="text-xs uppercase tracking-wide text-slate-400 shrink-0">
          Sorter
        </label>
        <select
          id="sort"
          value={sort}
          onChange={(e) => handleSortChange(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-400"
        >
          {Object.entries(sortLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-400 ml-auto">
          {nationwide.length + local.length} treff
        </span>
      </div>

      {!hasResults && (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center">
          <p className="text-slate-500 text-sm">
            Ingen treff for denne kategorien akkurat nå.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-medium text-rose-600 hover:underline"
          >
            ← Gå tilbake
          </Link>
        </div>
      )}

      <div className="space-y-10">
        {locationLabel && local.length > 0 && (
          <ResultSection title={localHeading} items={local} />
        )}
        {nationwide.length > 0 && (
          <ResultSection
            title={locationLabel ? 'Tilgjengelig i hele Norge' : 'Landsdekkende tilbud'}
            items={nationwide}
          />
        )}
        {!locationLabel && local.length > 0 && (
          <ResultSection title={localHeading} items={local} />
        )}
      </div>
    </div>
  );
}
