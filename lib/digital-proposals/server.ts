import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { calculatorPropertyReviewRequired } from "@/lib/str-calculator/propertyReviewRequired";
import { z } from "zod";
import { requireAppraisalAccess } from "@/lib/appraisals/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAgencyAgentProfiles } from "@/lib/reports/loadReportAgent";
import { reportForProposal } from "./fromAppraisal";
import { proposalFromReport, proposalFromAppraisalReport } from "./data";
import { buildProposalPdfReport, withPdfAgents, withPdfPhotos } from "./pdfReport";
import { proposalAgentOptions, withProposalAgents } from "./agents";
import { resolveProposalBrand } from "./brand";
import { applyAssignment, assignmentSchema, defaultAssignment } from "./assignment";
import { validateProposalDraft, proposalDraftSchema } from "./template";
import { attachmentSchema, proposalSnapshotSchema, type ProposalWorkspace, type ProposalShareLink } from "./workspace";
import { preserveProposalImages } from "./imageStorage";
import { availableProposalPhotos, withProposalPhotos, type ProposalPhotoSelection } from "./photos";

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
  const pdfReport = buildProposalPdfReport(document, data.recipient?.displayName);
  const availableAgents = proposalAgentOptions(agencyAgents, context.agency.id);
  const availablePhotos = availableProposalPhotos(context.listing, data);
  const needsEvidenceReview = kind !== "str" && context.appraisal.document_revision !== context.appraisal.input_revision;
  const sourceFingerprint = createHash("sha256").update(JSON.stringify({ data, assignment, availableAgents, availablePhotos, pdfReport, ...(kind !== "str" ? { inputRevision: context.appraisal.input_revision, documentRevision: context.appraisal.document_revision } : {}) })).digest("hex");
  return { ...context, data, sourceFingerprint, assignment, availableAgents, availablePhotos, pdfReport, needsEvidenceReview };
}
type Context = Awaited<ReturnType<typeof proposalContext>>;
const STABLE_LINK_UPDATE_REQUIRED = "Stable link updates are not available yet. Ask your administrator to apply the proposal-link database update. Existing links still work.";
function missingStableLinkSchema(error: { code?: string } | null) {
  return Boolean(error && ["42703", "42P01", "PGRST200", "PGRST202", "PGRST204", "PGRST205"].includes(error.code ?? ""));
}
const storedLinkSchema = z.object({
  id: z.string(), token: z.string(), version_id: z.string(), created_at: z.string(), updated_at: z.string(), revoked_at: z.string().nullable(),
  is_primary: z.boolean(), published_revision: z.number().nullable(), published_source_fingerprint: z.string().nullable(),
  version: z.object({ id: z.string(), draft_revision: z.number(), created_at: z.string(), revoked_at: z.string().nullable(), share_token: z.string(),
    pdf_status: z.enum(["pending", "generating", "ready", "failed"]), source_fingerprint: z.string().nullable() }).nullable(),
});
function shareLinkSummary(link: { id: string; token: string; version_id: string; published_revision: number; published_source_fingerprint: string; created_at: string; updated_at: string; revoked_at: string | null }): ProposalShareLink {
  return { id: link.id, path: `/proposal/${link.token}`, versionId: link.version_id, draft_revision: link.published_revision,
    source_fingerprint: link.published_source_fingerprint, created_at: link.created_at, updated_at: link.updated_at, revoked_at: link.revoked_at };
}
export async function loadProposalWorkspace(context: Context): Promise<ProposalWorkspace> {
  const { supabase, report, agency } = context;
  const fields = "id,draft_revision,created_at,revoked_at,share_token,pdf_status,source_fingerprint";
  // Select the current-version FK, not the served-version history relationship.
  const [draft, attachments, versions, links] = await Promise.all([
    supabase.from("digital_proposal_drafts").select("draft_json,revision").eq("report_id", report.id).eq("agency_id", agency.id).maybeSingle(),
    supabase.from("digital_proposal_attachments").select("id,name,byte_size").eq("report_id", report.id).eq("agency_id", agency.id).order("created_at"),
    supabase.from("digital_proposal_versions").select(`${fields},digital_proposal_links!digital_proposal_links_agency_id_report_id_version_id_fkey(id,token,created_at,revoked_at)`).eq("report_id", report.id).eq("agency_id", agency.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("digital_proposal_links").select(`id,token,version_id,created_at,updated_at,revoked_at,is_primary,published_revision,published_source_fingerprint,version:digital_proposal_versions!digital_proposal_links_agency_id_report_id_version_id_fkey(${fields})`)
      .eq("report_id", report.id).eq("agency_id", agency.id).order("created_at", { ascending: false }),
  ]);
  for (const result of [draft, attachments, versions]) check(result.error);
  const migrated = !missingStableLinkSchema(links.error);
  if (migrated) check(links.error);
  // History includes prior targets of a stable link, which no longer appear in the direct version join.
  const history = migrated ? await supabase.from("digital_proposal_link_versions").select("link_id,version_id")
    .eq("report_id", report.id).eq("agency_id", agency.id) : { data: [], error: null };
  if (migrated) check(history.error);
  const orderedLinks = (migrated ? z.array(storedLinkSchema).parse(links.data ?? []) : []).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  const primary = orderedLinks.find(link => link.is_primary && !link.revoked_at) ?? orderedLinks.find(link => link.is_primary);
  const candidate = primary ?? orderedLinks.find(link => !link.revoked_at && !link.version?.revoked_at);
  const rows = [...(versions.data ?? [])];
  // A reused older snapshot can be outside the recent history window.
  if (candidate?.version && !rows.some(version => version.id === candidate.version_id)) {
    rows.push({ ...candidate.version, digital_proposal_links: [] });
  }
  const summaries = rows.map(({ share_token, digital_proposal_links: versionLinks, ...version }) => {
    const servedLinkIds = new Set((history.data ?? []).filter(item => item.version_id === version.id).map(item => item.link_id));
    const servedLinks = migrated ? orderedLinks.filter(link => servedLinkIds.has(link.id)) : versionLinks;
    const link = [...servedLinks].sort((a, b) => Number(Boolean(a.revoked_at)) - Number(Boolean(b.revoked_at)) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))[0];
    const token = link?.token ?? share_token;
    return { ...version, pdf_status: version.pdf_status as "pending" | "generating" | "ready" | "failed", link_id: link?.id,
      revoked_at: version.revoked_at ?? link?.revoked_at ?? null,
      path: `/proposal/${token}?version=${version.id}`, pdfPath: `/api/proposals/${token}/pdf?version=${version.id}` };
  });
  // Before adoption, the first visible publication must be the same URL publish will adopt.
  if (!primary && candidate) {
    const index = summaries.findIndex(version => version.id === candidate.version_id);
    if (index >= 0) {
      const [summary] = summaries.splice(index, 1);
      summaries.unshift({ ...summary, link_id: candidate.id, path: `/proposal/${candidate.token}?version=${summary.id}`,
        pdfPath: `/api/proposals/${candidate.token}/pdf?version=${summary.id}` });
    }
  }
  return {
    draft: draft.data ? proposalDraftSchema.parse(draft.data.draft_json) : null, revision: draft.data?.revision ?? 0,
    attachments: z.array(attachmentSchema).parse(attachments.data ?? []), versions: summaries,
    ...(migrated ? { shareLink: primary ? shareLinkSummary({ ...primary, published_revision: primary.published_revision!, published_source_fingerprint: primary.published_source_fingerprint! }) : null } : {}),
    sourceFingerprint: context.sourceFingerprint, assignment: context.assignment, data: context.data, availableAgents: context.availableAgents, availablePhotos: context.availablePhotos, needsEvidenceReview: context.needsEvidenceReview,
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
  checkSelectedPhotos(context, validated.draft.propertyImages);
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
function checkSelectedPhotos(context: Context, selection?: ProposalPhotoSelection) {
  if (!selection) return;
  if (new Set(selection.gallery).size !== selection.gallery.length) throw new ProposalError("Include each property photo once.");
  const available = new Set(context.availablePhotos);
  if ([selection.heroImageUrl, ...selection.gallery].some(url => !available.has(url))) {
    throw new ProposalError("A selected property photo is no longer available. Choose photos from this property’s library.");
  }
}
export async function publishProposal(context: Context, revision: number, sourceFingerprint: string) {
  if (calculatorPropertyReviewRequired(context.report, context.listing)) throw new ProposalError("Confirm the property details before publishing this proposal.", 409);
  if (context.appraisal?.client_review_required) throw new ProposalError("Confirm the client details before publishing this proposal.", 409);
  if (context.needsEvidenceReview) throw new ProposalError("Review the updated evidence and prepare your proposal before publishing.", 409);
  if (sourceFingerprint !== context.sourceFingerprint) throw new ProposalError("The appraisal changed. Reload the preview before publishing.", 409);
  const workspace = await loadProposalWorkspace(context);
  if (workspace.shareLink === undefined) throw new ProposalError(STABLE_LINK_UPDATE_REQUIRED, 503);
  if (!workspace.draft || workspace.revision !== revision) throw new ProposalError("Save the latest draft before publishing.", 409);
  const validation = validateProposalDraft(applyAssignment(workspace.draft, context.assignment), context.data);
  if (!validation.draft) throw new ProposalError(validation.errors.join(" "));
  if (context.appraisal.kind === "str" && (!context.report.final_estimate_json || !context.data.str.market.annualRevenue || context.data.str.market.annualRevenue <= 0)) throw new ProposalError("Review a rental estimate before publishing.");
  if (context.data.appraisal && (!(context.data.appraisal.midpoint && context.data.appraisal.midpoint > 0) || !context.data.appraisal.comparables.length)) throw new ProposalError("Review an estimate and comparable evidence before publishing.");
  const draft = applyAssignment(validation.draft, context.assignment);
  checkSelectedAgents(context, draft.agentIds);
  checkSelectedPhotos(context, draft.propertyImages);
  if (draft.pages.some(page => page.enabled && page.kind === "text" && !page.body.trim())) throw new ProposalError("Add content to each enabled text page before publishing.");
  if ((draft.links.length || draft.attachmentIds.length || draft.agentIds.length) && !draft.pages.some(page => page.enabled && page.kind === "next_steps")) throw new ProposalError("Include the Next steps page to share agents, documents and action links.");
  const data = withProposalPhotos(withProposalAgents(context.data, draft.agentIds, context.availableAgents), draft.propertyImages);
  const sourceSnapshot = proposalSnapshotSchema.parse({ version: 1, data, draft: { ...draft, pages: draft.pages.filter(page => page.enabled) },
    brand: resolveProposalBrand({ presetId: draft.presetId, template: draft.brandOverrides }).values,
    attachments: await selectedAttachments(context, draft.attachmentIds),
    assignment: { name: context.assignment.name, version: context.assignment.version },
    pdfReport: context.pdfReport ? withPdfPhotos(withPdfAgents(context.pdfReport, data.agents), draft.propertyImages) : undefined,
  });
  let snapshot: typeof sourceSnapshot;
  try { snapshot = await preserveProposalImages(sourceSnapshot, context.agency.id); }
  catch (error) {
    console.warn("Proposal image preservation failed", error instanceof Error ? error.message : "Storage request failed");
    // Do not publish a new link with images that still depend on an external host.
    throw new ProposalError("We couldn't save a permanent copy of every proposal image. Check that the photos and logos still load, then try publishing again. Your existing links are unchanged.", 503);
  }
  const result = await createAdminClient().rpc("publish_digital_proposal_v3", {
    p_agency_id: context.agency.id, p_report_id: context.report.id, p_revision: revision,
    p_snapshot: snapshot, p_token: randomBytes(32).toString("hex"),
    p_content_hash: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
    p_source_fingerprint: context.sourceFingerprint, p_assignment_version: context.assignment.version,
    p_report_updated: context.report.updated_at, p_listing_updated: context.listing.updated_at, p_appraisal_updated: context.appraisal.updated_at,
  });
  if (missingStableLinkSchema(result.error)) throw new ProposalError(STABLE_LINK_UPDATE_REQUIRED, 503);
  check(result.error);
  const { share_token, share_link, ...version } = result.data;
  const shareLink = shareLinkSummary({ ...share_link, published_revision: share_link.draft_revision, published_source_fingerprint: share_link.source_fingerprint });
  return { version: { ...version, path: `/proposal/${share_token}?version=${version.id}`, pdfPath: `/api/proposals/${share_token}/pdf?version=${version.id}` }, shareLink };
}
