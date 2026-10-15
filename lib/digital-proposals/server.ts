import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { calculatorPropertyReviewRequired } from "@/lib/str-calculator/propertyReviewRequired";
import { z } from "zod";
import { requireAppraisalAccess } from "@/lib/appraisals/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAgencyAgentProfiles } from "@/lib/reports/loadReportAgent";
import { reportForProposal } from "./fromAppraisal";
import { proposalFromReport, proposalFromAppraisalReport } from "./data";
import { buildProposalPdfReport, withPdfAgents } from "./pdfReport";
import { proposalAgentOptions, withProposalAgents } from "./agents";
import { resolveProposalBrand } from "./brand";
import { applyAssignment, assignmentSchema, defaultAssignment } from "./assignment";
import { validateProposalDraft, proposalDraftSchema } from "./template";
import { attachmentSchema, proposalSnapshotSchema, type ProposalWorkspace } from "./workspace";

import { ProposalError } from "./errors";
export { ProposalError } from "./errors";
export { publishedProposal } from "./published";

function check(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.code === "PT409") throw new ProposalError(error.message, 409);
  if (error.code === "PT404") throw new ProposalError("Active appraisal not found.", 404);
  console.error("Proposal database operation failed", error.code);
  throw new ProposalError("Unable to save the proposal. Please try again.", 500);
}
export async function requireProposalAppraisalAccess(reportId: string, request?: Request) {
  const context = await requireAppraisalAccess(reportId);
  if (!request?.url || !new URL(request.url).pathname.startsWith("/api/appraisals/")) {
    if (context.appraisal.kind !== "str") throw new ProposalError("STR appraisal not found.", 404);
  }
  return context;
}
export async function proposalContext(reportId: string, request?: Request) {
  if (!z.uuid().safeParse(reportId).success) throw new ProposalError("Appraisal not found.", 404);
  const context = await requireProposalAppraisalAccess(reportId, request);
  if (context.report.status === "archived" || context.listing.status === "archived") throw new ProposalError("Restore this appraisal before editing its proposal.", 409);
  const agencyAgents = await loadAgencyAgentProfiles(context.supabase, context.agency.id);
  const assigned = await context.supabase.from("digital_proposal_assignments").select("name,version,defaults").eq("agency_id", context.agency.id).eq("kind", context.appraisal.kind).maybeSingle();
  check(assigned.error);
  const assignment = assigned.data ? assignmentSchema.parse(assigned.data) : defaultAssignment(context.agency, context.appraisal.kind);
  const kind = context.appraisal.kind;
  if (kind !== "str" && !context.appraisal.document_json) throw new ProposalError("Review the evidence and prepare this proposal before continuing.", 409);
  const document = kind === "str" ? reportForProposal({ ...context, agencyAgents, editable: true }) : context.appraisal.document_json!;
  const recipient = context.appraisal.recipient_mode === "named" ? context.appraisal.recipient_name : null;
  const data = kind === "str" ? proposalFromReport(document, recipient) : proposalFromAppraisalReport(document, kind, recipient);
  const pdfReport = buildProposalPdfReport(document);
  const availableAgents = proposalAgentOptions(agencyAgents, context.agency.id);
  const needsEvidenceReview = kind !== "str" && context.appraisal.document_revision !== context.appraisal.input_revision;
  const sourceFingerprint = createHash("sha256").update(JSON.stringify({ data, assignment, availableAgents, pdfReport, ...(kind !== "str" ? { inputRevision: context.appraisal.input_revision, documentRevision: context.appraisal.document_revision } : {}) })).digest("hex");
  return { ...context, data, sourceFingerprint, assignment, availableAgents, pdfReport, needsEvidenceReview };
}
type Context = Awaited<ReturnType<typeof proposalContext>>;
export async function loadProposalWorkspace(context: Context): Promise<ProposalWorkspace> {
  const { supabase, report, agency } = context;
  const [draft, attachments, versions] = await Promise.all([
    supabase.from("digital_proposal_drafts").select("draft_json,revision").eq("report_id", report.id).eq("agency_id", agency.id).maybeSingle(),
    supabase.from("digital_proposal_attachments").select("id,name,byte_size").eq("report_id", report.id).eq("agency_id", agency.id).order("created_at"),
    supabase.from("digital_proposal_versions").select("id,draft_revision,created_at,revoked_at,share_token,pdf_status,source_fingerprint,digital_proposal_links(id,token,created_at,revoked_at)").eq("report_id", report.id).eq("agency_id", agency.id).order("created_at", { ascending: false }).limit(20),
  ]);
  for (const result of [draft, attachments, versions]) check(result.error);
  return {
    draft: draft.data ? proposalDraftSchema.parse(draft.data.draft_json) : null, revision: draft.data?.revision ?? 0,
    attachments: z.array(attachmentSchema).parse(attachments.data ?? []),
    versions: (versions.data ?? []).map(({ share_token, digital_proposal_links: links, ...version }) => {
      const link = [...links].sort((a, b) => Number(Boolean(a.revoked_at)) - Number(Boolean(b.revoked_at)) || b.created_at.localeCompare(a.created_at))[0];
      return { ...version, pdf_status: version.pdf_status as "pending" | "generating" | "ready" | "failed", link_id: link?.id,
        revoked_at: version.revoked_at ?? link?.revoked_at ?? null, path: `/proposal/${link?.token ?? share_token}` };
    }),
    sourceFingerprint: context.sourceFingerprint, assignment: context.assignment, data: context.data, availableAgents: context.availableAgents, needsEvidenceReview: context.needsEvidenceReview,
  };
}
async function selectedAttachments(context: Context, ids: string[]) {
  if (!ids.length) return [];
  const result = await context.supabase.from("digital_proposal_attachments").select("id,name,byte_size")
    .eq("report_id", context.report.id).eq("agency_id", context.agency.id).in("id", ids);
  check(result.error);
  if (result.data?.length !== new Set(ids).size) throw new ProposalError("One or more attachments are unavailable.");
  return ids.map(id => attachmentSchema.parse(result.data!.find(item => item.id === id)));
}
export async function saveProposal(context: Context, input: unknown, revision: number, studio = false) {
  const parsed = proposalDraftSchema.parse(input);
  checkSelectedAgents(context, parsed.agentIds);
  const validated = validateProposalDraft(studio ? parsed : applyAssignment(parsed, context.assignment), context.data);
  if (!validated.draft) throw new ProposalError(validated.errors.join(" "));
  await selectedAttachments(context, validated.draft.attachmentIds);
  const result = await createAdminClient().rpc("save_digital_proposal", {
    p_agency_id: context.agency.id, p_report_id: context.report.id, p_revision: revision, p_draft: validated.draft,
  });
  check(result.error);
  return { draft: proposalDraftSchema.parse(result.data.draft_json), revision: result.data.revision as number };
}
function checkSelectedAgents(context: Context, ids: string[]) {
  if (ids.some(id => !context.availableAgents.some(agent => agent.id === id))) throw new ProposalError("A selected agent is no longer available. Choose an active agent from your account.");
}
export async function publishProposal(context: Context, revision: number, sourceFingerprint: string) {
  if (calculatorPropertyReviewRequired(context.report, context.listing)) throw new ProposalError("Confirm the property details before publishing this proposal.", 409);
  if (context.needsEvidenceReview) throw new ProposalError("Review the updated evidence and prepare your proposal before publishing.", 409);
  if (sourceFingerprint !== context.sourceFingerprint) throw new ProposalError("The appraisal changed. Reload the preview before publishing.", 409);
  const workspace = await loadProposalWorkspace(context);
  if (!workspace.draft || workspace.revision !== revision) throw new ProposalError("Save the latest draft before publishing.", 409);
  const validation = validateProposalDraft(applyAssignment(workspace.draft, context.assignment), context.data);
  if (!validation.draft) throw new ProposalError(validation.errors.join(" "));
  if (context.appraisal.kind === "str" && (!context.report.final_estimate_json || !context.data.str.market.annualRevenue || context.data.str.market.annualRevenue <= 0)) throw new ProposalError("Review a rental estimate before publishing.");
  if (context.data.appraisal && (!(context.data.appraisal.midpoint && context.data.appraisal.midpoint > 0) || !context.data.appraisal.comparables.length)) throw new ProposalError("Review an estimate and comparable evidence before publishing.");
  const draft = applyAssignment(validation.draft, context.assignment);
  checkSelectedAgents(context, draft.agentIds);
  if (draft.pages.some(page => page.enabled && page.kind === "text" && !page.body.trim())) throw new ProposalError("Add content to each enabled text page before publishing.");
  if ((draft.links.length || draft.attachmentIds.length || draft.agentIds.length) && !draft.pages.some(page => page.enabled && page.kind === "next_steps")) throw new ProposalError("Include the Next steps page to share agents, documents and action links.");
  const data = withProposalAgents(context.data, draft.agentIds, context.availableAgents);
  const snapshot = proposalSnapshotSchema.parse({ version: 1, data, draft: { ...draft, pages: draft.pages.filter(page => page.enabled) },
    brand: resolveProposalBrand({ presetId: draft.presetId, template: draft.brandOverrides }).values,
    attachments: await selectedAttachments(context, draft.attachmentIds),
    assignment: { name: context.assignment.name, version: context.assignment.version },
    pdfReport: context.pdfReport ? withPdfAgents(context.pdfReport, data.agents) : undefined,
  });
  const result = await createAdminClient().rpc("publish_digital_proposal_v2", {
    p_agency_id: context.agency.id, p_report_id: context.report.id, p_revision: revision,
    p_snapshot: snapshot, p_token: randomBytes(32).toString("hex"),
    p_content_hash: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
    p_source_fingerprint: context.sourceFingerprint, p_assignment_version: context.assignment.version,
    p_report_updated: context.report.updated_at, p_listing_updated: context.listing.updated_at, p_appraisal_updated: context.appraisal.updated_at,
  });
  check(result.error);
  const { share_token, ...version } = result.data;
  return { ...version, path: `/proposal/${share_token}` };
}
