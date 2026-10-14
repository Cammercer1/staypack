import { expect, it } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { applyAssignment, defaultAssignment } from "./assignment";
import { proposalAgentOptions, withProposalAgents } from "./agents";
import { proposalFromAppraisal } from "./fromAppraisal";
import { DEFAULT_PROPOSAL_DRAFT, proposalDraftSchema } from "./template";
import { resolveTokenText } from "./tokens";
import { proposalPrintHtml } from "./print";
import { BRAND_DEFAULTS } from "./brand";
const f = createLintRegressionFixtures();

it("uses account page definitions while preserving selection and order", () => {
  const assignment = defaultAssignment(f.agency);
  assignment.defaults = structuredClone(assignment.defaults);
  assignment.defaults.content.comparisonTitle = "Brand appraisal heading";
  assignment.defaults.pages.push({ id: "brand-team", kind: "text", title: "Our people", body: "Brand-owned content", enabled: true });
  const draft = structuredClone(DEFAULT_PROPOSAL_DRAFT);
  draft.pages.reverse();
  draft.pages[0].title = "Changed title";
  draft.pages[0].body = "Changed text";
  draft.pages[0].enabled = false;
  draft.pages.push({ id: "unassigned", kind: "text", title: "New custom page", body: "Not assigned", enabled: true });
  draft.content.introduction = "My introduction";
  draft.content.comparisonTitle = "Changed heading";
  const result = applyAssignment(draft, assignment);
  expect(result.pages[0]).toMatchObject({ id: "next-steps", title: "Next steps", body: "", enabled: false });
  expect(result.pages.some(page => page.id === "unassigned")).toBe(false);
  expect(result.pages.find(page => page.id === "brand-team")).toMatchObject({ id: "brand-team", body: "Brand-owned content" });
  expect(result.content.comparisonTitle).toBe("Brand appraisal heading");
  expect(result.content.introduction).toBe("My introduction");
});

it("resolves only selected active account agents and freezes public contact fields", () => {
  const second = { ...f.agent, id: crypto.randomUUID(), name: "Taylor Agent", email: "taylor@example.com" };
  const roster = proposalAgentOptions([f.agent, second, { ...f.agent, id: crypto.randomUUID(), archived_at: "2026-01-01" }, { ...f.agent, agency_id: "other" }], f.agency.id);
  expect(roster).toHaveLength(2);
  const source = proposalFromAppraisal({ ...f, agencyAgents: [f.agent] });
  const data = withProposalAgents(source, [second.id, f.agent.id], roster);
  expect(data.agents.map(agent => agent.name)).toEqual(["Taylor Agent", f.agent.name]);
  expect(resolveTokenText("{{agent.name}}", data).text).toBe("Taylor Agent");
  second.name = "Changed later";
  expect(data.agents[0].name).toBe("Taylor Agent");
  expect(withProposalAgents(source, [], roster).agent.name).toBe("");
  expect(withProposalAgents(source, [crypto.randomUUID()], roster).agents).toEqual([]);
  const html = proposalPrintHtml({ version: 1, data, draft: DEFAULT_PROPOSAL_DRAFT, brand: BRAND_DEFAULTS, attachments: [] });
  expect(html).toContain("Your contacts"); expect(html).toContain("taylor@example.com");
});

it("keeps old drafts readable and rejects duplicate or excessive agent selections", () => {
  const old = { ...DEFAULT_PROPOSAL_DRAFT, agentIds: undefined };
  expect(proposalDraftSchema.parse(old).agentIds).toEqual([]);
  const id = crypto.randomUUID();
  expect(proposalDraftSchema.safeParse({ ...old, agentIds: [id, id] }).success).toBe(false);
  expect(proposalDraftSchema.safeParse({ ...old, agentIds: [id, crypto.randomUUID(), crypto.randomUUID()] }).success).toBe(false);
});

it("adds the standard forecast after appraisal in existing drafts without changing published definitions", () => {
  const legacy = structuredClone(DEFAULT_PROPOSAL_DRAFT);
  legacy.pages = legacy.pages.filter(page => page.kind !== "forecast");
  const result = applyAssignment(legacy, defaultAssignment(f.agency));
  expect(result.pages.map(page => page.id)).toEqual(["property", "appraisal", "forecast", "evidence", "service", "next-steps"]);
  expect(legacy.pages.some(page => page.kind === "forecast")).toBe(false);
  expect(proposalDraftSchema.parse(legacy).pages).toEqual(legacy.pages);
  // Brand-owned definitions may omit a page, and disabled forecasts stay disabled.
  const assignment = defaultAssignment(f.agency);
  assignment.defaults = { ...assignment.defaults, pages: legacy.pages };
  expect(applyAssignment(DEFAULT_PROPOSAL_DRAFT, assignment).pages.some(page => page.kind === "forecast")).toBe(false);
  const disabled = structuredClone(result); disabled.pages.find(page => page.kind === "forecast")!.enabled = false;
  expect(applyAssignment(disabled, defaultAssignment(f.agency)).pages.find(page => page.kind === "forecast")!.enabled).toBe(false);
});
