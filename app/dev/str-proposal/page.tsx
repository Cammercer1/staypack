import { notFound, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { DigitalProposalPlayground } from "@/components/dev/DigitalProposalPlayground";
import { proposalContext, loadProposalWorkspace } from "@/lib/digital-proposals/server";
import { applyAssignment, assignmentBrand } from "@/lib/digital-proposals/assignment";
import { withProposalAgents } from "@/lib/digital-proposals/agents";
import { withProposalPhotos } from "@/lib/digital-proposals/photos";
import { MultiPageProposal } from "@/components/digital-proposals/MultiPageProposal";

export const metadata = { title: "Digital template studio", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DigitalProposalPage({ searchParams }: {
  searchParams: Promise<{ reportId?: string | string[]; view?: string; page?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { reportId, view, page } = await searchParams;
  if (reportId === undefined) return <DigitalProposalPlayground />;
  if (!z.uuid().safeParse(reportId).success) notFound();

  const context = await proposalContext(reportId as string).catch((error: unknown) => {
    unstable_rethrow(error);
    if (error instanceof Error && ["STR appraisal not found", "Report not found", "Listing not found"].includes(error.message)) notFound();
    throw error;
  });
  const workspace = await loadProposalWorkspace(context);
  // Development-only, authenticated preview of current inputs without publishing or recording activity.
  if (view === "proposal") {
    const draft = applyAssignment(workspace.draft, context.assignment);
    return <MultiPageProposal fullViewport initialPage={page} draft={draft} brand={assignmentBrand(context.assignment)}
      data={withProposalPhotos(withProposalAgents(context.data, draft.agentIds, context.availableAgents), draft.propertyImages)} previewPdfDownload
      attachments={workspace.attachments.filter(item => draft.attachmentIds.includes(item.id)).map(item => ({ ...item, href: `/api/str/appraisals/${context.report.id}/proposal/attachments/${item.id}` }))} />;
  }
  return <DigitalProposalPlayground key={context.report.id} savedAppraisal={{ reportId: context.report.id, data: context.data, workspace }} />;
}
