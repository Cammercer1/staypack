import { mergeClassicBrochureMetricsReport } from "@/lib/collateral/templates/sales-brochure/shared/mergeClassicBrochureMetricsReport";
import { resolvePlaygroundLeaseAppraisal } from "@/lib/lease-appraisal/resolvePlaygroundLeaseAppraisal";
import { resolvePlaygroundFinalReport } from "@/lib/reports/resolvePlaygroundFinalReport";
import { isLeaseAppraisalReport } from "@/lib/reports/templates/shared/isLeaseAppraisalReport";
import type { Agency, CollateralItem, FinalReportJson, Listing, Report } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

async function loadReport(
  admin: SupabaseClient,
  reportId: string,
): Promise<Report | null> {
  const { data } = await admin.from("reports").select("*").eq("id", reportId).maybeSingle();
  return (data as Report | null) ?? null;
}

/** STR + lease final reports for Classic page-one metrics on sale brochures. */
export async function loadClassicBrochureMetricsForListing({
  admin,
  agency,
  listing,
  listingId,
}: {
  admin: SupabaseClient;
  agency: Agency;
  listing: Listing;
  listingId: string;
}): Promise<FinalReportJson | null> {
  const { data: collaterals } = await admin
    .from("collateral_items")
    .select("*")
    .eq("listing_id", listingId)
    .neq("status", "archived");

  const items = (collaterals ?? []) as CollateralItem[];
  const strCollateral = items.find((c) => c.type === "str_report");
  const leaseCollateral = items.find((c) => c.type === "lease_appraisal");

  let strReport: FinalReportJson | null = null;
  if (strCollateral?.report_id) {
    const report = await loadReport(admin, strCollateral.report_id);
    if (report) {
      strReport = await resolvePlaygroundFinalReport(admin, agency, listing, report);
    }
  }

  if (!strReport) {
    const { data: reports } = await admin
      .from("reports")
      .select("*")
      .eq("listing_id", listingId)
      .order("updated_at", { ascending: false });

    const leaseReportId = leaseCollateral?.report_id;
    for (const report of (reports ?? []) as Report[]) {
      if (leaseReportId && report.id === leaseReportId) {
        continue;
      }
      const candidate = await resolvePlaygroundFinalReport(admin, agency, listing, report);
      if (candidate && !isLeaseAppraisalReport(candidate)) {
        strReport = candidate;
        break;
      }
    }
  }

  let leaseReport: FinalReportJson | null = null;
  if (leaseCollateral?.report_id) {
    const report = await loadReport(admin, leaseCollateral.report_id);
    if (leaseCollateral && report) {
      leaseReport = await resolvePlaygroundLeaseAppraisal({
        supabase: admin,
        agency,
        listing,
        report,
        collateral: leaseCollateral,
      });
    }
  }

  if (!strReport && !leaseReport) {
    return null;
  }

  const base = strReport ?? leaseReport!;
  return mergeClassicBrochureMetricsReport(base, { strReport, leaseReport });
}
