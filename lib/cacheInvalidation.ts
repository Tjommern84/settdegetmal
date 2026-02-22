import { clearSearchCache } from './searchCache';
import { deleteServiceCache } from './serviceCache';

export async function invalidateServiceCaches(serviceId?: string): Promise<void> {
  await Promise.all([
    clearSearchCache(),
    serviceId ? deleteServiceCache(serviceId) : Promise.resolve(),
  ]);
}
