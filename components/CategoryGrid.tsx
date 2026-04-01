'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIES, type CategoryConfig, type MainCategory } from '../lib/categoryConfig';

// ─── Types ──────────────────────────────────────────────────────────────────

type Suggestion = {
  label: string;
  city?: string | null;
  lat: number;
  lon: number;
};

type RadiusKm = 5 | 10 | 20 | 30;

type LocationState = {
  label: string;
  lat: number;
  lon: number;
  source: 'gps' | 'search' | 'saved';
  radius: RadiusKm;
  bydel?: string | null;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'sdem_location_v1';
const RADIUS_OPTIONS: RadiusKm[] = [5, 10, 20, 30];

const OSLO_BOROUGHS = [
  'Alna', 'Bjerke', 'Frogner', 'Gamle Oslo', 'Grorud', 'Grünerløkka',
  'Nordre Aker', 'Nordstrand', 'Sagene', 'St. Hanshaugen', 'Stovner',
  'Søndre Nordstrand', 'Ullern', 'Vestre Aker', 'Østensjø',
] as const;

const ACCENT: Record<MainCategory, {
  gradient: string;
  activeChip: string;
  ring: string;
}> = {
  'trene-selv': {
    gradient: 'from-amber-500/70 via-orange-400/40 to-transparent',
    activeChip: 'bg-amber-500 border-amber-500 text-white',
    ring: 'ring-amber-400',
  },
  'trene-sammen': {
    gradient: 'from-fuchsia-500/70 via-pink-400/40 to-transparent',
    activeChip: 'bg-fuchsia-500 border-fuchsia-500 text-white',
    ring: 'ring-fuchsia-400',
  },
  'oppfolging': {
    gradient: 'from-sky-500/70 via-cyan-400/40 to-transparent',
    activeChip: 'bg-sky-500 border-sky-500 text-white',
    ring: 'ring-sky-400',
  },
  'aktivitet-sport': {
    gradient: 'from-emerald-500/70 via-teal-400/40 to-transparent',
    activeChip: 'bg-emerald-500 border-emerald-500 text-white',
    ring: 'ring-emerald-400',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function firstPart(label: string): string {
  return label.split(',')[0]?.trim() || label;
}

function isOsloLabel(label: string): boolean {
  return firstPart(label).toLowerCase() === 'oslo';
}

// ─── LocationBar ─────────────────────────────────────────────────────────────
// Compact horizontal bar: search/GPS when no location, status chip when set

function LocationBar({
  location,
  setLocation,
}: {
  location: LocationState | null;
  setLocation: (v: LocationState | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isEditing, setIsEditing] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Restore from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as LocationState;
      if (parsed && typeof parsed.label === 'string' && typeof parsed.lat === 'number') {
        const bydel = isOsloLabel(parsed.label) ? parsed.bydel ?? null : null;
        setLocation({ ...parsed, source: 'saved', radius: parsed.radius ?? 10, bydel });
        setQuery(parsed.label);
        setIsEditing(false);
      }
    } catch { /* ignore */ }
  }, [setLocation]);

  // Debounced suggestions
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed || (location && trimmed === location.label)) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) setSuggestions((await res.json()) as Suggestion[]);
      } catch { /* noop */ } finally { setLoadingSuggestions(false); }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, location]);

  const persist = useCallback((next: LocationState | null) => {
    setLocation(next);
    if (!next) {
      localStorage.removeItem(STORAGE_KEY);
      setIsEditing(true);
      return;
    }
    setIsEditing(false);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, [setLocation]);

  const applySuggestion = (item: Suggestion) => {
    const label = item.city ?? firstPart(item.label);
    const radius = location?.radius ?? 10;
    const next: LocationState = {
      label, lat: item.lat, lon: item.lon, source: 'search', radius,
      bydel: isOsloLabel(label) ? location?.bydel ?? null : null,
    };
    persist(next);
    setQuery(next.label);
    setSuggestions([]);
    setShowSuggestions(false);
    setGeoError(null);
  };

  const reverseGeocode = async (lat: number, lon: number): Promise<string | null> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
        { headers: { 'Accept-Language': 'nb-NO,no,en' } }
      );
      if (!res.ok) return null;
      const d = await res.json() as { display_name?: string; address?: Record<string, string> };
      return d.address?.city || d.address?.town || d.address?.village ||
        d.address?.municipality || d.display_name || null;
    } catch { return null; }
  };

  const useGPS = () => {
    if (!navigator.geolocation) { setGeoError('GPS ikke støttet.'); return; }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lon = Number(pos.coords.longitude.toFixed(6));
        const label = (await reverseGeocode(lat, lon)) || 'Min lokasjon';
        persist({ label, lat, lon, source: 'gps', radius: location?.radius ?? 10, bydel: null });
        setQuery(label);
        setGeoLoading(false);
      },
      (err) => {
        setGeoLoading(false);
        setGeoError(err.code === 1 ? 'Posisjon avvist.' : 'Kunne ikke hente posisjon.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  };

  const isOsloSelected = !!(location && isOsloLabel(location.label));

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      {location && !isEditing ? (
        // ── Compact location display ──────────────────────────────────────
        <>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-green-400" />
            <span className="text-sm font-medium text-slate-800">
              {firstPart(location.label)}
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500">{location.radius} km</span>
          </div>

          {isOsloSelected && (
            <select
              value={location.bydel ?? ''}
              onChange={(e) => persist({ ...location, bydel: e.target.value || null })}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-200"
            >
              <option value="">Alle bydeler</option>
              {OSLO_BOROUGHS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => { setIsEditing(true); setTimeout(() => inputRef.current?.focus(), 0); }}
            className="text-xs font-medium text-slate-400 underline underline-offset-2 hover:text-slate-700 transition"
          >
            Endre
          </button>
          <button
            type="button"
            onClick={() => { persist(null); setQuery(''); }}
            className="text-xs text-slate-300 hover:text-slate-500 transition"
            aria-label="Nullstill lokasjon"
          >
            ✕
          </button>
        </>
      ) : (
        // ── Search mode ───────────────────────────────────────────────────
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="relative min-w-0 flex-1 max-w-xs">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && suggestions[0]) {
                  e.preventDefault();
                  applySuggestion(suggestions[0]);
                }
              }}
              placeholder="Sted eller postnummer…"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-amber-300 focus:ring-2 focus:ring-amber-200 transition"
              autoComplete="off"
            />
            {showSuggestions && (loadingSuggestions || suggestions.length > 0) && (
              <div className="absolute left-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                {loadingSuggestions && (
                  <p className="px-4 py-3 text-sm text-slate-400">Søker…</p>
                )}
                {!loadingSuggestions && suggestions.map((s) => (
                  <button
                    key={`${s.lat}-${s.lon}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applySuggestion(s)}
                    className="block w-full border-t border-slate-100 px-4 py-3 text-left first:border-t-0 hover:bg-amber-50 transition"
                  >
                    <span className="block text-sm font-medium text-slate-900">
                      {s.city || firstPart(s.label)}
                    </span>
                    <span className="block line-clamp-1 text-xs text-slate-400">{s.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={useGPS}
            disabled={geoLoading}
            className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 transition hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60"
          >
            {geoLoading ? 'Henter…' : 'Finn min posisjon'}
          </button>

          {geoError && (
            <span className="text-xs text-rose-600">{geoError}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CategoryCard ─────────────────────────────────────────────────────────────

function CategoryCard({
  config,
  selected,
  disabled,
  onClick,
  className = '',
}: {
  config: CategoryConfig;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  className?: string;
}) {
  const [imgIdx, setImgIdx] = useState(0);
  const [hovering, setHovering] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number | null>(null);
  const accent = ACCENT[config.key];

  useEffect(() => {
    if (hovering && config.images.length > 1) {
      intervalRef.current = setInterval(() => {
        setImgIdx((p) => (p + 1) % config.images.length);
      }, 1800);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [hovering, config.images.length]);

  const cycleImg = (dir: 1 | -1) =>
    setImgIdx((p) => (p + dir + config.images.length) % config.images.length);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onTouchStart={(e) => { touchStartX.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => {
        if (touchStartX.current == null) return;
        const delta = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
        if (Math.abs(delta) > 30) cycleImg(delta < 0 ? 1 : -1);
        touchStartX.current = null;
      }}
      className={[
        'group relative block w-full overflow-hidden rounded-2xl text-left',
        'border border-black/[0.08]',
        'shadow-[0_2px_24px_rgba(0,0,0,0.07)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.14)]',
        'transition-all duration-300 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        selected
          ? `ring-2 ${accent.ring} ring-offset-2 scale-[1.02]`
          : 'hover:-translate-y-1 hover:scale-[1.015]',
        disabled ? 'pointer-events-none opacity-40 grayscale' : 'cursor-pointer',
        className,
      ].join(' ')}
    >
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 will-change-transform group-hover:scale-105"
        style={{ backgroundImage: `url('${config.images[imgIdx]}')` }}
      />
      {/* Gradient overlays */}
      <div className={`absolute inset-0 bg-gradient-to-br ${accent.gradient}`} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col justify-between p-5">
        <div className="flex flex-wrap gap-1.5">
          {config.tags.slice(0, 3).map((t) => (
            <span
              key={t.value}
              className="rounded-full border border-white/25 bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm"
            >
              {t.label}
            </span>
          ))}
        </div>

        <div>
          {selected && (
            <span className="mb-1.5 inline-block rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-bold text-slate-900">
              Valgt
            </span>
          )}
          <h2 className="font-heading text-lg font-bold leading-tight text-white sm:text-xl">
            {config.label}
          </h2>
          <p className="mt-1 line-clamp-1 text-sm font-light text-white/75">
            {config.description}
          </p>
        </div>
      </div>

      {/* Image progress dots */}
      {config.images.length > 1 && (
        <div className="absolute bottom-4 right-4 flex items-center gap-1">
          {config.images.map((_, i) => (
            <span
              key={`${config.key}-dot-${i}`}
              className={[
                'h-1 rounded-full transition-all duration-300',
                i === imgIdx ? 'w-4 bg-white' : 'w-1 bg-white/40',
              ].join(' ')}
            />
          ))}
        </div>
      )}
    </button>
  );
}

// ─── TagPanel ─────────────────────────────────────────────────────────────────

function TagPanel({
  config,
  selectedTags,
  onToggle,
  onNavigate,
  location,
}: {
  config: CategoryConfig;
  selectedTags: string[];
  onToggle: (v: string) => void;
  onNavigate: () => void;
  location: LocationState;
}) {
  const accent = ACCENT[config.key];

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 shadow-[0_2px_24px_rgba(0,0,0,0.07)] backdrop-blur-md">
      <div className="p-4 sm:p-5">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {config.label} — hva passer deg?
        </p>
        <div className="flex flex-wrap gap-2">
          {config.tags.map((tag) => {
            const active = selectedTags.includes(tag.value);
            return (
              <button
                key={tag.value}
                type="button"
                onClick={() => onToggle(tag.value)}
                className={[
                  'rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-150',
                  active
                    ? accent.activeChip
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                ].join(' ')}
              >
                {tag.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">
            {selectedTags.length === 0 ? 'Viser alt innen kategorien' : `${selectedTags.length} filter valgt`}
          </p>
          <button
            type="button"
            onClick={onNavigate}
            className="w-full rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 active:scale-95 sm:w-auto"
          >
            Se resultater nær {firstPart(location.label)} →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function CategoryGrid() {
  const router = useRouter();
  const [location, setLocation] = useState<LocationState | null>(null);
  const [selectedCat, setSelectedCat] = useState<MainCategory | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const doNavigate = useCallback((cat: MainCategory, tags: string[]) => {
    if (!location) return;
    const p = new URLSearchParams();
    p.set('cat', cat);
    if (tags.length > 0) p.set('tags', tags.join(','));
    p.set('location', location.label);
    p.set('lat', String(location.lat));
    p.set('lon', String(location.lon));
    p.set('radius', String(location.radius));
    if (location.bydel) p.set('bydel', location.bydel);
    router.push(`/resultater?${p.toString()}`);
  }, [location, router]);

  const handleCardClick = useCallback((key: MainCategory) => {
    if (!location) return;
    if (selectedCat === key) {
      doNavigate(key, selectedTags);
    } else {
      setSelectedCat(key);
      setSelectedTags([]);
    }
  }, [location, selectedCat, selectedTags, doNavigate]);

  const toggleTag = useCallback((value: string) => {
    setSelectedTags((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  }, []);

  const updateRadius = useCallback((r: RadiusKm) => {
    setLocation((prev) => {
      if (!prev) return prev;
      const next = { ...prev, radius: r };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const activeCatConfig = selectedCat
    ? CATEGORIES.find((c) => c.key === selectedCat) ?? null
    : null;

  return (
    <section>

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          {/* Brand label */}
          <div className="shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Personlig treningsnavigator
            </p>
          </div>

          {/* Divider */}
          <div className="h-5 w-px shrink-0 bg-slate-200" />

          {/* Location bar */}
          <LocationBar location={location} setLocation={setLocation} />
        </div>
      </div>

      {/* ── Radius chips — shown when location is set ────────────────── */}
      {location && (
        <div className="border-b border-black/[0.04] bg-white/60 backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Søkeradius
            </span>
            <div className="flex gap-1.5">
              {RADIUS_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => updateRadius(r)}
                  className={[
                    'rounded-lg border px-3 py-1 text-xs font-medium transition-all',
                    location.radius === r
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                  ].join(' ')}
                >
                  {r} km
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Page content ─────────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-4 py-8">

        {/* Heading */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Finn lokale treningsmuligheter
          </h1>
          <p className="mt-2 max-w-xl text-base font-light text-slate-500">
            {location
              ? `Viser tilbud nær ${firstPart(location.label)}`
              : 'Sett lokasjon i toppen for å låse opp kategoriene'}
          </p>
        </div>

        {/* ── 2×2 category grid ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 sm:gap-5">
          {CATEGORIES.map((cat) => (
            <CategoryCard
              key={cat.key}
              config={cat}
              selected={selectedCat === cat.key}
              disabled={!location}
              onClick={() => handleCardClick(cat.key)}
              className="h-56 sm:h-64 lg:h-72"
            />
          ))}
        </div>

        {/* ── Tag panel ────────────────────────────────────────────────── */}
        {activeCatConfig && location && (
          <TagPanel
            config={activeCatConfig}
            selectedTags={selectedTags}
            onToggle={toggleTag}
            onNavigate={() => doNavigate(selectedCat!, selectedTags)}
            location={location}
          />
        )}

        <p className="mx-auto mt-8 max-w-xl text-center text-sm font-light leading-relaxed text-slate-400">
          Velg lokasjon, velg kategori og filtrer. Ingen generiske treff.
        </p>
      </div>
    </section>
  );
}
