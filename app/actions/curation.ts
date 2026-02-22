'use server';

import { createClient } from '@supabase/supabase-js';
import { isAdminByEmail } from '../../lib/adminHelper';

const SERVICE_SELECT =
  'id, name, type, description, price_level, rating_avg, rating_count, cover_image_url, logo_image_url, is_active, is_featured, featured_rank';

const getServiceSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

export type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
};

export type FeaturedService = {
  id: string;
  name: string;
  type: string;
  description: string;
  cover_image_url: string | null;
  logo_image_url: string | null;
  rating_avg: number;
  rating_count: number;
};

export async function getCategories(): Promise<CategoryRow[]> {
  const client = getServiceSupabase();
  if (!client) return [];
  const { data } = await client.from('categories').select('id, name, description').order('name');
  return (data ?? []) as CategoryRow[];
}

export async function getCategoryById(id: string): Promise<CategoryRow | null> {
  const client = getServiceSupabase();
  if (!client) return null;
  const { data } = await client.from('categories').select('id, name, description').eq('id', id).maybeSingle();
  if (!data) return null;
  return data as CategoryRow;
}

export async function getFeaturedServices(): Promise<FeaturedService[]> {
  const client = getServiceSupabase();
  if (!client) return [];
  const { data } = await client
    .from('services')
    .select(SERVICE_SELECT)
    .eq('is_active', true)
    .eq('is_featured', true)
    .order('featured_rank', { ascending: true })
    .limit(6);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    type: row.type as string,
    description: (row.description as string) ?? '',
    cover_image_url: row.cover_image_url ? (row.cover_image_url as string) : null,
    logo_image_url: row.logo_image_url ? (row.logo_image_url as string) : null,
    rating_avg: typeof row.rating_avg === 'number' ? row.rating_avg : 0,
    rating_count: typeof row.rating_count === 'number' ? row.rating_count : 0,
  }));
}

export type CategoryServiceRow = FeaturedService & {
  category_id: string;
};

export async function getServicesByCategory(params: {
  categoryId: string;
  q?: string;
}): Promise<FeaturedService[]> {
  const client = getServiceSupabase();
  if (!client) return [];
  const { data: categoryRows } = await client
    .from('service_categories')
    .select('service_id')
    .eq('category_id', params.categoryId);
  const serviceIds = (categoryRows ?? []).map((row) => row.service_id as string);
  if (serviceIds.length === 0) return [];
  let query = client
    .from('services')
    .select(SERVICE_SELECT)
    .in('id', serviceIds)
    .eq('is_active', true)
    .order('featured_rank', { ascending: true })
    .limit(20);
  if (params.q) {
    query = query.ilike('name', `%${params.q}%`);
  }
  const { data } = await query;
  const services = (data ?? []).map((row) => row);
  return services.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    type: row.type as string,
    description: (row.description as string) ?? '',
    cover_image_url: row.cover_image_url ? (row.cover_image_url as string) : null,
    logo_image_url: row.logo_image_url ? (row.logo_image_url as string) : null,
    rating_avg: typeof row.rating_avg === 'number' ? row.rating_avg : 0,
    rating_count: typeof row.rating_count === 'number' ? row.rating_count : 0,
  }));
}

export async function adminUpdateServiceCuration(
  accessToken: string,
  params: {
    serviceId: string;
    isFeatured: boolean;
    featuredRank: number;
    categories: string[];
  }
): Promise<{ ok: boolean; message: string }> {
  const adminOk = await isAdminByEmail(accessToken);
  if (!adminOk) {
    return { ok: false, message: 'Ikke autorisert.' };
  }
  if (params.categories.length > 3) {
    return { ok: false, message: 'Maks 3 kategorier.' };
  }
  const client = getServiceSupabase();
  if (!client) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
  }
  const { error } = await client
    .from('services')
    .update({ is_featured: params.isFeatured, featured_rank: params.featuredRank })
    .eq('id', params.serviceId);
  if (error) {
    return { ok: false, message: 'Kunne ikke oppdatere tjenesten.' };
  }
  await client
    .from('service_categories')
    .delete()
    .eq('service_id', params.serviceId);
  if (params.categories.length > 0) {
    const rows = params.categories.map((category) => ({
      service_id: params.serviceId,
      category_id: category,
    }));
    const { error: insertError } = await client.from('service_categories').insert(rows);
    if (insertError) {
      return { ok: false, message: 'Kunne ikke lagre kategorier.' };
    }
  }
  return { ok: true, message: 'Kurering lagret.' };
}

export async function adminUpsertCategory(
  accessToken: string,
  payload: { id?: string; name: string; description?: string }
): Promise<{ ok: boolean; message: string }> {
  const adminOk = await isAdminByEmail(accessToken);
  if (!adminOk) {
    return { ok: false, message: 'Ikke autorisert.' };
  }
  const client = getServiceSupabase();
  if (!client) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
  }
  const id = payload.id?.trim() || payload.name.toLowerCase().replace(/\s+/g, '-');
  const { error } = await client.from('categories').upsert({
    id,
    name: payload.name,
    description: payload.description ?? null,
  });
  if (error) {
    return { ok: false, message: 'Kunne ikke lagre kategorien.' };
  }
  return { ok: true, message: 'Kategori lagret.' };
}
