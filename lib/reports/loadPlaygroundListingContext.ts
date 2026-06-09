import { requireListingAccess } from "@/lib/auth/requireUser";
import { resolvePlaygroundSalesBrochure } from "@/lib/collateral/sales-brochure/resolvePlaygroundSalesBrochure";
import { resolvePlaygroundLeaseAppraisal } from "@/lib/lease-appraisal/resolvePlaygroundLeaseAppraisal";
import {
  enrichPlaygroundFinalReportAgents,
  enrichPlaygroundSalesBrochureAgents,
  loadPlaygroundListingAgents,
  toPlaygroundListingPreview,
  type PlaygroundListingPreview,
} from "@/lib/reports/playgroundListingPreview";
import { resolvePlaygroundFinalReport } from "@/lib/reports/resolvePlaygroundFinalReport";
import { isLeaseAppraisalReport } from "@/lib/reports/templates/shared/isLeaseAppraisalReport";
import type { BrochureDocumentJson } from "@/lib/collateral/templates/types";
import type { Agency, AgentProfile, CollateralItem, FinalReportJson, Listing, Report } from "@/lib/types";

export type PlaygroundListingContext = {
  listingId: string;
  agency: Agency;
  listing: Listing;
  propertyAddress: string | null;
  strReport: FinalReportJson | null;
  strReportId: string | null;
  leaseReport: FinalReportJson | null;
  leaseReportId: string | null;
  salesBrochure: BrochureDocumentJson;
  salesCollateralId: string | null;
  hasLiveStr: boolean;
  hasLiveLease: boolean;
  hasLiveSales: boolean;
  listingPreview: PlaygroundListingPreview;
  agentProfile: AgentProfile | null;
  agencyAgents: AgentProfile[];
};

async function loadReport(
  supabase: Awaited<ReturnType<typeof requireListingAccess>>["supabase"],
  reportId: string,
): Promise<Report | null> {
  const { data } = await supabase
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();

  return (data as Report | null) ?? null;
}

/** Listing-scoped playground data: STR, lease, and sales brochure with current agency brand. */
export async function loadPlaygroundListingContext(
  listingId: string,
): Promise<PlaygroundListingContext | null> {
  try {
    const { supabase, agency, listing } = await requireListingAccess(listingId);

    const { data: collaterals } = await supabase
      .from("collateral_items")
      .select("*")
      .eq("listing_id", listingId)
      .neq("status", "archived");

    const items = (collaterals ?? []) as CollateralItem[];
    const strCollateral = items.find((c) => c.type === "str_report");
    const leaseCollateral = items.find((c) => c.type === "lease_appraisal");
    const salesCollateral =
      items.find((c) => c.type === "sales_brochure") ?? null;

    let strReport: FinalReportJson | null = null;
    let strReportId: string | null = null;

    if (strCollateral?.report_id) {
      const report = await loadReport(supabase, strCollateral.report_id);
      if (report) {
        strReport = await resolvePlaygroundFinalReport(supabase, agency, listing, report);
        if (strReport) {
          strReportId = report.id;
        }
      }
    }

    if (!strReport) {
      const { data: reports } = await supabase
        .from("reports")
        .select("*")
        .eq("listing_id", listingId)
        .order("updated_at", { ascending: false });

      const leaseReportId = leaseCollateral?.report_id;
      for (const report of (reports ?? []) as Report[]) {
        if (leaseReportId && report.id === leaseReportId) {
          continue;
        }
        const candidate = await resolvePlaygroundFinalReport(
          supabase,
          agency,
          listing,
          report,
        );
        if (candidate && !isLeaseAppraisalReport(candidate)) {
          strReport = candidate;
          strReportId = report.id;
          break;
        }
      }
    }

    let leaseReport: FinalReportJson | null = null;
    let leaseReportId: string | null = null;

    if (leaseCollateral?.report_id) {
      const report = await loadReport(supabase, leaseCollateral.report_id);
      if (report) {
        leaseReport = await resolvePlaygroundLeaseAppraisal({
          supabase,
          agency,
          listing,
          report,
          collateral: leaseCollateral,
        });
        if (leaseReport) {
          leaseReportId = report.id;
        }
      }
    }

    const listingAgents = await loadPlaygroundListingAgents(supabase, agency, listing);

    if (strReport) {
      strReport = enrichPlaygroundFinalReportAgents(listing, strReport, listingAgents);
    }
    if (leaseReport) {
      leaseReport = enrichPlaygroundFinalReportAgents(listing, leaseReport, listingAgents);
    }

    let salesBrochure = await resolvePlaygroundSalesBrochure({
      supabase,
      agency,
      listing,
      collateral: salesCollateral,
    });
    salesBrochure = enrichPlaygroundSalesBrochureAgents(
      listing,
      salesBrochure,
      listingAgents,
    );

    const hasLiveSales = Boolean(
      salesCollateral &&
        (salesCollateral.document_json ||
          listing.scraped_listing_json),
    );

    return {
      listingId,
      agency,
      listing,
      propertyAddress: listing.property_address,
      strReport,
      strReportId,
      leaseReport,
      leaseReportId,
      salesBrochure,
      salesCollateralId: salesCollateral?.id ?? null,
      hasLiveStr: Boolean(strReport),
      hasLiveLease: Boolean(leaseReport),
      hasLiveSales,
      listingPreview: toPlaygroundListingPreview(listing),
      agentProfile: listingAgents.agentProfile,
      agencyAgents: listingAgents.agencyAgents,
    };
  } catch {
    return null;
  }
}
