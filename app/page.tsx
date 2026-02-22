import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import LocalHighlights from '../components/LocalHighlights';
import { ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Chip } from '../components/ui/Chip';
import { container } from '../lib/ui';
import { getCategories, getFeaturedServices } from './actions/curation';
import imgHome from '../bilder/InHome-Workout.webp';
import imgStudio from '../bilder/LBC+munich+pop-up+image+2+final+LR.webp';
import imgPt from '../bilder/personal-training-clients-1.webp';
import imgGroup from '../bilder/Photo-Shoot-Normal-Heights_068-copy.jpg';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const ogImageUrl = `${appUrl}/og-default.svg`;

export const metadata: Metadata = {
  title: 'settdegetmal.no - finn trening som passer deg',
  description:
    'Vi matcher deg med personlige trenere, treningssentre og instruktører basert på mål, nivå, budsjett og hvor du bor.',
  openGraph: {
    title: 'settdegetmal.no - finn trening som passer deg',
    description:
      'Vi matcher deg med personlige trenere, treningssentre og instruktører basert på mål, nivå, budsjett og hvor du bor.',
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

const problems = [
  {
    icon: '🧭',
    text: 'For mange tilbud – vanskelig å sammenligne',
  },
  {
    icon: '🎯',
    text: 'Usikker på hva som passer ditt nivå og mål',
  },
  {
    icon: '⏱️',
    text: 'Tidkrevende å finne noe i nærheten',
  },
];

const steps = [
  {
    title: 'Sett et mål',
    text: 'Ned i vekt, sterkere, komme i gang, mobilitet',
  },
  {
    title: 'Fortell litt om deg',
    text: 'By, budsjett, hjemme eller senter',
  },
  {
    title: 'Få treff som passer',
    text: 'Rangerte og forklarte forslag',
  },
  {
    title: 'Ta kontakt direkte',
    text: 'Enkelt og uforpliktende',
  },
];

const trainingTypes = [
  { title: 'Personlig trener', icon: '💪' },
  { title: 'Treningssenter', icon: '🏋️' },
  { title: 'Yoga & bevegelighet', icon: '🧘' },
  { title: 'Hjemmetrening', icon: '🏠' },
  { title: 'Kurs & grupper', icon: '👥' },
  { title: 'Senior / rehabilitering', icon: '🤝' },
  { title: 'Nybegynner-vennlig', icon: '🌱' },
];

const values = [
  {
    title: 'Personlig matching',
    text: 'Ikke bare søk – vi prioriterer det som passer deg',
  },
  {
    title: 'Lokale tilbydere',
    text: 'Trening der du faktisk bor',
  },
  {
    title: 'Verifiserte vurderinger',
    text: 'Kun ekte brukere kan gi tilbakemelding',
  },
  {
    title: 'Gratis å bruke',
    text: 'Ingen skjulte kostnader for deg som bruker',
  },
];

const heroImages = [
  {
    src: imgPt,
    alt: 'Personlig trener og kunde under økt',
  },
  {
    src: imgStudio,
    alt: 'Trening i studio med instruktør',
  },
  {
    src: imgHome,
    alt: 'Hjemmetrening i stue',
  },
  {
    src: imgGroup,
    alt: 'Gruppetrening i bevegelse',
  },
];

export default async function HomePage() {
  const [featuredServices, categories] = await Promise.all([getFeaturedServices(), getCategories()]);
  return (
    <div className="bg-slate-50 text-slate-900">
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#f8fafc,_#e2e8f0_60%,_#ffffff)]" />
        <div
          className={`${container} relative grid gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center`}
        >
          <div>
            <Chip variant="accent" className="gap-2 uppercase tracking-wide">
              Aktiv matching
              <span className="h-1 w-1 rounded-full bg-emerald-500" />
              Trygg start
            </Chip>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Finn trening som faktisk passer deg
            </h1>
            <p className="mt-5 max-w-xl text-base text-slate-600 sm:text-lg">
              Vi matcher deg med personlige trenere, treningssentre og instruktører – basert på mål,
              nivå, budsjett og hvor du bor.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <ButtonLink href="/flyt">Finn trening som passer deg</ButtonLink>
              <span className="text-sm text-slate-500">
                Gratis • Uforpliktende • Tar under 1 minutt
              </span>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {heroImages.map((image) => (
              <div
                key={image.alt}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="relative aspect-[4/3]">
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover transition duration-700 group-hover:scale-105"
                    priority={image.alt === heroImages[0].alt}
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {featuredServices.length > 0 && (
        <section className={`${container} pb-16`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Populært akkurat nå</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">Utvalgte tjenester</h2>
            </div>
            <ButtonLink href="/resultater" variant="secondary">
              Se alle treff
            </ButtonLink>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredServices.map((service) => (
              <Card key={service.id} className="flex flex-col gap-4 bg-white">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{service.name}</h3>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{service.type}</p>
                </div>
                <p className="text-sm text-slate-600 line-clamp-3">{service.description}</p>
                <ButtonLink href={`/tilbyder/${service.id}`}>Se tilbud</ButtonLink>
                <span className="text-xs text-slate-500">
                  Rating: {service.rating_avg.toFixed(1)} ({service.rating_count})
                </span>
              </Card>
            ))}
          </div>
        </section>
      )}

      {categories.length > 0 && (
        <section className={`${container} pb-16`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Kategorier</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">
                Få hjelp til å finne riktig retning
              </h2>
            </div>
            <ButtonLink href="/resultater" variant="secondary">
              Vis alle kategorier
            </ButtonLink>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/kategorier/${category.id}`}
                className="block rounded-2xl border border-slate-200 bg-white p-6 text-left transition hover:border-slate-400"
              >
                <p className="text-xs uppercase tracking-wide text-slate-500">{category.id}</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">{category.name}</h3>
                {category.description && (
                  <p className="mt-3 text-sm text-slate-600 line-clamp-3">{category.description}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className={`${container} py-16`}>
        <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <h2 className="text-3xl font-semibold text-slate-900">
              Det er vanskelig å velge riktig trening
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              Vi har gjort valget enklere og tryggere, uten at du må lete i en katalog.
            </p>
          </div>
          <div className="grid gap-3">
            {problems.map((problem) => (
              <Card key={problem.text} className="flex items-center gap-3 bg-white">
                <span className="text-lg">{problem.icon}</span>
                <p className="text-sm text-slate-700">{problem.text}</p>
              </Card>
            ))}
            <p className="text-sm font-semibold text-slate-700">
              Derfor har vi laget en smartere måte å velge på.
            </p>
          </div>
        </div>
        <div className="mt-10">
          <LocalHighlights cityKey="oslo" />
        </div>
      </section>

      <section className={`${container} pb-16`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Slik fungerer det
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900 sm:text-3xl">
              Guidet matching – i fire enkle steg
            </h2>
          </div>
          <span className="text-sm text-slate-500">Du bestemmer tempo og nivå</span>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <Card key={step.title}>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {String(index + 1).padStart(2, '0')}
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{step.text}</p>
            </Card>
          ))}
        </div>
        <div className="mt-8">
          <ButtonLink href="/flyt" variant="secondary">
            Finn trening nå
          </ButtonLink>
        </div>
      </section>

      <section className={`${container} pb-16`}>
        <Card className="rounded-3xl p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Hva slags trening finner du her?
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-900 sm:text-3xl">
                Bredt, trygt og tilpasset
              </h2>
            </div>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trainingTypes.map((item) => (
              <Card
                key={item.title}
                className="flex items-center gap-3 bg-white text-sm font-semibold text-slate-900"
              >
                <span className="text-lg">{item.icon}</span>
                {item.title}
              </Card>
            ))}
          </div>
          <p className="mt-6 text-sm text-slate-600">
            Alt på ett sted – tilpasset dine behov.
          </p>
        </Card>
      </section>

      <section className={`${container} pb-16`}>
        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Hvorfor bruke settdegetmal.no?
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900 sm:text-3xl">
              Tryggere valg og bedre oppfølging
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              Vi hjelper deg å komme i gang med noe som passer, ikke bare det som er tilgjengelig.
            </p>
          </div>
          <div className="grid gap-4">
            {values.map((value) => (
              <Card key={value.title} className="bg-white">
                <h3 className="text-base font-semibold text-slate-900">{value.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{value.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className={`${container} pb-16`}>
        <div className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Tilbyr du trening?</h2>
            <p className="mt-3 text-sm text-slate-600">
              Nå ut til kunder som faktisk leter etter det du tilbyr – basert på mål, lokasjon og
              preferanser.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <ButtonLink href="/flyt" variant="secondary">
              Bli tilbyder
            </ButtonLink>
            <Link href="/dashboard" className="text-sm font-semibold text-slate-700">
              Til dashboard
            </Link>
          </div>
        </div>
      </section>

      <section className={`${container} pb-20`}>
        <div className="flex flex-col items-start gap-6 rounded-3xl bg-slate-900 px-8 py-10 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold sm:text-3xl">Klar for å komme i gang?</h2>
            <p className="mt-2 text-sm text-slate-200">
              Start gratis og få forslag som matcher deg riktig.
            </p>
          </div>
          <ButtonLink href="/flyt" variant="secondary" className="bg-white text-slate-900">
            Start gratis
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
