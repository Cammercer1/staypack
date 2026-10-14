import { createAdminClient } from "@/lib/supabase/admin";
import { requireStrAppraisalAccess } from "@/lib/str-appraisals/service";
import { privateJson } from "@/lib/str-appraisals/api";
import { proposalApiError } from "@/lib/digital-proposals/http";
import { ProposalError } from "@/lib/digital-proposals/server";
import { comparablesByEstimate } from "@/lib/digital-proposals/data";
import { proposalSnapshotSchema } from "@/lib/digital-proposals/workspace";
import { activityLabels, type ActivitySummary } from "@/lib/digital-proposals/activity";
export async function GET(_request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const { agency, report, supabase } = await requireStrAppraisalAccess((await params).reportId);
    const result = await createAdminClient().rpc("proposal_activity_summary", { p_agency_id: agency.id, p_report_id: report.id });
    if (result.error) throw new ProposalError("Unable to load activity.", 500);
    const summary = result.data as ActivitySummary;
    const versionIds = [...new Set(summary.items.map(item => item.versionId))];
    const versions = versionIds.length ? await supabase.from("digital_proposal_versions").select("id,final_report_json")
      .eq("agency_id", agency.id).eq("report_id", report.id).in("id", versionIds) : { data: [], error: null };
    if (result.error || versions.error) throw new ProposalError("Unable to load activity.", 500);
    const labels = new Map<string, string>();
    for (const version of versions.data ?? []) {
      const snapshot = proposalSnapshotSchema.parse(version.final_report_json);
      for (const page of snapshot.draft.pages) labels.set(`${version.id}:page:${page.id}`, page.title);
      for (const link of snapshot.draft.links) labels.set(`${version.id}:${link.kind === "sign" ? "agreement" : "action"}:${link.id}`, link.label);
      comparablesByEstimate(snapshot.data).forEach((item, index) => labels.set(`${version.id}:comparable:${index}`, item.name));
      for (const attachment of snapshot.attachments) labels.set(`${version.id}:document:${attachment.id}`, attachment.name);
    }
    summary.items = summary.items.map(item => ({ ...item, label: labels.get(`${item.versionId}:${item.kind}:${item.target}`) ?? (item.kind === "comparison" ? ({ annual: "Annual", monthly: "Monthly", yield: "Gross yield" }[item.target] ?? item.target) : item.kind === "comparable" ? `Comparable ${Number(item.target) + 1}` : activityLabels[item.kind]) }));
    return privateJson(summary);
  } catch (error) { return proposalApiError(error); }
}
