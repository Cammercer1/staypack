import { splitBrochureImages } from "@/lib/collateral/buildSalesBrochureDocument";
import { blurbStringToBlocks } from "@/lib/collateral/sales-brochure/blurbBlocks";
import { resolveBrochureCopyForTemplate } from "@/lib/copy/resolveBrochureCopyForTemplate";
import { resolveReportForTemplatePreview } from "@/lib/copy/resolveReportBlurb";
import { salesBrochureTemplateIdForFamily } from "@/lib/reports/templates/salesBrochureFamilyMap";
import { familyFromTemplateId } from "@/lib/reports/templates/playgroundResolve";
import type { SalesBrochureDocumentJson } from "@/lib/collateral/templates/types";
import { resolveLeaseBrochurePriceValue } from "@/lib/reports/resolveLeaseBrochurePriceValue";
import {
  resolveStrBrochurePriceLabel,
  resolveStrBrochurePriceValue,
} from "@/lib/reports/resolveStrBrochurePrice";
import {
  isLeasePageVariant,
  isStrPageVariant,
  resolveReportPageVariant,
  type ReportPageVariant,
} from "@/lib/reports/templates/shared/reportPageVariant";
import type { FinalReportJson } from "@/lib/types";

function buildPropertyImagesFromReport(report: FinalReportJson) {
  const hero = report.property.hero_image_url?.trim() ?? "";
  const selected = (report.property.selected_image_urls ?? []).filter(
    (url) => url && url !== hero,
  );
  const urls = [hero, ...selected].filter(Boolean);
  return splitBrochureImages(urls);
}

export type FinalReportToBrochureShapeOptions = {
  /** Preview a layout family (e.g. classic) independent of report.template_id. */
  layoutFamily?: string;
  allowDevBlurbLengthMap?: boolean;
};

/** Maps STR / lease final report into brochure layout shape (page-one gallery slots, copy blocks). */
export function finalReportToBrochureShape(
  report: FinalReportJson,
  reportVariant?: ReportPageVariant,
  options?: FinalReportToBrochureShapeOptions,
): SalesBrochureDocumentJson {
  const variant = resolveReportPageVariant(report, reportVariant);
  const images = buildPropertyImagesFromReport(report);
  const brochureTemplateId =
    variant === "sale"
      ? report.template_id
      : salesBrochureTemplateIdForFamily(
          options?.layoutFamily ??
            familyFromTemplateId(report.template_id, variant),
          1,
        );
  const resolvedReport = resolveReportForTemplatePreview(report, {
    templateId: brochureTemplateId,
    collateral: variant,
    allowDevBlurbLengthMap: options?.allowDevBlurbLengthMap,
  });
  const resolvedCopy = resolveBrochureCopyForTemplate(
    {
      heading: resolvedReport.copy.heading,
      blurb: resolvedReport.copy.blurb,
      blurb_blocks: blurbStringToBlocks(resolvedReport.copy.blurb),
      blurb_variants: resolvedReport.copy.blurb_variants,
      template_blurb_length: resolvedReport.copy.template_blurb_length,
      property_highlights: resolvedReport.copy.appeal_points ?? [],
      inspection_cta: "",
      disclaimer: resolvedReport.copy.disclaimer ?? "",
    },
    brochureTemplateId,
    variant,
    options?.allowDevBlurbLengthMap ?? false,
  );
  const blurb = resolvedCopy.blurb;
  const blurbBlocks = resolvedCopy.blurb_blocks;
  const appealPoints = resolvedCopy.property_highlights;

  return {
    version: "sales_brochure_v1",
    type: "sales_brochure",
    template_id: report.template_id,
    generated_at: report.generated_at,
    agency: {
      name: report.agency.name,
      logo_url: report.agency.logo_url ?? "",
      logo_light_url: report.agency.logo_light_url ?? "",
      logo_dark_url: report.agency.logo_dark_url ?? "",
      primary_colour: report.agency.primary_colour,
      secondary_colour: report.agency.secondary_colour,
      accent_colour: report.agency.accent_colour,
      text_colour: report.agency.text_colour,
      callout_heading_colour: report.agency.callout_heading_colour ?? null,
      callout_text_colour: report.agency.callout_text_colour ?? null,
      background_colour: report.agency.background_colour,
      heading_font_family: report.agency.heading_font_family,
      body_font_family: report.agency.body_font_family,
      font_family: report.agency.font_family,
      heading_font_file_url: report.agency.heading_font_file_url,
      body_font_file_url: report.agency.body_font_file_url,
      font_file_url: report.agency.font_file_url,
      website_url: report.agency.website_url,
      phone: report.agency.phone,
      email: report.agency.email,
      brand_advanced: report.agency.brand_advanced ?? null,
    },
    agent: report.agent,
    agents: report.agents ?? [],
    listing_image_meta: {},
    property: {
      address: report.property.address,
      suburb: report.property.suburb,
      state: report.property.state,
      postcode: report.property.postcode,
      summary: report.property.summary,
      property_type: report.property.property_type,
      bedrooms: report.property.bedrooms,
      bathrooms: report.property.bathrooms,
      car_spaces: report.property.car_spaces,
      land_area_sqm: null,
      display_price: report.property.display_price ?? "",
      hero_image_url: images.hero_image_url,
      selected_image_urls: images.selected_image_urls,
      page_one_image_urls: images.page_one_image_urls,
      page_two_image_urls: images.page_two_image_urls,
    },
    copy: {
      heading: resolvedCopy.heading,
      blurb,
      blurb_blocks: blurbBlocks,
      blurb_variants: resolvedCopy.blurb_variants,
      template_blurb_length: resolvedCopy.template_blurb_length,
      property_highlights: appealPoints,
      inspection_cta: "",
      disclaimer: report.copy.disclaimer ?? "",
      price_label: isLeasePageVariant(variant)
        ? "Indicative rent"
        : isStrPageVariant(variant)
          ? resolveStrBrochurePriceLabel()
          : "Price",
      price_value: isLeasePageVariant(variant)
        ? (resolveLeaseBrochurePriceValue(report) ?? "")
        : isStrPageVariant(variant)
          ? (resolveStrBrochurePriceValue(report) ?? "")
          : (report.property.display_price ?? ""),
    },
    qr_target_url: report.property.listing_url ?? "",
    assets: {
      qr_code_url: report.assets.qr_code_url,
    },
  };
}
