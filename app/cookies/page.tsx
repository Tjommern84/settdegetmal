import type { Metadata } from 'next';
import Link from 'next/link';
import { container } from '../../lib/ui';

export const metadata: Metadata = {
  title: 'Cookies - settdegetmal.no',
  description: 'Informasjon om bruk av cookies på settdegetmal.no.',
};

export default function CookiesPage() {
  return (
    <main className={`${container} py-16`}>
      <h1 className="text-3xl font-semibold text-slate-900">Cookies</h1>
      <p className="mt-4 text-sm text-slate-600">
        Vi bruker kun nødvendige cookies for innlogging og sikker drift av tjenesten.
        Dette er en enkel oversikt for MVP.
      </p>

      <section className="mt-8 space-y-3 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Nødvendige cookies</h2>
        <p>
          Når du logger inn lagres en sikker sesjon for å holde deg innlogget og beskytte
          kontoen din. Disse cookiene er nødvendige for at tjenesten skal fungere.
        </p>
      </section>

      <section className="mt-6 space-y-3 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Ingen tredjeparts sporing</h2>
        <p>Vi bruker ikke tredjeparts tracking eller annonseringscookies i MVP.</p>
      </section>

      <Link href="/" className="mt-8 inline-flex text-sm font-semibold text-slate-700 underline">
        Tilbake til forsiden
      </Link>
    </main>
  );
}
