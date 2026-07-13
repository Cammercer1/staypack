import { formatSalePriceRange } from "@/lib/sales/computeSalePriceBand";
import { salesEnrichmentFromParsed } from "@/lib/sales-appraisal/salesEnrichmentFromParsed";
import { DEFAULT_SALES_APPRAISAL_TEMPLATE_ID } from "@/lib/reports/templates/sales-appraisal/ids";
import { calculateAccommodates } from "@/lib/reports/formatters";
import {
  primaryReportAgent,
  resolveReportAgents,
  type ReportAgent,
} from "@/lib/reports/resolveReportAgents";
import { resolveCollateralImageSelection } from "@/lib/listings/collateralImages";
import {
  normalizeReaImageUrl,
  normalizeReaImageUrls,
} from "@/lib/scraping/rea/normalizeReaImageUrl";
import {
  deriveSalesAppraisalCopy,
  type SalesAppraisalCopy,
} from "@/lib/sales-appraisal/deriveSalesAppraisalCopy";
import type { ReportPropertyImageSelection } from "@/lib/reports/editable/reportImageSlots";
import type {
  Agency,
  AgentProfile,
  FinalReportJson,
  Listing,
  ParsedListing,
  Report,
} from "@/lib/types";

export type BuildSalesAppraisalReportInput = {
  agency: Agency;
  listing: Listing;
  report: Report;
  parsed: ParsedListing;
  agentProfile?: AgentProfile | null;
  agencyAgents?: AgentProfile[];
  templateId?: string;
  /** Vendor copy; defaults to listing-derived text (use AI via generateSalesAppraisalCopy). */
  copy?: SalesAppraisalCopy;
  /** Preserves hero/gallery picks from the content editor across rebuilds. */
  propertyImages?: ReportPropertyImageSelection;
  resolvedAgents?: ReportAgent[];
};

export function buildSalesAppraisalReport({
  agency,
  listing,
  report,
  parsed,
  agentProfile,
  agencyAgents,
  templateId = DEFAULT_SALES_APPRAISAL_TEMPLATE_ID,
  copy: copyOverride,
  propertyImages,
  resolvedAgents,
}: BuildSalesAppraisalReportInput): FinalReportJson {
  const agents =
    resolvedAgents ??
    resolveReportAgents({
      scraped: parsed,
      agentProfile,
      agencyAgents,
    });
  const images = resolveCollateralImageSelection(listing, "sales_appraisal");
  const parsedImages = normalizeReaImageUrls(parsed.images ?? []);
  const heroFromSelection = images.hero_image_url
    ? normalizeReaImageUrl(images.hero_image_url)
    : null;
  const selectedFromListing =
    images.selected_image_urls.length > 0
      ? normalizeReaImageUrls(images.selected_image_urls)
      : parsedImages;
  const salesEnrichment = salesEnrichmentFromParsed(parsed);
  const priceMin = parsed.salesAppraisal?.priceMin ?? null;
  const priceMax = parsed.salesAppraisal?.priceMax ?? null;
  const priceMidpoint = parsed.salesAppraisal?.priceMidpoint ?? null;

  const priceRangeLabel =
    priceMin != null && priceMax != null
      ? formatSalePriceRange(priceMin, priceMax)
      : priceMidpoint != null
        ? formatSalePriceRange(priceMidpoint, priceMidpoint)
        : "";

  const address = listing.property_address ?? parsed.address ?? "";
  const copy =
    copyOverride ??
    deriveSalesAppraisalCopy({
      agency,
      listing,
      parsed,
      soldCompCount: salesEnrichment?.sold_comp_count ?? 0,
      forSaleCompCount: salesEnrichment?.for_sale_comp_count ?? 0,
      priceMin,
      priceMax,
      featuredComps: salesEnrichment?.comps ?? [],
    });

  return {
    version: "sales_appraisal_v1",
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
      display_price: listing.display_price ?? priceRangeLabel,
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
      weekly_min: null,
      weekly_max: null,
      weekly_midpoint: null,
      annual_midpoint: null,
      difference_before_costs: null,
    },
    sale_estimate: {
      price_min: priceMin,
      price_max: priceMax,
      price_midpoint: priceMidpoint,
    },
    copy,
    assets: {
      qr_code_url: report.qr_code_url ?? "",
      pdf_url: report.pdf_url ?? "",
    },
    str_enrichment: null,
    ltr_enrichment: null,
    sales_enrichment: salesEnrichment,
  };
}
