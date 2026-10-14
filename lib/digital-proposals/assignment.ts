import type { WorkspaceAppraisalKind } from "@/lib/appraisals/workspaceTypes";
import { z } from "zod";
import { brandFromReport, resolveProposalBrand } from "./brand";
import { DEFAULT_PROPOSAL_DRAFT, proposalDraftSchema, refreshProposalDraftDefaults, type ProposalDraft } from "./template";
import type { Agency, FinalReportJson } from "@/lib/types";

/** Onboarding-owned configuration. Appraisal users edit content, never renderer/brand settings. */
export const assignmentSchema = z.object({
  name: z.string().min(1).max(120), version: z.number().int().positive(),
  defaults: proposalDraftSchema,
});
export type ProposalAssignment = z.infer<typeof assignmentSchema>;
export function defaultAssignment(agency: Agency, kind: WorkspaceAppraisalKind = "str"): ProposalAssignment {
  if (kind !== "str") return { name: `${agency.name} ${kind === "lease" ? "rental" : "sales"} proposal`, version: 1, defaults: {
    ...DEFAULT_PROPOSAL_DRAFT, templateId: "appraisal-base", heroLayout: "overlay",
    brandOverrides: brandFromReport(agency as unknown as FinalReportJson["agency"]),
    content: { ...DEFAULT_PROPOSAL_DRAFT.content, introduction: kind === "lease" ? "Rental appraisal" : "Sales appraisal", comparisonTitle: kind === "lease" ? "Your rental appraisal" : "Your sales appraisal" },
    pages: [
      { id: "property", kind: "hero", title: "Your property", body: "", enabled: true },
      { id: "appraisal", kind: "comparison", title: kind === "lease" ? "Rental appraisal" : "Sales appraisal", body: "", enabled: true },
      { id: "evidence", kind: "evidence", title: kind === "lease" ? "Comparable rentals" : "Comparable properties", body: "", enabled: true },
      { id: "service", kind: "text", title: kind === "lease" ? "Our property management service" : "Our sales approach", body: "", enabled: false },
      { id: "next-steps", kind: "next_steps", title: "Next steps", body: "", enabled: true },
    ],
  } };
  return { name: `${agency.name} proposal`, version: 1, defaults: {
    ...DEFAULT_PROPOSAL_DRAFT, brandOverrides: brandFromReport(agency as unknown as FinalReportJson["agency"]),
  } };
}
export function applyAssignment(draft: ProposalDraft | null, assignment: ProposalAssignment): ProposalDraft {
  const base = assignment.defaults;
  if (!draft) return structuredClone(base);
  const configured = new Map(base.pages.map(page => [page.id, page]));
  const pages = draft.pages.flatMap(page => {
    const definition = configured.get(page.id);
    // A newly configured service replaces the unavailable blank placeholder. Later user choices remain intact.
    const enabled = page.kind === "text" && !page.body.trim() && definition?.kind === "service" ? definition.enabled : page.enabled;
    return definition ? [{ ...definition, enabled: enabled && (definition.kind !== "text" || Boolean(definition.body.trim())) }] : [];
  });
  for (const [index, page] of base.pages.entries()) {
    if (pages.some(item => item.id === page.id)) continue;
    // Insert newly configured pages beside their predecessor, preserving the user's existing order.
    const previous = base.pages[index - 1];
    const position = previous ? pages.findIndex(item => item.id === previous.id) + 1 : 0;
    pages.splice(position, 0, { ...page });
  }
  return { ...refreshProposalDraftDefaults(draft), templateId: base.templateId, templateVersion: base.templateVersion,
    pages, content: { ...draft.content, comparisonTitle: base.content.comparisonTitle, recipientLine: base.content.recipientLine },
    presetId: base.presetId, brandOverrides: base.brandOverrides, heroLayout: base.heroLayout,
    motion: base.motion, presentation: base.presentation, initialComparisonMode: base.initialComparisonMode };
}
export function assignmentBrand(assignment: ProposalAssignment) {
  return resolveProposalBrand({ presetId: assignment.defaults.presetId, template: assignment.defaults.brandOverrides }).values;
}
