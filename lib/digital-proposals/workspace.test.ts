import { describe, expect, it } from "vitest";
import { createProposalFixture } from "./fixtures";
import { DEFAULT_PROPOSAL_DRAFT, proposalDraftSchema, proposalLinkSchema, refreshProposalDraftDefaults, validateProposalDraft } from "./template";
import { isPdf, safeDocumentName, shareTokenSchema } from "./workspace";
import { requestOriginAllowed } from "./requestOrigin";

describe("proposal pages and documents", () => {
  it("refreshes retired default headings only in editable drafts, preserving custom titles and snapshots", () => {
    const legacy = structuredClone(DEFAULT_PROPOSAL_DRAFT);
    legacy.pages[3].title = "Supporting evidence";
    legacy.content.comparisonTitle = "Three ways to see the potential.";
    expect(refreshProposalDraftDefaults(legacy).pages[3].title).toBe("Comparable listings");
    expect(refreshProposalDraftDefaults(legacy).content.comparisonTitle).toBe("Your rental income potential");
    expect(proposalDraftSchema.parse(legacy).pages[3].title).toBe("Supporting evidence");
    expect(proposalDraftSchema.parse(legacy).content.comparisonTitle).toBe("Three ways to see the potential.");
    legacy.pages[3].title = "Selected properties for {{recipient.displayName}}";
    legacy.content.comparisonTitle = "Rental estimates for {{recipient.displayName}}";
    expect(refreshProposalDraftDefaults(legacy)).toEqual(legacy);
  });
  it("accepts the browser-facing host behind a proxy but rejects foreign origins", () => {
    const request = (headers: Record<string, string>) => new Request("http://0.0.0.0:3000/api/proposal", { headers });
    expect(requestOriginAllowed(request({ host: "localhost:3000", origin: "http://localhost:3000" }))).toBe(true);
    expect(requestOriginAllowed(request({ host: "staypack.app", origin: "https://staypack.app", "x-forwarded-proto": "https" }))).toBe(true);
    for (const origin of ["https://evil.test", "null", "http://localhost:3000.evil.test", "http://localhost:3000/anything"]) expect(requestOriginAllowed(request({ host: "localhost:3000", origin }))).toBe(false);
    expect(requestOriginAllowed(request({ host: "localhost:3000", origin: "http://localhost:3000", "sec-fetch-site": "cross-site" }))).toBe(false);
  });
  it("upgrades saved single-page templates without losing their content", () => {
    const legacy = { ...DEFAULT_PROPOSAL_DRAFT, pages: undefined, links: undefined, attachmentIds: undefined };
    const parsed = proposalDraftSchema.parse(legacy);
    expect(parsed.content).toEqual(legacy.content);
    expect(parsed.pages.filter(page => page.enabled).map(page => page.kind)).toEqual(["hero", "comparison", "forecast", "evidence", "next_steps"]);
    expect(parsed.links).toEqual([]);
  });
  it("rejects ambiguous page IDs, duplicate documents and empty navigation", () => {
    expect(proposalDraftSchema.safeParse({ ...DEFAULT_PROPOSAL_DRAFT, pages: [DEFAULT_PROPOSAL_DRAFT.pages[0], DEFAULT_PROPOSAL_DRAFT.pages[0]] }).success).toBe(false);
    expect(proposalDraftSchema.safeParse({ ...DEFAULT_PROPOSAL_DRAFT, pages: DEFAULT_PROPOSAL_DRAFT.pages.map(page => ({ ...page, enabled: false })) }).success).toBe(false);
    expect(proposalDraftSchema.safeParse({ ...DEFAULT_PROPOSAL_DRAFT, attachmentIds: ["10000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000001"] }).success).toBe(false);
  });
  it("validates tokens on custom pages as well as the cover", () => {
    const draft = structuredClone(DEFAULT_PROPOSAL_DRAFT);
    draft.pages[4].body = "{{recipient.email}}";
    expect(validateProposalDraft(draft, createProposalFixture()).errors).toContain("Our management service: unknown token “recipient.email”");
    draft.pages[4].body = "Our team at {{agency.name}} will care for {{property.address}}.";
    expect(validateProposalDraft(draft, createProposalFixture()).errors).toEqual([]);
  });
  it("accepts only complete HTTPS actions without throwing while typing", () => {
    const link = { id: "10000000-0000-4000-8000-000000000001", kind: "sign", label: "Review & sign" };
    for (const url of ["", "https://", "bad URL", "javascript:alert(1)", "http://example.com", "https://user:password@example.com"]) expect(proposalLinkSchema.safeParse({ ...link, url }).success).toBe(false);
    expect(proposalLinkSchema.parse({ ...link, url: "https://example.com/sign?envelope=123" }).url).toBe("https://example.com/sign?envelope=123");
  });
  it("checks PDF signatures, sanitises filenames and limits share token syntax", () => {
    expect(isPdf(new TextEncoder().encode("%PDF-1.7\n"))).toBe(true);
    expect(isPdf(new TextEncoder().encode("<html>Fake.pdf</html>"))).toBe(false);
    expect(safeDocumentName("../Folder\\Agreement\n.pdf")).toBe("..FolderAgreement.pdf");
    expect(safeDocumentName("\n")).toBe("Document.pdf");
    expect(shareTokenSchema.safeParse("a".repeat(64)).success).toBe(true);
    expect(shareTokenSchema.safeParse("../../private").success).toBe(false);
  });
});
