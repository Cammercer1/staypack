import { appraisalPath, type WorkspaceAppraisalKind } from "@/lib/appraisals/workspaceTypes";
import { hasStaleAppraisal } from "@/lib/appraisals/resolveAppraisalInput";
import { isLeaseAppraisalTemplateId } from "@/lib/reports/templates/shared/isLeaseAppraisalReport";
import { isSalesAppraisalTemplateId } from "@/lib/reports/templates/shared/isSalesAppraisalReport";
import { collateralEditorPath, COLLATERAL_TYPE_META } from "./collateralTypes";
import { isConfirmedStrReport } from "@/lib/str-appraisals/classification";
import type {
  Listing,
  Report,
  CollateralItem,
  CollateralType,
} from "@/lib/types";

export type ListingDocument = {
  id: string;
  type: CollateralType;
  name: string;
  status: string;
  updatedAt: string;
  href: string;
  publicUrl: string | null;
  report?: Report;
  collateral?: CollateralItem;
};
export function reportDocumentType(report: Report): CollateralType | null {
  if (isSalesAppraisalTemplateId(report.template_id)) return "sales_appraisal";
  if (isLeaseAppraisalTemplateId(report.template_id)) return "lease_appraisal";
  return isConfirmedStrReport(report) ? "str_report" : null;
}
export function documentStatus(status: string, stale: boolean) {
  if (status === "failed") return "Needs attention";
  if (stale) return "Needs updating";
  if (status === "published") return "Published";
  if (status === "generated") return "Ready";
  return "Draft";
}
export function listingDocuments(
  listing: Listing,
  reports: Report[],
  collateral: CollateralItem[],
  strReportIds: string[] = [],
  appraisalKinds: Record<string, WorkspaceAppraisalKind> = {},
): ListingDocument[] {
  const active = reports.filter((r) => r.status !== "archived");
  const documents: ListingDocument[] = active.flatMap((report) => {
    const type =
      collateral.find(
        (item) => item.report_id === report.id && item.status !== "archived",
      )?.type ?? (strReportIds.includes(report.id) ? "str_report" : reportDocumentType(report));
    if (!type) return [];
    const stale =
      type === "sales_appraisal"
        ? hasStaleAppraisal(listing, "sales")
        : type === "lease_appraisal" && hasStaleAppraisal(listing, "lease");
    return [{
      id: report.id,
      type,
      name: COLLATERAL_TYPE_META[type].label,
      status: documentStatus(report.status, appraisalKinds[report.id] ? false : stale),
      updatedAt: report.updated_at,
      href: appraisalKinds[report.id] ? appraisalPath(report.id, appraisalKinds[report.id]) :
        type === "str_report"
          ? `/short-term-rentals/appraisals/${report.id}`
          : `${collateralEditorPath(listing.id, type)}?reportId=${report.id}`,
      publicUrl: report.status === "published" ? report.public_url : null,
      report,
    }];
  });
  for (const item of collateral) {
    if (
      item.status === "archived" ||
      COLLATERAL_TYPE_META[item.type].comingSoon ||
      (item.report_id && active.some((r) => r.id === item.report_id))
    )
      continue;
    const href = collateralEditorPath(listing.id, item.type);
    if (!href) continue;
    documents.push({
      id: item.id,
      type: item.type,
      name: COLLATERAL_TYPE_META[item.type].label,
      status: documentStatus(item.status, false),
      updatedAt: item.updated_at,
      href,
      publicUrl: item.status === "published" ? item.public_url : null,
      collateral: item,
    });
  }
  return documents.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
