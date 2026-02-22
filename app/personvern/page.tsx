import type { Metadata } from 'next';
import Link from 'next/link';
import { container } from '../../lib/ui';

export const metadata: Metadata = {
  title: 'Personvern - settdegetmal.no',
  description: 'Hvordan settdegetmal.no behandler personopplysninger.',
};

export default function PersonvernPage() {
  return (
    <main className={`${container} py-16`}>
      <h1 className="text-3xl font-semibold text-slate-900">Personvern</h1>
      <p className="mt-4 text-sm text-slate-600">
        Vi tar personvern på alvor. Denne siden forklarer hvilke data vi samler inn,
        hvorfor vi gjør det og hvilke rettigheter du har.
      </p>

      <section className="mt-8 space-y-3 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Hvilke data samles inn</h2>
        <p>
          Når du bruker tjenesten kan vi lagre kontodata (navn og e-post),
          forespørsler (leads), meldinger mellom kunde og tilbyder, vurderinger,
          samt e-postvarsler og samtykker.
        </p>
      </section>

      <section className="mt-6 space-y-3 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Hvorfor vi samler inn data</h2>
        <p>
          Vi bruker dataene for å matche deg med relevante treningstilbud, formidle
          forespørsler, gi tilbydere mulighet til å svare, og forbedre tjenesten over tid.
        </p>
      </section>

      <section className="mt-6 space-y-3 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Lagring og behandlingssted</h2>
        <p>
          Data lagres i Supabase. Vi velger EU-region for lagring og behandling. Kun
          autorisert tilgang brukes for drift og sikkerhet.
        </p>
      </section>

      <section className="mt-6 space-y-3 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Dine rettigheter</h2>
        <p>
          Du har rett til innsyn, retting og sletting av egne data. Du kan også trekke
          samtykke. Kontakt oss for å utøve disse rettighetene.
        </p>
      </section>

      <section className="mt-6 space-y-3 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Kontakt</h2>
        <p>
          Send forespørsel om innsyn eller sletting til{' '}
          <span className="font-semibold">privacy@settdegetmal.no</span>.
        </p>
      </section>

      <Link href="/" className="mt-8 inline-flex text-sm font-semibold text-slate-700 underline">
        Tilbake til forsiden
      </Link>
    </main>
  );
}
