import type {
  Agency,
  AgentProfile,
  AiCopyJson,
  FinalReportJson,
  ParsedListing,
  Report,
  StrEstimate,
} from "@/lib/types";
import { DEFAULT_DISCLAIMER } from "@/lib/types";
import { calculateAccommodates } from "@/lib/reports/formatters";
import { calculateStrGrossYield } from "@/lib/reports/calculateStrYield";
import { normalizeDisplayPrice } from "@/lib/scraping/normalizeDisplayPrice";
import {
  primaryReportAgent,
  resolveReportAgents,
} from "@/lib/reports/resolveReportAgents";
import { resolveReportTemplateId } from "@/lib/reports/templates/resolveTemplateId";

type BuildFinalReportInput = {
  agency: Agency;
  agentProfile?: AgentProfile | null;
  agencyAgents?: AgentProfile[];
  report: Report;
  estimate: StrEstimate;
  copy: AiCopyJson;
  scraped?: ParsedListing | null;
};

export function buildFinalReportJson({
  agency,
  agentProfile,
  agencyAgents,
  report,
  estimate,
  copy,
  scraped,
}: BuildFinalReportInput): FinalReportJson {
  const weeklyMin = scraped?.rentalAppraisal?.weeklyMin ?? null;
  const weeklyMax = scraped?.rentalAppraisal?.weeklyMax ?? null;
  const weeklyMidpoint =
    scraped?.rentalAppraisal?.weeklyMidpoint ??
    (weeklyMin != null && weeklyMax != null
      ? (weeklyMin + weeklyMax) / 2
      : null);
  const annualMidpoint =
    weeklyMidpoint != null ? weeklyMidpoint * 52 : null;
  const differenceBeforeCosts =
    annualMidpoint != null && estimate.annualRevenue != null
      ? estimate.annualRevenue - annualMidpoint
      : null;
  const agents = resolveReportAgents({
    scraped: scraped ?? report.scraped_listing_json,
    agentProfile,
    agencyAgents,
  });
  const displayPrice =
    normalizeDisplayPrice(report.display_price) ?? report.display_price ?? null;
  const strYield = calculateStrGrossYield(displayPrice, estimate.annualRevenue);

  return {
    version: "standard_2_page_v1",
    template_id: resolveReportTemplateId(agency, report),
    generated_at: new Date().toISOString(),
    agency: {
      name: agency.name,
      logo_url: agency.logo_url ?? "",
      primary_colour: agency.primary_colour,
      secondary_colour: agency.background_colour ?? agency.secondary_colour,
      accent_colour: agency.accent_colour,
      text_colour: agency.text_colour ?? agency.primary_colour,
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
    },
    agent: primaryReportAgent(agents),
    agents,
    property: {
      address: report.property_address ?? "",
      suburb: report.suburb ?? "",
      state: report.state ?? "",
      postcode: report.postcode ?? "",
      summary: report.listing_title ?? report.property_address ?? "",
      property_type: report.property_type ?? "",
      bedrooms: report.bedrooms ?? 0,
      bathrooms: report.bathrooms ?? 0,
      car_spaces: report.car_spaces ?? 0,
      accommodates: calculateAccommodates(
        report.bedrooms,
        report.accommodates,
      ),
      listing_url: report.listing_url ?? "",
      hero_image_url: report.hero_image_url ?? "",
      selected_image_urls: report.selected_image_urls ?? [],
      display_price: displayPrice,
    },
    str: {
      annual_revenue: estimate.annualRevenue,
      monthly_revenue: estimate.monthlyRevenue,
      weekly_revenue: estimate.weeklyRevenue,
      nightly_rate: estimate.nightlyRate,
      occupancy_rate: estimate.occupancyRate,
      booked_nights: estimate.bookedNights,
      radius_m: estimate.radiusM,
    },
    str_yield: strYield,
    ltr: {
      weekly_min: weeklyMin,
      weekly_max: weeklyMax,
      weekly_midpoint: weeklyMidpoint,
      annual_midpoint: annualMidpoint,
      difference_before_costs: differenceBeforeCosts,
    },
    copy: {
      heading: copy.sales_pack_heading,
      blurb: copy.sales_pack_blurb,
      key_metrics_line: copy.key_metrics_line,
      appeal_points: copy.property_appeal_points,
      supporting_factors: copy.performance_supporting_factors,
      buyer_checks: copy.buyer_checks,
      methodology_note: copy.methodology_note,
      disclaimer: copy.disclaimer || agency.default_disclaimer || DEFAULT_DISCLAIMER,
      cta: agency.default_cta,
    },
    assets: {
      qr_code_url: report.qr_code_url ?? "",
      pdf_url: report.pdf_url ?? "",
    },
    str_enrichment: report.str_enrichment_json ?? null,
  };
}

export function getMockAiCopy(report: Report, agency: Agency): AiCopyJson {
  const address = report.property_address ?? "this property";

  return {
    sales_pack_heading: `${agency.default_report_title}`,
    sales_pack_blurb: `This report outlines the estimated gross short-term rental revenue potential for ${address}. Figures are indicative only and should be reviewed alongside local market conditions and buyer objectives.`,
    key_metrics_line:
      "Estimated gross STR revenue before costs, based on comparable short-term rental performance nearby.",
    property_appeal_points: [
      "Location and property configuration may suit short-stay demand.",
      "Flexible accommodation layout can appeal to a range of guest profiles.",
    ],
    performance_supporting_factors: [
      "Comparable short-term rental activity in the surrounding area.",
      "Property size and bedroom count aligned with local booking patterns.",
    ],
    buyer_checks: [
      "Confirm local council and strata rules for short-term stays.",
      "Review furnishing, management and operating cost assumptions.",
    ],
    methodology_note:
      "Estimates are derived from comparable short-term rental market data near the subject property.",
    disclaimer: agency.default_disclaimer ?? DEFAULT_DISCLAIMER,
    confidence_notes: "Mock copy generated in development mode.",
  };
}

export function getMockStrEstimate(): StrEstimate {
  return {
    annualRevenue: 72000,
    monthlyRevenue: 6000,
    weeklyRevenue: 1385,
    nightlyRate: 285,
    occupancyRate: 69,
    bookedNights: 252,
    radiusM: 500,
    raw: { mock: true },
  };
}
