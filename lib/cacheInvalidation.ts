import { deleteServiceCache } from './serviceCache';

export async function invalidateServiceCaches(serviceId?: string): Promise<void> {
  await (serviceId ? deleteServiceCache(serviceId) : Promise.resolve());
}
