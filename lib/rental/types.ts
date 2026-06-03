export type RentalComp = {
  address: string;
  suburb?: string;
  weeklyRent: number;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
  imageUrl?: string;
  listingUrl?: string;
};

export type RentalAppraisalSource = "rea_discover";

export type SuburbRentFloorSource =
  | "domain_bed_median"
  | "rea_bed_median"
  | "propradar_house_median";

export type RentalAppraisalMeta = {
  weeklyMin?: number;
  weeklyMax?: number;
  weeklyMidpoint?: number;
  source?: RentalAppraisalSource;
  compCount?: number;
  searchUrl?: string;
  premiumTier?: boolean;
  premiumReasons?: string[];
  rentFloorWeekly?: number;
  rentFloorSource?: SuburbRentFloorSource;
};
