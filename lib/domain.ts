export type GeoPoint = {
  lat: number;
  lon: number;
};

export type CoverageRule =
  | {
      type: 'radius';
      center: GeoPoint;
      radius_km: number;
    }
  | {
      type: 'cities';
      cities: string[];
    }
  | {
      type: 'region';
      region: 'norway' | 'nordic';
    };

export type ServiceType =
  | 'styrke'        // Styrketrening
  | 'kondisjon'     // Kondisjon og utholdenhet
  | 'gruppe'        // Gruppetimer
  | 'yoga'          // Yoga og mobilitet
  | 'mindbody'      // Mind–body og lavintensiv trening
  | 'spesialisert'  // Spesialisert og målrettet trening
  | 'livsstil'      // Livsstil og helse
  | 'outdoor'       // Outdoor og naturbasert trening
  | 'sport'         // Sport og prestasjon
  | 'pt'            // Personlig oppfølging og coaching
  | 'teknologi';    // Teknologi og moderne treningsformer
export type PriceLevel = 'low' | 'medium' | 'high';
export type Goal =
  | 'weight_loss'
  | 'strength'
  | 'mobility'
  | 'rehab'
  | 'endurance'
  | 'start';
export type VenuePreference = 'home' | 'gym' | 'either';
export type ServiceTypePref = ServiceType | 'any';
export type BudgetPref = PriceLevel | 'any';

export type Service = {
  id: string;
  name: string;
  type: ServiceType;
  description: string;
  coverage: CoverageRule[];
  price_level: PriceLevel;
  rating_avg: number;
  rating_count: number;
  tags: string[];
  goals: Goal[];
  venues: ('home' | 'gym' | 'online')[];
  is_active?: boolean;
  cover_image_url?: string | null;
  logo_image_url?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  orgnr?: string | null;
};
