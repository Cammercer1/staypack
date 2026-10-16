import { expect, it } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { applyAssignment, assignmentBrand, defaultAssignment } from "./assignment";
import { createProposalFixture } from "./fixtures";
import { proposalSnapshotSchema } from "./workspace";
import { resolveTokenText } from "./tokens";
import { proposalPrintHtml } from "./print";

const { agency } = createLintRegressionFixtures();

it.each(["str", "lease", "sales"] as const)("uses property and customer tokens in the default %s cover", kind => {
  const assignment = defaultAssignment(agency, kind);
  const draft = applyAssignment(null, assignment);
  const data = { ...createProposalFixture(), recipient: { displayName: "Jordan Taylor" } };
  expect(resolveTokenText(draft.content.title, data).text).toBe(data.property.address);
  expect(draft.content.introduction).toBe(kind === "str" ? "Short-term rental property appraisal" : kind === "lease" ? "Lease appraisal" : "Sales appraisal");
  expect(resolveTokenText(draft.content.recipientLine, data).text).toBe("Prepared for Jordan Taylor");
  expect(resolveTokenText(draft.content.recipientLine, { ...data, recipient: null }).text).toBe("");
});

it("refreshes the retired STR cover wording in new and editable drafts with saved account defaults", () => {
  const assignment = structuredClone(defaultAssignment(agency));
  assignment.defaults.content.introduction = "Short-term rental property report";
  const draft = structuredClone(assignment.defaults);
  for (const input of [null, draft]) {
    expect(applyAssignment(input, assignment).content.introduction).toBe("Short-term rental property appraisal");
  }
  expect(assignment.defaults.content.introduction).toBe("Short-term rental property report");
  expect(draft.content.introduction).toBe("Short-term rental property report");
  const snapshot = proposalSnapshotSchema.parse({ version: 1, data: createProposalFixture(), draft,
    brand: assignmentBrand(assignment), attachments: [] });
  expect(snapshot.draft.content.introduction).toBe("Short-term rental property report");
  expect(proposalPrintHtml(snapshot)).toContain("Short-term rental property report");
  expect(proposalPrintHtml(snapshot)).not.toContain("Short-term rental property appraisal");
});

it("enforces client cover copy while retaining draft page choices, contacts and resources", () => {
  const assignment = structuredClone(defaultAssignment(agency));
  assignment.defaults.content.title = "Client title for {{property.address}}";
  assignment.defaults.content.introduction = "Client proposal for {{recipient.displayName}}";
  const draft = structuredClone(assignment.defaults);
  draft.content.title = "User override";
  draft.content.introduction = "User subtitle";
  draft.pages.reverse();
  draft.pages[0].enabled = false;
  draft.agentIds = [crypto.randomUUID(), crypto.randomUUID()];
  draft.attachmentIds = [crypto.randomUUID()];
  draft.links = [{ id: crypto.randomUUID(), label: "Agency resources", kind: "link", url: "https://example.com" }];
  const original = structuredClone(draft);
  const result = applyAssignment(draft, assignment);
  expect(result.content).toEqual(assignment.defaults.content);
  for (const key of ["pages", "agentIds", "attachmentIds", "links"] as const) expect(result[key]).toEqual(original[key]);
  expect(draft).toEqual(original);
  result.content.title = "Changed result";
  expect(assignment.defaults.content.title).toBe("Client title for {{property.address}}");
});

it("leaves previously published cover wording intact when parsing frozen versions", () => {
  const assignment = defaultAssignment(agency);
  const draft = structuredClone(assignment.defaults);
  draft.content.title = "Previously published title";
  draft.content.introduction = "Previously published subtitle";
  const stored = { version: 1, data: createProposalFixture(), draft, brand: assignmentBrand(assignment), attachments: [] };
  const snapshot = proposalSnapshotSchema.parse(stored);
  expect(snapshot.draft.content).toEqual(draft.content);
  expect(applyAssignment(draft, assignment).content).toEqual(assignment.defaults.content);
  expect(snapshot.draft.content.title).toBe("Previously published title");
});
