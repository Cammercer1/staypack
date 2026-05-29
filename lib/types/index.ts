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
  images: string[];
  agents: {
    name?: string;
    email?: string;
    phone?: string;
    photo_url?: string;
    role_title?: string;
  }[];
  rentalAppraisal?: {
    weeklyMin?: number;
    weeklyMax?: number;
    weeklyMidpoint?: number;
  };
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

export type AiCopyJson = {
  sales_pack_heading: string;
  sales_pack_blurb: string;
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
  copy: {
    heading: string;
    blurb: string;
    key_metrics_line: string;
    appeal_points: string[];
    supporting_factors: string[];
    buyer_checks: string[];
    methodology_note: string;
    disclaimer: string;
    cta: string;
  };
  assets: {
    qr_code_url: string;
    pdf_url: string;
  };
  str_enrichment?: StrEnrichmentJson | null;
};

export type Agency = {
  id: string;
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
  hero_image_url: string | null;
  selected_image_urls: string[] | null;
  uploaded_image_urls: string[] | null;
  collateral_image_selections: Record<string, { hero_image_url: string | null; selected_image_urls: string[] }>;
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
  user_overrides_json: Partial<StrEstimate> | null;
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
