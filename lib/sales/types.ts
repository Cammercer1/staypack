export type SaleCompStatus = "sold" | "for_sale";

export type SaleComp = {
  address: string;
  suburb?: string;
  /** Sold price or for-sale price guide (AUD). */
  price: number;
  saleStatus: SaleCompStatus;
  /** ISO-ish sold date string when available (sold comps only). */
  soldDate?: string;
  /** Raw display price from REA (e.g. "$1,850,000", "Auction guide $950k"). */
  priceDisplay?: string;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
  imageUrl?: string;
  listingUrl?: string;
};

export type SalesAppraisalSource = "rea_discover" | "apify_rea";

export type SalesAppraisalMeta = {
  priceMin?: number;
  priceMax?: number;
  priceMidpoint?: number;
  source?: SalesAppraisalSource;
  compCount?: number;
  soldCompCount?: number;
  forSaleCompCount?: number;
  searchUrl?: string;
  premiumTier?: boolean;
  premiumReasons?: string[];
};
