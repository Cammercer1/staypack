import { expect, it } from "vitest";
import havenly from "./assignments/havenly.json";
import { applyAssignment, assignmentBrand, assignmentSchema } from "./assignment";
import { DEFAULT_PROPOSAL_DRAFT, proposalDraftSchema, validateProposalDraft } from "./template";
import { createProposalFixture } from "./fixtures";
import { proposalSnapshotSchema } from "./workspace";
import { proposalPrintHtml } from "./print";
import { allowedProposalEvent } from "./activity";

it("upgrades an unavailable service placeholder while preserving later page choices and assigned cover copy", () => {
  const assignment = assignmentSchema.parse(havenly);
  const legacy = structuredClone(DEFAULT_PROPOSAL_DRAFT);
  legacy.content.introduction = "Prepared especially for you";
  legacy.agentIds = [crypto.randomUUID()];
  const updated = applyAssignment(legacy, assignment);
  expect(updated.pages.filter(page => page.enabled).map(page => page.id)).toEqual(["property", "appraisal", "forecast", "evidence", "service", "next-steps"]);
  expect(updated.content.introduction).toBe(assignment.defaults.content.introduction);
  expect(updated.agentIds).toEqual(legacy.agentIds);
  expect(legacy.pages.find(page => page.id === "service")).toMatchObject({ kind: "text", enabled: false, body: "" });
  updated.pages.find(page => page.id === "service")!.enabled = false;
  expect(applyAssignment(updated, assignment).pages.find(page => page.id === "service")!.enabled).toBe(false);
});

it("freezes service copy for publication, includes it in PDF output and recognises page views", () => {
  const assignment = assignmentSchema.parse(havenly);
  const snapshot = proposalSnapshotSchema.parse({ version: 1, data: createProposalFixture(), draft: assignment.defaults,
    brand: assignmentBrand(assignment), attachments: [] });
  assignment.defaults.pages.find(page => page.kind === "service")!.service!.headline = "Changed after publishing";
  const printed = proposalPrintHtml(snapshot);
  expect(printed).toContain("Great stays.\nThoughtfully managed.");
  expect(printed).toContain("15+ years");
  expect(printed).toContain("Bookings, turnovers, cleaning and maintenance");
  expect(printed).not.toContain("Changed after publishing");
  expect(allowedProposalEvent({ id: crypto.randomUUID(), session: crypto.randomUUID(), kind: "page", target: "service" }, snapshot)).toBe(true);
  expect(proposalDraftSchema.parse(DEFAULT_PROPOSAL_DRAFT)).toEqual(DEFAULT_PROPOSAL_DRAFT);
});

it("requires configured service content and validates its data tokens", () => {
  const draft = assignmentSchema.parse(havenly).defaults;
  const page = draft.pages.find(page => page.kind === "service")!;
  const service = page.service!;
  page.service = undefined;
  expect(proposalDraftSchema.safeParse(draft).success).toBe(false);
  page.service = service;
  service.introduction = "For {{property.address}}";
  expect(validateProposalDraft(draft, createProposalFixture()).errors).toEqual([]);
  service.proof!.body = "{{private.customerEmail}}";
  expect(validateProposalDraft(draft, createProposalFixture()).errors.join(" ")).toContain("unknown token");
});
