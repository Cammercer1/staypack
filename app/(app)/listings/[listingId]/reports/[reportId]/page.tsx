import { notFound, redirect } from "next/navigation";
import { requireListingReportAccess } from "@/lib/auth/requireUser";
import { isLeaseAppraisalTemplateId } from "@/lib/reports/templates/shared/isLeaseAppraisalReport";
import { isSalesAppraisalTemplateId } from "@/lib/reports/templates/shared/isSalesAppraisalReport";

export default async function LegacyListingReportPage({ params }: { params: Promise<{ listingId: string; reportId: string }> }) {
  const { listingId, reportId } = await params;
  const { supabase, report, agency } = await requireListingReportAccess(listingId,reportId);
  const { data: appraisal, error } = await supabase.from("str_appraisals").select("report_id").eq("kind", "str").eq("report_id",reportId).eq("agency_id",agency.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (appraisal) redirect(`/short-term-rentals/appraisals/${reportId}`);
  const { data: collateral } = await supabase.from("collateral_items").select("type").eq("report_id",reportId).eq("agency_id",agency.id).maybeSingle();
  if (collateral?.type === "lease_appraisal" || isLeaseAppraisalTemplateId(report.template_id)) redirect(`/listings/${listingId}/lease-appraisal?reportId=${reportId}`);
  if (collateral?.type === "sales_appraisal" || isSalesAppraisalTemplateId(report.template_id)) redirect(`/listings/${listingId}/sales-appraisal?reportId=${reportId}`);
  notFound();
}
