export type ServiceType = 'PT' | 'Treningssenter' | 'Yoga' | 'Hjemmetrening';
export type Budget = 'Lav' | 'Middels' | 'Høy' | 'Spiller ingen rolle';
export type HomeOrGym = 'Hjemme' | 'Senter' | 'Spiller ingen rolle';
export type Goal = 'Komme i form' | 'Bygge muskler' | 'Vektnedgang' | 'Bevegelighet' | 'Bedre kondisjon';

export type Answers = {
  goal: Goal;
  serviceType: ServiceType;
  location: string;
  locationLabel?: string;
  locationLat?: number;
  locationLon?: number;
  budget: Budget;
  homeOrGym: HomeOrGym;
};

export type Provider = {
  id: string;
  name: string;
  description: string;
  serviceTypes: ServiceType[];
  locations: string[];
  priceLevel: Budget;
  offersHome: boolean;
  offersGym: boolean;
  tags: Goal[];
};
