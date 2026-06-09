import slugify from "slugify";
import { slugifyAgencyName } from "@/lib/reports/slugs";
import type { DeliveryTenant } from "@/lib/delivery/types";

const ADDRESS_SLUG_MAX = 72;

/** URL/filename-safe segment from a property address. */
export function slugifyReportAddressSegment(address: string): string {
  const segment = slugify(address.trim(), {
    lower: true,
    strict: true,
    trim: true,
  });

  return segment.slice(0, ADDRESS_SLUG_MAX) || "property";
}

/** Brand prefix for delivery PDF filenames (e.g. `havenly-property`). */
export function resolveDeliveryPdfBrandPrefix(tenant: DeliveryTenant): string {
  if (tenant.str_template_pack_id === "haven_properties") {
    return "havenly-property";
  }

  const displayName = tenant.brand?.displayName?.trim();
  if (displayName) {
    return slugifyAgencyName(displayName);
  }

  return (
    slugify(tenant.slug, { lower: true, strict: true, trim: true }) || "str-report"
  );
}

export function buildStrReportPdfFilename(
  brandPrefix: string,
  address: string,
): string {
  const prefix =
    slugify(brandPrefix.trim(), { lower: true, strict: true, trim: true }) ||
    "str-report";
  const addressSlug = slugifyReportAddressSegment(address);

  return `${prefix}-str-report-${addressSlug}.pdf`;
}

/** Human-friendly attachment/download name for managed delivery STR PDFs. */
export function buildDeliveryStrReportPdfFilename({
  tenant,
  address,
}: {
  tenant: DeliveryTenant;
  address: string;
}): string {
  return buildStrReportPdfFilename(resolveDeliveryPdfBrandPrefix(tenant), address);
}

export function buildLeaseAppraisalPdfFilename(
  brandPrefix: string,
  address: string,
): string {
  const prefix =
    slugify(brandPrefix.trim(), { lower: true, strict: true, trim: true }) ||
    "lease-appraisal";
  const addressSlug = slugifyReportAddressSegment(address);

  return `${prefix}-lease-appraisal-${addressSlug}.pdf`;
}

export function buildDeliveryLeaseAppraisalPdfFilename({
  tenant,
  address,
}: {
  tenant: DeliveryTenant;
  address: string;
}): string {
  return buildLeaseAppraisalPdfFilename(resolveDeliveryPdfBrandPrefix(tenant), address);
}

export function buildSalesBrochurePdfFilename(
  brandPrefix: string,
  address: string,
): string {
  const prefix =
    slugify(brandPrefix.trim(), { lower: true, strict: true, trim: true }) ||
    "sales-brochure";
  const addressSlug = slugifyReportAddressSegment(address);

  return `${prefix}-sales-brochure-${addressSlug}.pdf`;
}

export function buildDeliverySalesBrochurePdfFilename({
  tenant,
  address,
}: {
  tenant: DeliveryTenant;
  address: string;
}): string {
  return buildSalesBrochurePdfFilename(resolveDeliveryPdfBrandPrefix(tenant), address);
}
