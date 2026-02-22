import { getServiceSupabase } from './serviceSupabase';
import type { Service } from './domain';

const cacheClient = getServiceSupabase();

export async function getServiceCache(serviceId: string): Promise<Service | null> {
  if (!cacheClient || !serviceId) return null;
  try {
    const { data } = await cacheClient
      .from('service_cache')
      .select('payload')
      .eq('service_id', serviceId)
      .maybeSingle();

    if (!data?.payload) return null;

    return data.payload as Service;
  } catch {
    return null;
  }
}

export async function setServiceCache(serviceId: string, payload: Service): Promise<void> {
  if (!cacheClient) return;
  try {
    await cacheClient.from('service_cache').upsert({
      service_id: serviceId,
      payload,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // caching is best-effort
  }
}

export async function deleteServiceCache(serviceId: string): Promise<void> {
  if (!cacheClient) return;
  try {
    await cacheClient.from('service_cache').delete().eq('service_id', serviceId);
  } catch {
    // best-effort
  }
}
