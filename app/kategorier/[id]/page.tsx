import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, ButtonLink } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { container } from '../../../lib/ui';
import { getCategoryById, getServicesByCategory } from '../../actions/curation';

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const category = await getCategoryById(params.id);
  if (!category) {
    return {
      title: 'Kategori ikke funnet | settdegetmal.no',
      description: 'Vi finner dessverre ikke denne kategorien.',
    };
  }
  return {
    title: `${category.name} | settdegetmal.no`,
    description: category.description ?? 'Kuraterte tjenester fra settdegetmal.no.',
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { q?: string };
}) {
  const category = await getCategoryById(params.id);
  if (!category) {
    return (
      <main className={`${container} py-16`}>
        <Card>
          <h1 className="text-2xl font-semibold text-slate-900">Kategori ikke funnet</h1>
          <p className="mt-3 text-sm text-slate-600">
            Vi finner dessverre ikke denne kategorien. Gå tilbake til forsiden.
          </p>
          <ButtonLink href="/flyt" className="mt-6">
            Finn trening
          </ButtonLink>
        </Card>
      </main>
    );
  }

  const query = searchParams?.q ?? '';
  const services = await getServicesByCategory({ categoryId: params.id, q: query });

  return (
    <main className={`${container} py-12 space-y-8`}>
      <section>
        <p className="text-xs uppercase tracking-wide text-slate-500">Kategori</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">{category.name}</h1>
        {category.description && (
          <p className="mt-2 text-sm text-slate-600">{category.description}</p>
        )}
      </section>

      <section className="space-y-3">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4" method="get">
          <div className="flex-1">
            <label htmlFor="q" className="text-xs uppercase tracking-wide text-slate-500">
              Søk i kategorien
            </label>
            <Input id="q" name="q" defaultValue={query} placeholder="yoga, rehab, crossfit" />
          </div>
          <Button type="submit" className="min-w-[160px]">
            Filtrer
          </Button>
        </form>
      </section>

      <section className="space-y-4">
        {services.length === 0 ? (
          <Card className="text-sm text-slate-600">
            Vi bygger fortsatt denne kategorien i ditt område. Prøv et nytt søk eller gå tilbake til{' '}
            <Link href="/flyt" className="font-semibold text-slate-900 underline">
              flyten
            </Link>
            .
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {services.map((service) => (
              <Card key={service.id} className="bg-white">
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">{service.type}</p>
                    <h2 className="text-xl font-semibold text-slate-900">{service.name}</h2>
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-3">{service.description}</p>
                  <div className="flex items-center justify-between">
                    <ButtonLink href={`/tilbyder/${service.id}`}>Se tilbud</ButtonLink>
                    <span className="text-xs text-slate-500">
                      Rating: {service.rating_avg.toFixed(1)} ({service.rating_count})
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
