export type Recommendation = {
  serviceId: string;
  name: string;
  description: string;
  priceLevel: string;
  ratingAvg: number;
  ratingCount: number;
  matchReason: string;
  distanceKm?: number;
  reason: string;
};
