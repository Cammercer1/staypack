import { z } from "zod";
import { comparablesByEstimate } from "./data";
import type { ProposalSnapshot } from "./workspace";
export const proposalEventSchema = z.object({
  id: z.uuid(), session: z.uuid(), kind: z.enum(["open", "page", "comparison", "comparable", "pdf", "document", "action", "agreement"]),
  versionId: z.uuid().optional(),
  target: z.string().min(1).max(100),
}).strict();
export type ProposalEvent = z.infer<typeof proposalEventSchema>;
export const activityLabels: Record<ProposalEvent["kind"], string> = {
  open: "Proposal opens", page: "Pages viewed", comparison: "Comparison tabs", comparable: "Comparable views",
  pdf: "Proposal PDF clicks", document: "Document clicks", action: "Link clicks", agreement: "Agreement clicks",
};
export function allowedProposalEvent(event: ProposalEvent, snapshot: ProposalSnapshot): boolean {
  switch (event.kind) {
    case "open": return event.target === "proposal";
    case "page": return snapshot.draft.pages.some(page => page.enabled && page.id === event.target);
    case "comparison": return ["annual", "monthly", "yield"].includes(event.target) && snapshot.draft.pages.some(page => page.enabled && page.kind === "comparison");
    case "comparable": return (snapshot.data.appraisal?.comparables ?? comparablesByEstimate(snapshot.data)).some((_, index) => String(index) === event.target) && snapshot.draft.pages.some(page => page.enabled && page.kind === "evidence");
    case "pdf": return event.target === "proposal";
    case "document": return snapshot.attachments.some(item => item.id === event.target);
    case "action": case "agreement": return snapshot.draft.links.some(link => link.id === event.target && (link.kind === "sign" ? "agreement" : "action") === event.kind);
  }
}
export function isAutomatedProposalRequest(userAgent: string) {
  return !userAgent || /bot|crawl|spider|preview|headless|playwright|lighthouse|facebookexternalhit|slack|whatsapp/i.test(userAgent);
}
export type ActivitySummary = { opens: number; sessions: number; lastOpened: string | null; items: { versionId: string; kind: ProposalEvent["kind"]; target: string; label: string; count: number; lastSeen: string }[] };
