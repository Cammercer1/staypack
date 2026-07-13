import { mergeLeaseAppraisalPreviewFromListing } from "@/lib/lease-appraisal/mergeLeaseAppraisalPreviewFromListing";
import { mergeSalesAppraisalPreviewFromListing } from "@/lib/sales-appraisal/mergeSalesAppraisalPreviewFromListing";
import { resolveFinalReportForDisplay } from "@/lib/reports/resolveFinalReportForDisplay";
import { isLeaseAppraisalTemplateId } from "@/lib/reports/templates/shared/isLeaseAppraisalReport";
import { isSalesAppraisalTemplateId } from "@/lib/reports/templates/shared/isSalesAppraisalReport";
import type { FinalReportJson, Listing } from "@/lib/types";

type ReportRowForPrint = {
  template_id?: string | null;
};

type ListingForAppraisalPrint = Pick<
  Listing,
  | "display_price"
  | "scraped_listing_json"
  | "property_address"
  | "suburb"
  | "state"
  | "postcode"
>;

/**
 * Print/PDF must use the reports.template_id column and fresh appraisal comps —
 * not a stale template_id embedded in final_report_json from an older STR build.
 */
export function resolveFinalReportForPrint(
  reportRow: ReportRowForPrint,
  listing: ListingForAppraisalPrint | null,
  finalReport: FinalReportJson,
): FinalReportJson {
  const rowTemplateId = reportRow.template_id?.trim() || null;
  const jsonTemplateId = finalReport.template_id?.trim() || null;
  const templateId =
    rowTemplateId &&
    (isLeaseAppraisalTemplateId(rowTemplateId) ||
      isSalesAppraisalTemplateId(rowTemplateId))
      ? rowTemplateId
      : rowTemplateId ?? jsonTemplateId;

  let resolved: FinalReportJson = {
    ...finalReport,
    template_id: templateId ?? jsonTemplateId ?? finalReport.template_id,
  };

  const isLease =
    resolved.version === "lease_appraisal_v1" ||
    isLeaseAppraisalTemplateId(templateId ?? resolved.template_id);
  const isSalesAppraisal =
    resolved.version === "sales_appraisal_v1" ||
    isSalesAppraisalTemplateId(templateId ?? resolved.template_id);

  if (isLease && listing?.scraped_listing_json) {
    resolved = mergeLeaseAppraisalPreviewFromListing(
      resolved,
      listing as Listing,
    );
  }

  if (isSalesAppraisal && listing?.scraped_listing_json) {
    resolved = mergeSalesAppraisalPreviewFromListing(
      resolved,
      listing as Listing,
    );
  }

  return resolveFinalReportForDisplay(resolved);
}
