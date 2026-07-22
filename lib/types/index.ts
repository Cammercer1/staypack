import type { ComparableDiscoverySummary } from "@/lib/comparables/discoveryPolicy";

export type AgencyRole = "owner" | "admin" | "member";

export type ReportStatus =
  | "draft"
  | "scraped"
  | "estimated"
  | "generated"
  | "published"
  | "failed"
  | "archived";

export type ScrapeJobStatus = "pending" | "success" | "failed";

export type LeaseAppraisalJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type LeaseAppraisalJob = {
  id: string;
  agency_id: string;
  listing_id: string;
  created_by: string | null;
  status: LeaseAppraisalJobStatus;
  attempts: number;
  request_json: Record<string, unknown>;
  result_json: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  heartbeat_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SalesAppraisalJobStatus = LeaseAppraisalJobStatus;

export type SalesAppraisalJob = {
  id: string;
  agency_id: string;
  listing_id: string;
  created_by: string | null;
  status: SalesAppraisalJobStatus;
  attempts: number;
  request_json: Record<string, unknown>;
  result_json: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  heartbeat_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ListingImageRole = "photo" | "floor_plan";

export type LeaseAppraisalEnrichmentStatus = {
  status: "processing" | "completed" | "failed";
  requestId: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  updatedAt: string;
  error?: string;
};

export type ListingImageMeta = {
  role: ListingImageRole;
  label?: string;
};

export type ListingImageMetaMap = Record<string, ListingImageMeta>;

export type ParsedListing = {
  title?: string;
  address?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  propertyType?: string;
  purpose?: "sale" | "lease";
  bedrooms?: number;
  bathrooms?: number;
  carSpaces?: number;
  description?: string;
  displayPrice?: string;
  /** Sold date supplied by the listing source when importing a sold property. */
  soldDate?: string;
  images: string[];
  agents: {
    name?: string;
    email?: string;
    phone?: string;
    photo_url?: string;
    role_title?: string;
  }[];
  /** Land area parsed from listing copy (e.g. 1,025 m²). */
  landAreaSqm?: number;
  /** Internal/floor/building area supplied by the listing source. */
  floorAreaSqm?: number;
  rentalAppraisal?: {
    weeklyMin?: number;
    weeklyMax?: number;
    weeklyMidpoint?: number;
    /** Up to 6 listing URLs (or synthetic ids) shown on page 2. */
    selectedCompListingIds?: string[];
    source?:
      /** @deprecated Historical persisted reports only. */
      | "rea_discover"
      | "apify_rea";
    /** Eligible evidence pool size; distinct from the six featured report cards. */
    compCount?: number;
    featuredCompCount?: number;
    searchUrl?: string;
    discovery?: ComparableDiscoverySummary;
    premiumTier?: boolean;
    premiumReasons?: string[];
    rentFloorWeekly?: number;
    rentFloorSource?:
      /** @deprecated Historical persisted reports only; no longer produced. */
      | "domain_bed_median"
      | "rea_bed_median"
      | "propradar_house_median";
    /** LLM-adjusted rent band after reviewing comps and listing quality. */
    positioning?: LtrAppraisalPositioning;
  };
  /** Featured rental comps (e.g. from REA rent discover). */
  rentalComps?: {
    address: string;
    suburb?: string;
    weeklyRent: number;
    bedrooms?: number;
    bathrooms?: number;
    carSpaces?: number;
    propertyType?: string;
    imageUrl?: string;
    listingUrl?: string;
  }[];
  /** PropRadar suburb medians / demographics for lease appraisal. */
  ltrSuburbMarket?: LtrSuburbMarketJson;
  /** Async rental comp enrichment status for lease appraisal UI polling. */
  leaseAppraisalEnrichment?: LeaseAppraisalEnrichmentStatus;
  salesAppraisal?: {
    priceMin?: number;
    priceMax?: number;
    priceMidpoint?: number;
    /** Up to 6 listing URLs (or synthetic ids) shown on page 2. */
    selectedCompListingIds?: string[];
    source?:
      /** @deprecated Historical persisted reports only. */
      | "rea_discover"
      | "apify_rea";
    /** Eligible sold + for-sale pool size; distinct from featured report cards. */
    compCount?: number;
    featuredCompCount?: number;
    soldCompCount?: number;
    forSaleCompCount?: number;
    searchUrl?: string;
    discovery?: {
      sold: ComparableDiscoverySummary;
      forSale: ComparableDiscoverySummary;
    };
    premiumTier?: boolean;
    premiumReasons?: string[];
    /** Numeric price guide advertised by the agency on the subject listing. */
    agencyGuide?: {
      displayPrice: string;
      priceMin: number;
      priceMax: number;
      priceMidpoint: number;
    };
    /** Automated comp result retained for evidence when the agency guide is authoritative. */
    compDerivedBand?: {
      priceMin: number;
      priceMax: number;
      priceMidpoint: number;
    };
    /** Explicit acknowledgement gate when agency and comp evidence materially disagree. */
    agencyGuideReview?: {
      required: boolean;
      confirmed: boolean;
      divergencePct: number;
      reasons: string[];
    };
    /** LLM-adjusted price band after reviewing comps and listing quality. */
    positioning?: SaleAppraisalPositioning;
  };
  /** Sale comps (recently sold + for sale) from REA for sales appraisal. */
  salesComps?: {
    address: string;
    suburb?: string;
    price: number;
    saleStatus: "sold" | "for_sale";
    soldDate?: string;
    landAreaSqm?: number;
    floorAreaSqm?: number;
    priceDisplay?: string;
    bedrooms?: number;
    bathrooms?: number;
    carSpaces?: number;
    propertyType?: string;
    imageUrl?: string;
    listingUrl?: string;
  }[];
  /** Async sale comp enrichment status for sales appraisal UI polling. */
  salesAppraisalEnrichment?: LeaseAppraisalEnrichmentStatus;
  outgoings?: {
    bodyCorporateWeekly?: number;
    councilRatesQuarterly?: number;
    waterRatesQuarterly?: number;
  };
  confidence: "low" | "medium" | "high";
  warnings: string[];
};

export type AirbticsTier = "summary" | "full";

export type StrEstimate = {
  annualRevenue: number | null;
  monthlyRevenue: number | null;
  weeklyRevenue: number | null;
  nightlyRate: number | null;
  occupancyRate: number | null;
  bookedNights: number | null;
  radiusM: number | null;
  raw: unknown;
};

export type StrCompCard = {
  listing_id: string;
  name: string;
  thumbnail_url: string;
  listing_url: string;
  bedrooms: number | null;
  bathrooms: number | null;
  accommodates: number | null;
  distance_m: number | null;
  annual_revenue: number | null;
  occupancy_rate: number | null;
  nightly_rate: number | null;
};

/** LLM positioning of the subject within the Airbtics revenue distribution. */
export type StrEstimatePositioning = {
  percentile: number;
  confidence: "low" | "medium" | "high";
  rationale: string;
  /** Airbtics p50 before positioning, for auditability. */
  median_annual_revenue: number | null;
  /** LLM-suggested annual revenue before comp-aware clamping. */
  llm_annual_revenue?: number | null;
  /** Final annual revenue after comp-aware clamping. */
  annual_revenue?: number | null;
  was_clamped?: boolean;
  comp_anchors?: {
    same_bed_count: number;
    same_bed_median: number | null;
    same_bed_max: number | null;
    suggested_floor: number | null;
    suggested_ceiling: number | null;
    suggested_target?: number | null;
  };
};

/** LLM positioning of weekly rent after reviewing REA comps and listing quality. */
export type LtrAppraisalPositioning = {
  confidence: "low" | "medium" | "high";
  rationale: string;
  /** Statistical band midpoint before LLM review. */
  statistical_weekly_midpoint: number | null;
  llm_weekly_min?: number | null;
  llm_weekly_max?: number | null;
  llm_weekly_midpoint?: number | null;
  weekly_min?: number | null;
  weekly_max?: number | null;
  weekly_midpoint?: number | null;
  was_clamped?: boolean;
  comp_anchors?: {
    same_bed_count: number;
    same_bed_min: number | null;
    same_bed_median: number | null;
    same_bed_max: number | null;
    suggested_floor: number | null;
    suggested_ceiling: number | null;
    suggested_target?: number | null;
  };
};

/** LLM positioning of the sale price band after reviewing REA comps and listing quality. */
export type SaleAppraisalPositioning = {
  confidence: "low" | "medium" | "high";
  rationale: string;
  /** Statistical band midpoint before LLM review. */
  statistical_price_midpoint: number | null;
  llm_price_min?: number | null;
  llm_price_max?: number | null;
  llm_price_midpoint?: number | null;
  price_min?: number | null;
  price_max?: number | null;
  price_midpoint?: number | null;
  was_clamped?: boolean;
  comp_anchors?: {
    same_bed_count: number;
    same_bed_min: number | null;
    same_bed_median: number | null;
    same_bed_max: number | null;
    suggested_floor: number | null;
    suggested_ceiling: number | null;
    suggested_target?: number | null;
  };
};

export type StrEnrichmentJson = {
  tier: "full";
  comp_count: number;
  radius_m: number | null;
  revenue_range: {
    p25: number | null;
    p50: number | null;
    p75: number | null;
    p90: number | null;
  } | null;
  positioning?: StrEstimatePositioning | null;
  seasonality: {
    month: string;
    revenue_low: number | null;
    revenue: number | null;
    revenue_high: number | null;
    occupancy: number | null;
    adr: number | null;
  }[];
  comps: StrCompCard[];
};

export type StrEstimateOverrides = Partial<StrEstimate> & {
  recommendedAnnualRevenue?: number | null;
  recommendedOccupancyRate?: number | null;
  revenueBand?: {
    min: number;
    max: number;
    source: "airbtics" | "fallback";
  } | null;
};

/** Long-term rental comps from REA discover (lease appraisal for investors). */
export type LtrRentalCompCard = {
  listing_id: string;
  name: string;
  thumbnail_url: string;
  listing_url: string;
  bedrooms: number | null;
  bathrooms: number | null;
  car_spaces?: number | null;
  property_type?: string | null;
  weekly_rent: number | null;
  suburb: string | null;
};

export type LtrSuburbMarketJson = {
  suburb: string;
  state: string;
  postcode: number | null;
  property_segment: "house" | "unit";
  vacancy_rate_pct: number | null;
  population: number | null;
  renter_pct: number | null;
  gross_yield_pct: number | null;
  median_weekly_rent: number | null;
  as_of: string | null;
  source: "propradar";
};

export type LtrEnrichmentJson = {
  comp_count: number;
  weekly_range: {
    p25: number | null;
    p50: number | null;
    p75: number | null;
  };
  comps: LtrRentalCompCard[];
  source?: string;
  search_url?: string;
  suburb_market?: LtrSuburbMarketJson | null;
  positioning?: LtrAppraisalPositioning | null;
};

/** Sale comps (recently sold + for sale) from REA (sales appraisal). */
export type SaleCompCard = {
  listing_id: string;
  name: string;
  thumbnail_url: string;
  listing_url: string;
  bedrooms: number | null;
  bathrooms: number | null;
  car_spaces?: number | null;
  property_type?: string | null;
  price: number | null;
  price_display: string | null;
  sale_status: "sold" | "for_sale";
  sold_date: string | null;
  land_area_sqm?: number | null;
  floor_area_sqm?: number | null;
  suburb: string | null;
};

export type SalesEnrichmentJson = {
  comp_count: number;
  sold_comp_count: number;
  for_sale_comp_count: number;
  price_range: {
    p25: number | null;
    p50: number | null;
    p75: number | null;
  };
  comps: SaleCompCard[];
  source?: string;
  search_url?: string;
  positioning?: SaleAppraisalPositioning | null;
};

export type AiCopyJson = {
  sales_pack_heading: string;
  sales_pack_blurb: string;
  /** Short / medium / long page-one blurbs from AI (paragraphs joined with blank lines). */
  sales_pack_blurb_variants?: {
    short: string;
    medium: string;
    long: string;
  };
  key_metrics_line: string;
  property_appeal_points: string[];
  performance_supporting_factors: string[];
  buyer_checks: string[];
  methodology_note: string;
  disclaimer: string;
  confidence_notes: string;
};

export type { AgencyBrandAdvanced } from "@/lib/branding/advanced";

export type FinalReportJson = {
  version: string;
  template_id: string;
  generated_at: string;
  agency: {
    name: string;
    logo_url: string;
    logo_light_url?: string;
    logo_dark_url?: string;
    primary_colour: string;
    secondary_colour: string;
    accent_colour: string;
    text_colour: string;
    callout_heading_colour?: string;
    callout_text_colour?: string;
    background_colour: string;
    heading_font_family: string;
    body_font_family: string;
    font_family: string;
    heading_font_file_url: string;
    body_font_file_url: string;
    font_file_url: string;
    website_url: string;
    phone: string;
    email: string;
    brand_advanced?: import("@/lib/branding/advanced").AgencyBrandAdvanced | null;
  };
  agent: {
    name: string;
    role_title: string;
    phone: string;
    email: string;
    photo_url: string;
  };
  agents: {
    name: string;
    role_title: string;
    phone: string;
    email: string;
    photo_url: string;
  }[];
  property: {
    address: string;
    suburb: string;
    state: string;
    postcode: string;
    summary: string;
    property_type: string;
    bedrooms: number;
    bathrooms: number;
    car_spaces: number;
    accommodates: number;
    listing_url: string;
    hero_image_url: string;
    selected_image_urls: string[];
    display_price?: string | null;
    land_area_sqm?: number | null;
    floor_area_sqm?: number | null;
  };
  str: {
    annual_revenue: number | null;
    monthly_revenue: number | null;
    weekly_revenue: number | null;
    nightly_rate: number | null;
    occupancy_rate: number | null;
    booked_nights: number | null;
    radius_m: number | null;
  };
  str_yield?: {
    display_price: string;
    price_min: number;
    price_max: number;
    price_midpoint: number;
    yield_min_percent: number;
    yield_max_percent: number;
    yield_midpoint_percent: number;
  } | null;
  ltr: {
    weekly_min: number | null;
    weekly_max: number | null;
    weekly_midpoint: number | null;
    annual_midpoint: number | null;
    difference_before_costs: number | null;
  };
  /** Estimated sale price band (sales appraisal reports). */
  sale_estimate?: {
    price_min: number | null;
    price_max: number | null;
    price_midpoint: number | null;
  } | null;
  copy: {
    heading: string;
    blurb: string;
    blurb_variants?: {
      short: string;
      medium: string;
      long: string;
    };
    /** template_id → short | medium | long */
    template_blurb_length?: Partial<
      Record<string, import("@/lib/copy/blurbVariantConstants").BlurbLength>
    >;
    key_metrics_line: string;
    appeal_points: string[];
    supporting_factors: string[];
    buyer_checks: string[];
    methodology_note: string;
    disclaimer: string;
    comparable_evidence: string;
    comparable_disclaimer: string;
    cta: string;
  };
  assets: {
    qr_code_url: string;
    pdf_url: string;
  };
  str_enrichment?: StrEnrichmentJson | null;
  ltr_enrichment?: LtrEnrichmentJson | null;
  sales_enrichment?: SalesEnrichmentJson | null;
};

export type Agency = {
  id: string;
  agency_group_id?: string | null;
  name: string;
  slug: string;
  slug_aliases: string[];
  website_url: string | null;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  primary_colour: string;
  secondary_colour: string;
  accent_colour: string;
  text_colour: string;
  callout_heading_colour: string | null;
  callout_text_colour: string | null;
  background_colour: string;
  heading_font_family: string;
  body_font_family: string;
  font_family: string;
  heading_font_file_url: string | null;
  body_font_file_url: string | null;
  font_file_url: string | null;
  default_report_title: string;
  default_cta: string;
  default_disclaimer: string | null;
  report_template_id: string;
  collateral_template_defaults: Record<string, string>;
  brand_advanced_json?: import("@/lib/branding/advanced").AgencyBrandAdvanced | null;
  created_at: string;
  updated_at: string;
};

export type AgentProfile = {
  id: string;
  agency_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role_title: string | null;
  photo_url: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type ListingStatus = "active" | "archived";

export type ListingPurpose = "sale" | "lease";

export type Listing = {
  id: string;
  agency_id: string;
  created_by: string | null;
  agent_profile_id: string | null;
  status: ListingStatus;
  listing_purpose: ListingPurpose;
  listing_url: string | null;
  property_address: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  car_spaces: number | null;
  accommodates: number | null;
  listing_title: string | null;
  listing_description: string | null;
  display_price: string | null;
  /** Security bond for lease listings (e.g. "$6,800"). */
  bond: string | null;
  hero_image_url: string | null;
  selected_image_urls: string[] | null;
  uploaded_image_urls: string[] | null;
  collateral_image_selections: Record<string, { hero_image_url: string | null; selected_image_urls: string[] }>;
  listing_image_meta: ListingImageMetaMap;
  scraped_listing_json: ParsedListing | null;
  public_slug: string | null;
  public_url: string | null;
  custom_landing_url: string | null;
  landing_qr_code_url: string | null;
  landing_published_at: string | null;
  landing_template: string | null;
  created_at: string;
  updated_at: string;
};

export type ListingStats = {
  total_views: number;
  views_last_30d: number;
  total_leads: number;
};

export type LeadStatus = "new" | "contacted";

export type Lead = {
  id: string;
  listing_id: string;
  agency_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  source: string;
  created_at: string;
  updated_at: string;
};

export type LeadListingContext = {
  id: string;
  listing_title: string | null;
  property_address: string | null;
  public_slug: string | null;
  status: ListingStatus;
};

export type LeadWithListing = Lead & {
  listings: LeadListingContext | null;
};

export type CollateralType =
  | "str_report"
  | "sales_brochure"
  | "rental_brochure"
  | "lease_appraisal"
  | "sales_appraisal"
  | "social_posts"
  | "investor_snapshot"
  | "agent_business_card";

export type CollateralItemStatus = "draft" | "generated" | "published" | "archived";

export type CollateralItem = {
  id: string;
  listing_id: string | null;
  agency_id: string;
  type: CollateralType;
  status: CollateralItemStatus;
  report_id: string | null;
  template_id: string | null;
  document_json: CollateralDocumentJson | null;
  public_slug: string | null;
  public_url: string | null;
  pdf_url: string | null;
  qr_code_url: string | null;
  generated_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CollateralDocumentJson = import("@/lib/collateral/templates/types").CollateralDocumentJson;

export type ListingWithReport = Listing & {
  str_report: Report | null;
};

export type ListingLibraryRow = Listing & {
  total_leads: number;
};

export type ReportEditorState = {
  listing: Listing;
  report: Report;
};

export type Report = {
  id: string;
  agency_id: string;
  listing_id: string;
  created_by: string | null;
  status: ReportStatus;
  public_slug: string | null;
  public_url: string | null;
  qr_code_url: string | null;
  pdf_url: string | null;
  raw_airbtics_json: unknown;
  airbtics_tier: AirbticsTier | null;
  airbtics_report_id: string | null;
  str_enrichment_json: StrEnrichmentJson | null;
  airbtics_cost_cents: number | null;
  airbtics_fetched_at: string | null;
  original_estimate_json: StrEstimate | null;
  user_overrides_json: StrEstimateOverrides | null;
  final_estimate_json: StrEstimate | null;
  ai_copy_json: AiCopyJson | null;
  final_report_json: FinalReportJson | null;
  template_id: string | null;
  error_message: string | null;
  generated_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export const DEFAULT_DISCLAIMER =
  "Estimate only. Actual performance may vary based on seasonality, furnishing, photography, pricing strategy, guest reviews, management quality, platform fees, cleaning, utilities, maintenance, insurance, local council requirements, strata or body corporate rules and market conditions. This report is not financial, legal or tax advice. Buyers should make their own enquiries before making an investment decision.";
