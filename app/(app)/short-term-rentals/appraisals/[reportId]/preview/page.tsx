import { notFound } from "next/navigation";
import { requireStrAppraisalAccess } from "@/lib/str-appraisals/service";
import { proposalSnapshotSchema } from "@/lib/digital-proposals/workspace";
import { MultiPageProposal } from "@/components/digital-proposals/MultiPageProposal";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function PreviewPage({ params, searchParams }: { params: Promise<{ reportId: string }>; searchParams: Promise<{ version?: string }> }) {
  const { reportId } = await params;
  const { agency, supabase } = await requireStrAppraisalAccess(reportId);
  const { version } = await searchParams;
  const result = await supabase.from("digital_proposal_versions").select("final_report_json").eq("agency_id", agency.id).eq("report_id", reportId).eq("id", version ?? "").maybeSingle();
  if (result.error || !result.data) notFound();
  const snapshot = proposalSnapshotSchema.parse(result.data.final_report_json);
  return <div className="space-y-5"><Link className="underline" href={`/short-term-rentals/appraisals/${reportId}`}>Back to appraisal</Link><p className="text-sm text-muted-foreground">Published preview · activity is not recorded</p><MultiPageProposal {...snapshot} attachments={snapshot.attachments.map(item => ({ ...item, href: `/api/str/appraisals/${reportId}/proposal/attachments/${item.id}` }))} /></div>;
}
