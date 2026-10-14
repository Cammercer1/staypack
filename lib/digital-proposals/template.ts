import { z } from "zod";
import { isSafeProposalUrl } from "./links";
import { brandOverridesSchema, type BrandField } from "./brand";
import type { ProposalData } from "./data";
import { resolveTokenText } from "./tokens";
import { MAX_LISTING_AGENTS } from "@/lib/reports/constants";
import { proposalServiceSchema, serviceTokenTexts } from "./service";

export const proposalPageSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,60}$/),
  kind: z.enum(["hero", "comparison", "forecast", "evidence", "text", "service", "next_steps"]),
  title: z.string().trim().min(1).max(100), body: z.string().max(12000), enabled: z.boolean(),
  service: proposalServiceSchema.optional(),
}).strict().superRefine((page, ctx) => {
  if (page.kind === "service" && !page.service) ctx.addIssue({ code: "custom", path: ["service"], message: "Configure the management service page." });
});
export type ProposalPage = z.infer<typeof proposalPageSchema>;
export const DEFAULT_PROPOSAL_PAGES: ProposalPage[] = [
  { id: "property", kind: "hero", title: "Your property", body: "", enabled: true },
  { id: "appraisal", kind: "comparison", title: "Rental appraisal", body: "", enabled: true },
  { id: "forecast", kind: "forecast", title: "Yearly forecast", body: "", enabled: true },
  { id: "evidence", kind: "evidence", title: "Comparable listings", body: "", enabled: true },
  { id: "service", kind: "text", title: "Our management service", body: "", enabled: false },
  { id: "next-steps", kind: "next_steps", title: "Next steps", body: "", enabled: true },
];
export const proposalLinkSchema = z.object({
  id: z.uuid(), label: z.string().trim().min(1).max(100), kind: z.enum(["link", "sign"]),
  url: z.string().trim().url().max(2048).refine(isSafeProposalUrl, "Use an HTTPS link without embedded credentials."),
}).strict();

export const proposalDraftSchema = z.object({
  version: z.literal(1), templateId: z.enum(["editorial-base", "property-providers", "agency-proposal", "appraisal-base"]), templateVersion: z.literal(1),
  presetId: z.enum(["staypack", "coastal", "studio"]),
  brandOverrides: brandOverridesSchema,
  content: z.object({
    title: z.string().trim().min(1).max(240),
    introduction: z.string().max(1200),
    recipientLine: z.string().max(160),
    comparisonTitle: z.string().trim().min(1).max(180),
  }).strict(),
  heroLayout: z.enum(["overlay", "split", "panorama"]),
  initialComparisonMode: z.enum(["annual", "monthly", "yield"]),
  motion: z.boolean(),
  presentation: z.object({
    tagline: z.string().trim().max(100),
    coverCaption: z.string().trim().max(160),
  }).strict().optional(),
  pages: z.array(proposalPageSchema).min(1).max(12).default(DEFAULT_PROPOSAL_PAGES),
  links: z.array(proposalLinkSchema).max(12).default([]),
  attachmentIds: z.array(z.uuid()).max(20).default([]),
  agentIds: z.array(z.uuid()).max(MAX_LISTING_AGENTS).default([]),
}).strict().superRefine((draft, ctx) => {
  if (new Set(draft.agentIds).size !== draft.agentIds.length) ctx.addIssue({ code: "custom", path: ["agentIds"], message: "Include each agent once." });
  if (new Set(draft.attachmentIds).size !== draft.attachmentIds.length) ctx.addIssue({ code: "custom", path: ["attachmentIds"], message: "Include each document once." });
  for (const key of ["pages", "links"] as const) {
    if (new Set(draft[key].map(item => item.id)).size !== draft[key].length) ctx.addIssue({ code: "custom", path: [key], message: "Each item must have a unique ID." });
  }
  if (!draft.pages.some(page => page.enabled)) ctx.addIssue({ code: "custom", path: ["pages"], message: "Include at least one page." });
});
export type ProposalDraft = z.infer<typeof proposalDraftSchema>;

/** Refresh retired default copy when opening an editable draft; never mutate published snapshots. */
export function refreshProposalDraftDefaults(draft: ProposalDraft): ProposalDraft {
  return { ...draft,
    content: { ...draft.content, comparisonTitle: draft.content.comparisonTitle === "Three ways to see the potential."
      ? "Your rental income potential" : draft.content.comparisonTitle },
    pages: draft.pages.map(page => page.kind === "evidence" && page.title === "Supporting evidence"
    ? { ...page, title: "Comparable listings" } : page) };
}

export const DEFAULT_PROPOSAL_DRAFT: ProposalDraft = {
  version: 1, templateId: "editorial-base", templateVersion: 1, presetId: "staypack", brandOverrides: {},
  content: {
    title: "{{property.address}}",
    introduction: "Short-term rental proposal",
    recipientLine: "prepared for {{recipient.displayName}}",
    comparisonTitle: "Your rental income potential",
  },
  heroLayout: "overlay", initialComparisonMode: "annual", motion: true,
  pages: DEFAULT_PROPOSAL_PAGES, links: [], attachmentIds: [], agentIds: [],
};

/** Code-owned contract: bespoke renderers consume the same data/brand/content props. */
export const BASE_DIGITAL_TEMPLATE = {
  id: "editorial-base", version: 1, label: "Editorial base",
  sections: ["hero", "comparison"] as const,
  lockedBrandFields: [] as readonly BrandField[],
  appraisalEditableBrandFields: [] as readonly BrandField[],
};
export function validateProposalDraft(input: unknown, data: ProposalData) {
  const parsed = proposalDraftSchema.safeParse(input);
  if (!parsed.success) return { draft: null, errors: parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`) };
  const errors: string[] = [];
  if (data.appraisal && parsed.data.templateId !== "appraisal-base") errors.push("Choose a rental or sales proposal design for this appraisal.");
  if (data.appraisal && parsed.data.pages.some(page => page.enabled && page.kind === "forecast")) errors.push("Forecast pages are available for short-term rental proposals only.");
  errors.push(...Object.entries(parsed.data.content).flatMap(([field, text]) =>
    resolveTokenText(text, data).unknown.map(key => `${field}: unknown token “${key}”`)));
  for (const page of parsed.data.pages) {
    for (const text of [page.title, page.body, ...(page.service ? serviceTokenTexts(page.service) : [])]) errors.push(...resolveTokenText(text, data).unknown.map(key => `${page.title}: unknown token “${key}”`));
  }
  return { draft: errors.length ? null : parsed.data, errors };
}
