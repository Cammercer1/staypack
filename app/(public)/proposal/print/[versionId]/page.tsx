import { notFound } from "next/navigation";
import { z } from "zod";
import { ReportPreview } from "@/components/reports/ReportPreview";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyProposalPrintToken } from "@/lib/digital-proposals/printAccess";
import { proposalSnapshotSchema } from "@/lib/digital-proposals/workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rental appraisal", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

/** Browserless reads this fixed version. Never rebuild a published PDF from live report inputs. */
export default async function ProposalPrintPage({ params, searchParams }: {
  params: Promise<{ versionId: string }>; searchParams: Promise<{ token?: string }>;
}) {
  const { versionId } = await params;
  const { token } = await searchParams;
  if (!z.uuid().safeParse(versionId).success || !token || !verifyProposalPrintToken(versionId, token)) notFound();
  const admin = createAdminClient();
  const version = await admin.from("digital_proposal_versions").select("agency_id,report_id,final_report_json")
    .eq("id", versionId).is("revoked_at", null).maybeSingle();
  if (version.error || !version.data) notFound();
  const report = await admin.from("reports").select("listing_id").eq("id", version.data.report_id)
    .eq("agency_id", version.data.agency_id).neq("status", "archived").maybeSingle();
  if (report.error || !report.data) notFound();
  const listing = await admin.from("listings").select("id").eq("id", report.data.listing_id)
    .eq("agency_id", version.data.agency_id).neq("status", "archived").maybeSingle();
  if (listing.error || !listing.data) notFound();
  const snapshot = proposalSnapshotSchema.parse(version.data.final_report_json);
  if (!snapshot.pdfReport) notFound();
  return <div className="report-print-root print-mode"><ReportPreview report={snapshot.pdfReport} printMode /></div>;
}
