import { describe, expect, it } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { applyAssignment, defaultAssignment } from "./assignment";
import { DEFAULT_PROPOSAL_DRAFT } from "./template";
import { proposalFromAppraisal } from "./fromAppraisal";
import { allowedProposalEvent, isAutomatedProposalRequest } from "./activity";
import { proposalSnapshotSchema } from "./workspace";
import { BRAND_DEFAULTS } from "./brand";
import { proposalPrintHtml } from "./print";
import { createProposalFixture } from "./fixtures";
const f = createLintRegressionFixtures();
const data = proposalFromAppraisal({ ...f, agencyAgents: [f.agent] });
const snapshot = proposalSnapshotSchema.parse({ version: 1, data, draft: DEFAULT_PROPOSAL_DRAFT, brand: BRAND_DEFAULTS, attachments: [] });
describe("integrated digital proposals", () => {
  it("keeps account design settings authoritative while preserving editable content", () => {
    const assignment = defaultAssignment(f.agency);
    const attempt = { ...DEFAULT_PROPOSAL_DRAFT, presetId: "studio" as const, brandOverrides: { primary: "#ff0000" }, heroLayout: "split" as const, content: { ...DEFAULT_PROPOSAL_DRAFT.content, introduction: "Prepared with care" } };
    const assigned = applyAssignment(attempt, assignment);
    expect(assigned.presetId).toBe(assignment.defaults.presetId);
    expect(assigned.heroLayout).toBe(assignment.defaults.heroLayout);
    expect(assigned.brandOverrides).toEqual(assignment.defaults.brandOverrides);
    expect(assigned.content.introduction).toBe("Prepared with care");
  });
  it("uses current editable inputs even when a legacy PDF report is published", () => {
    const published = { ...f.report, status: "published" as const, user_overrides_json: { ...f.report.user_overrides_json, strProperty: { propertyValue: 1234567, weeklyRent: 1234, amenities: [], additionalAmenities: [] } } };
    const editable = proposalFromAppraisal({ ...f, report: published, agencyAgents: [f.agent], editable: true });
    expect(editable.property.estimatedValue).toBe(1234567);
    expect(editable.ltr.weeklyRent).toBe(1234);
  });
  it("accepts only event targets belonging to the published snapshot", () => {
    const base = { id: crypto.randomUUID(), session: crypto.randomUUID() };
    expect(allowedProposalEvent({ ...base, kind: "page", target: "appraisal" }, snapshot)).toBe(true);
    expect(allowedProposalEvent({ ...base, kind: "page", target: "forecast" }, snapshot)).toBe(true);
    expect(allowedProposalEvent({ ...base, kind: "page", target: "service" }, snapshot)).toBe(false);
    expect(allowedProposalEvent({ ...base, kind: "document", target: crypto.randomUUID() }, snapshot)).toBe(false);
    expect(allowedProposalEvent({ ...base, kind: "comparison", target: "unknown" }, snapshot)).toBe(false);
    expect(isAutomatedProposalRequest("Slackbot 1.0")).toBe(true);
    expect(isAutomatedProposalRequest("Mozilla/5.0 Safari/605.1")).toBe(false);
  });
  it("renders frozen PDF figures, escapes copy and keeps the disclaimer last", () => {
    const copy = structuredClone(snapshot);
    copy.draft.pages.push({ id: "team", kind: "text", title: "Our team", body: '<script>alert("x")</script> {{agency.name}}', enabled: true });
    const html = proposalPrintHtml(copy);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain("{{agency.name}}");
    expect(html.lastIndexOf("<footer>")).toBeGreaterThan(html.lastIndexOf("Our team"));
    expect(html).toContain("Estimated annual gross revenue");
    expect(html).not.toContain("private-recipient");
  });
});

it("prints the forecast once, after appraisal, with occupancy dates and frozen estimates", () => {
  const copy = { ...snapshot, data: createProposalFixture() };
  const html = proposalPrintHtml(copy);
  const sections = html.split('<section class="page">');
  expect(sections[2]).toContain("Your rental income potential");
  expect(sections[2]).not.toContain("Monthly revenue estimates");
  expect(sections[3]).toContain("Yearly forecast");
  expect(sections[3]).toContain("Monthly revenue estimates");
  expect(sections[3]).toContain("Historical market occupancy");
  expect(sections[3]).toContain("Jan 2025");
  expect(sections[3]).toContain("83%");
  expect(html.match(/Monthly revenue estimates/g)).toHaveLength(1);
});
