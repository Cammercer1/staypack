import { formatWeeklyRentRange } from "@/lib/rental/computeRentBand";
import { ltrEnrichmentFromParsed } from "@/lib/lease-appraisal/ltrEnrichmentFromParsed";
import { HAVEN_PROPERTIES_LEASE_APPRAISAL_TEMPLATE_ID } from "@/lib/reports/templates/ids";
import { calculateAccommodates } from "@/lib/reports/formatters";
import {
  primaryReportAgent,
  resolveAgencyAccountReportAgents,
  type ReportAgent,
} from "@/lib/reports/resolveReportAgents";
import { resolveCollateralImageSelection } from "@/lib/listings/collateralImages";
import {
  normalizeReaImageUrl,
  normalizeReaImageUrls,
} from "@/lib/scraping/rea/normalizeReaImageUrl";
import {
  deriveLeaseAppraisalCopy,
  type LeaseAppraisalCopy,
} from "@/lib/lease-appraisal/deriveLeaseAppraisalCopy";
import type { ReportPropertyImageSelection } from "@/lib/reports/editable/reportImageSlots";
import type {
  Agency,
  AgentProfile,
  FinalReportJson,
  Listing,
  ParsedListing,
  Report,
} from "@/lib/types";

export type BuildLeaseAppraisalReportInput = {
  agency: Agency;
  listing: Listing;
  report: Report;
  parsed: ParsedListing;
  agentProfile?: AgentProfile | null;
  agencyAgents?: AgentProfile[];
  templateId?: string;
  /** Investor copy; defaults to listing-derived text (use AI via generateLeaseAppraisalCopy). */
  copy?: LeaseAppraisalCopy;
  /** Preserves hero/gallery picks from the content editor across rebuilds. */
  propertyImages?: ReportPropertyImageSelection;
  resolvedAgents?: ReportAgent[];
};

export function buildLeaseAppraisalReport({
  agency,
  listing,
  report,
  parsed,
  agentProfile,
  agencyAgents,
  templateId = HAVEN_PROPERTIES_LEASE_APPRAISAL_TEMPLATE_ID,
  copy: copyOverride,
  propertyImages,
  resolvedAgents,
}: BuildLeaseAppraisalReportInput): FinalReportJson {
  const agents =
    resolvedAgents ??
    resolveAgencyAccountReportAgents({
      agentProfile,
      agencyAgents,
    });
  const images = resolveCollateralImageSelection(listing, "str_report");
  const parsedImages = normalizeReaImageUrls(parsed.images ?? []);
  const heroFromSelection = images.hero_image_url
    ? normalizeReaImageUrl(images.hero_image_url)
    : null;
  const selectedFromListing =
    images.selected_image_urls.length > 0
      ? normalizeReaImageUrls(images.selected_image_urls)
      : parsedImages;
  const ltrEnrichment = ltrEnrichmentFromParsed(parsed);
  const weeklyMin = parsed.rentalAppraisal?.weeklyMin ?? null;
  const weeklyMax = parsed.rentalAppraisal?.weeklyMax ?? null;
  const weeklyMidpoint = parsed.rentalAppraisal?.weeklyMidpoint ?? null;
  const annualMidpoint = weeklyMidpoint != null ? weeklyMidpoint * 52 : null;

  const rentRangeLabel =
    weeklyMin != null && weeklyMax != null
      ? formatWeeklyRentRange(weeklyMin, weeklyMax)
      : weeklyMidpoint != null
        ? formatWeeklyRentRange(weeklyMidpoint, weeklyMidpoint)
        : "";

  const address = listing.property_address ?? parsed.address ?? "";
  const compCount = ltrEnrichment?.comp_count ?? 0;
  const copy =
    copyOverride ??
    deriveLeaseAppraisalCopy({
      agency,
      listing,
      parsed,
      compCount,
      rentRangeLabel,
      weeklyMin,
      weeklyMax,
      weeklyMid: weeklyMidpoint,
      suburbMarket: ltrEnrichment?.suburb_market ?? parsed.ltrSuburbMarket,
      featuredComps: ltrEnrichment?.comps ?? [],
    });

  return {
    version: "lease_appraisal_v1",
    template_id: templateId,
    generated_at: new Date().toISOString(),
    agency: {
      name: agency.name,
      logo_url: agency.logo_dark_url ?? agency.logo_url ?? "",
      logo_light_url: agency.logo_light_url ?? "",
      logo_dark_url: agency.logo_dark_url ?? agency.logo_url ?? "",
      primary_colour: agency.primary_colour,
      secondary_colour: agency.background_colour ?? agency.secondary_colour,
      accent_colour: agency.accent_colour,
      text_colour: agency.text_colour ?? agency.primary_colour,
      callout_heading_colour: agency.callout_heading_colour ?? undefined,
      callout_text_colour: agency.callout_text_colour ?? undefined,
      background_colour: agency.background_colour ?? agency.secondary_colour,
      heading_font_family: agency.heading_font_family ?? agency.font_family,
      body_font_family: agency.body_font_family ?? agency.font_family,
      font_family: agency.body_font_family ?? agency.font_family,
      heading_font_file_url: agency.heading_font_file_url ?? "",
      body_font_file_url: agency.body_font_file_url ?? agency.font_file_url ?? "",
      font_file_url: agency.body_font_file_url ?? agency.font_file_url ?? "",
      website_url: agency.website_url ?? "",
      phone: agency.phone ?? "",
      email: agency.email ?? "",
      brand_advanced: agency.brand_advanced_json ?? null,
    },
    agent: primaryReportAgent(agents),
    agents,
    property: {
      address,
      suburb: listing.suburb ?? parsed.suburb ?? "",
      state: listing.state ?? parsed.state ?? "",
      postcode: listing.postcode ?? parsed.postcode ?? "",
      summary: listing.listing_title ?? address,
      property_type: listing.property_type ?? parsed.propertyType ?? "",
      bedrooms: listing.bedrooms ?? parsed.bedrooms ?? 0,
      bathrooms: listing.bathrooms ?? parsed.bathrooms ?? 0,
      car_spaces: listing.car_spaces ?? parsed.carSpaces ?? 0,
      accommodates: calculateAccommodates(
        listing.bedrooms ?? parsed.bedrooms,
        listing.accommodates,
      ),
      listing_url: listing.listing_url ?? "",
      hero_image_url:
        propertyImages?.hero_image_url ??
        heroFromSelection ??
        parsedImages[0] ??
        "",
      selected_image_urls:
        propertyImages?.selected_image_urls?.length
          ? propertyImages.selected_image_urls
          : selectedFromListing,
      display_price: listing.display_price ?? rentRangeLabel,
    },
    str: {
      annual_revenue: null,
      monthly_revenue: null,
      weekly_revenue: null,
      nightly_rate: null,
      occupancy_rate: null,
      booked_nights: null,
      radius_m: null,
    },
    str_yield: null,
    ltr: {
      weekly_min: weeklyMin,
      weekly_max: weeklyMax,
      weekly_midpoint: weeklyMidpoint,
      annual_midpoint: annualMidpoint,
      difference_before_costs: null,
    },
    copy,
    assets: {
      qr_code_url: report.qr_code_url ?? "",
      pdf_url: report.pdf_url ?? "",
    },
    str_enrichment: null,
    ltr_enrichment: ltrEnrichment,
  };
}
