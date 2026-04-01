import type { Metadata } from 'next';
export const revalidate = 300;
import ProviderClient from './ProviderClient';
import type { Service } from '../../../lib/domain';
import { services as staticServices } from '../../../lib/providers';
import { supabase } from '../../../lib/supabaseClient';
import { getServiceCache, setServiceCache } from '../../../lib/serviceCache';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const ogImageUrl = `${appUrl}/og-default.svg`;

const typeLabels: Record<Service['type'], string> = {
  styrke: 'Treningssenter',
  pt: 'Personlig trener',
  yoga: 'Yoga & Bevegelighet',
  gruppe: 'Gruppetimer',
  kondisjon: 'Kondisjon',
  outdoor: 'Outdoor',
  sport: 'Idrettslag & Sport',
  mindbody: 'Mind-body',
  spesialisert: 'Klinisk & Rehab',
  livsstil: 'Livsstil & Helse',
  teknologi: 'Digital trening',
};

const SERVICE_SELECT =
  'id, name, type, description, coverage, price_level, rating_avg, rating_count, tags, goals, venues, is_active, cover_image_url, logo_image_url';

const mapServiceRow = (row: Record<string, unknown>): Service => ({
  id: String(row.id ?? ''),
  name: String(row.name ?? ''),
  type: (row.type as Service['type']) ?? 'pt',
  description: String(row.description ?? ''),
  coverage: Array.isArray(row.coverage) ? (row.coverage as Service['coverage']) : [],
  price_level: (row.price_level as Service['price_level']) ?? 'medium',
  rating_avg: typeof row.rating_avg === 'number' ? row.rating_avg : 0,
  rating_count: typeof row.rating_count === 'number' ? row.rating_count : 0,
  tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
  goals: Array.isArray(row.goals) ? (row.goals as Service['goals']) : [],
  venues: Array.isArray(row.venues) ? (row.venues as Service['venues']) : [],
  is_active: row.is_active !== false,
  cover_image_url: row.cover_image_url ? String(row.cover_image_url) : null,
  logo_image_url: row.logo_image_url ? String(row.logo_image_url) : null,
});

const fetchServiceById = async (id: string): Promise<Service | null> => {
  if (!id || !supabase) return null;
  try {
    const { data } = await supabase
      .from('services')
      .select(SERVICE_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (!data) return null;
    return mapServiceRow(data as Record<string, unknown>);
  } catch {
    return null;
  }
};

const resolveService = async (id: string): Promise<Service | null> => {
  const cached = await getServiceCache(id);
  if (cached) return cached;

  const fetched = await fetchServiceById(id);
  if (fetched) {
    await setServiceCache(id, fetched);
    return fetched;
  }

  return staticServices.find((item) => item.id === id) ?? null;
};

const buildDescription = (text: string) => {
  const trimmed = text.trim();
  if (trimmed.length <= 160) return trimmed;
  return `${trimmed.slice(0, 157)}...`;
};

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const service = await resolveService(params.id);

  if (!service) {
    return {
      title: 'Tilbyder ikke funnet – settdegetmal.no',
      description: 'Vi fant ikke tilbyderen du leter etter.',
    };
  }

  const pageTitle = `${service.name} – ${typeLabels[service.type]}`;
  const pageUrl = `${appUrl}/tilbyder/${service.id}`;
  const description = buildDescription(service.description);

  return {
    title: pageTitle,
    description,
    openGraph: {
      title: pageTitle,
      description,
      url: pageUrl,
      type: 'website',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: service.name,
        },
      ],
    },
  };
}

export default async function ProviderPage({ params }: { params: { id: string } }) {
  const service = await resolveService(params.id);
  return <ProviderClient params={params} service={service} />;
}
