import type { Metadata } from 'next';
import Link from 'next/link';
import { container } from '../../lib/ui';

export const metadata: Metadata = {
  title: 'Vilkår - settdegetmal.no',
  description: 'Vilkår for bruk av settdegetmal.no.',
};

export default function VilkarPage() {
  return (
    <main className={`${container} py-16`}>
      <h1 className="text-3xl font-semibold text-slate-900">Vilkår</h1>
      <p className="mt-4 text-sm text-slate-600">
        Ved å bruke settdegetmal.no godtar du vilkårene nedenfor. Dette er en kort
        MVP-versjon.
      </p>

      <section className="mt-8 space-y-3 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Tjenesten</h2>
        <p>
          settdegetmal.no er en matchingtjeneste mellom kunder og treningstilbydere.
          Vi formidler forespørsler og samler inn grunnleggende informasjon for å gi
          riktige forslag.
        </p>
      </section>

      <section className="mt-6 space-y-3 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Brukeransvar</h2>
        <p>
          Du er ansvarlig for at informasjon du oppgir er korrekt. Du må ikke misbruke
          tjenesten eller forsøke å omgå sikkerhet.
        </p>
      </section>

      <section className="mt-6 space-y-3 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Tilbyderansvar</h2>
        <p>
          Tilbydere er ansvarlige for egen levering, svar og avtalevilkår med kunden.
          settdegetmal.no er ikke part i avtalen mellom kunde og tilbyder.
        </p>
      </section>

      <section className="mt-6 space-y-3 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Endringer</h2>
        <p>
          Vi kan oppdatere vilkårene når tjenesten utvikles. Ved vesentlige endringer
          varsler vi i tjenesten.
        </p>
      </section>

      <section className="mt-6 space-y-3 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Kontakt</h2>
        <p>
          Spørsmål kan sendes til{' '}
          <span className="font-semibold">post@settdegetmal.no</span>.
        </p>
      </section>

      <Link href="/" className="mt-8 inline-flex text-sm font-semibold text-slate-700 underline">
        Tilbake til forsiden
      </Link>
    </main>
  );
}
