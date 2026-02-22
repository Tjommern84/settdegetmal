/**
 * Geocoding using Nominatim (OpenStreetMap)
 * Free alternative to Google Geocoding API
 */

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
};

export type GeocodeResult = {
  lat: number;
  lon: number;
  formatted: string;
} | null;

export class NominatimGeocoder {
  private baseUrl = 'https://nominatim.openstreetmap.org/search';
  private userAgent = 'settdegetmal/1.0 (settdegetmal.no)';
  private requestsPerSecond = 1; // Nominatim rate limit
  private lastRequestTime = 0;

  /**
   * Geocode an address to lat/lon coordinates
   */
  async geocode(address: string): Promise<GeocodeResult> {
    if (!address || address.trim().length === 0) {
      return null;
    }

    // Rate limiting: wait if needed
    await this.waitForRateLimit();

    const params = new URLSearchParams({
      q: address,
      format: 'json',
      limit: '1',
      countrycodes: 'no', // Only Norway
      addressdetails: '1',
    });

    try {
      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        headers: {
          'User-Agent': this.userAgent,
        },
      });

      if (!response.ok) {
        console.warn(`Geocoding failed for "${address}": ${response.statusText}`);
        return null;
      }

      const results = (await response.json()) as NominatimResult[];

      if (results.length === 0) {
        return null;
      }

      const result = results[0];
      return {
        lat: parseFloat(result.lat),
        lon: parseFloat(result.lon),
        formatted: result.display_name,
      };
    } catch (error) {
      console.error(`Geocoding error for "${address}":`, error);
      return null;
    }
  }

  /**
   * Build a formatted address string from Brreg address parts
   */
  buildAddressString(adresse?: {
    adresse?: string[];
    postnummer?: string;
    poststed?: string;
    kommune?: string;
  }): string | null {
    if (!adresse) return null;

    const parts: string[] = [];

    if (adresse.adresse && adresse.adresse.length > 0) {
      parts.push(adresse.adresse.join(' '));
    }

    if (adresse.postnummer && adresse.poststed) {
      parts.push(`${adresse.postnummer} ${adresse.poststed}`);
    } else if (adresse.poststed) {
      parts.push(adresse.poststed);
    }

    if (parts.length === 0 && adresse.kommune) {
      parts.push(adresse.kommune);
    }

    return parts.length > 0 ? parts.join(', ') : null;
  }

  /**
   * Wait to respect rate limit (1 request per second)
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minDelay = 1000 / this.requestsPerSecond;

    if (timeSinceLastRequest < minDelay) {
      const waitTime = minDelay - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Batch geocode multiple addresses with rate limiting
   */
  async batchGeocode(
    addresses: Array<{ id: string; address: string }>,
    onProgress?: (completed: number, total: number) => void
  ): Promise<Map<string, GeocodeResult>> {
    const results = new Map<string, GeocodeResult>();
    let completed = 0;

    for (const item of addresses) {
      const result = await this.geocode(item.address);
      results.set(item.id, result);

      completed++;
      if (onProgress) {
        onProgress(completed, addresses.length);
      }
    }

    return results;
  }
}
