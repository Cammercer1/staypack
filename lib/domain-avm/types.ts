export type DomainAvmConfidence = "low" | "medium" | "high";

export type DomainAvmSaleComparable = {
  slug?: string;
  address: string;
  bedrooms?: number;
  bathrooms?: number;
  carSpaces?: number;
  soldDate?: string;
  soldPrice?: number;
  imageUrl?: string;
};

export type DomainAvm = {
  propertyId?: string;
  urlSlug: string;
  address: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  carSpaces?: number;
  floorAreaSqm?: number;
  landAreaSqm?: number;
  valuation?: {
    lowerPrice: number;
    midPrice: number;
    upperPrice: number;
    confidence: DomainAvmConfidence;
    source?: string;
    date?: string;
  };
  rentalEstimate?: {
    weeklyRent: number;
    confidence: DomainAvmConfidence;
    date?: string;
    yieldPct?: number;
  };
  suburbMarket?: {
    medianSoldPrice?: number;
    medianWeeklyRent?: number;
    daysOnMarket?: number;
  };
  comparableSales: DomainAvmSaleComparable[];
  matchedAt: string;
};
