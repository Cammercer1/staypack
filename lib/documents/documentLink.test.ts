import { describe, expect, it, vi } from "vitest";
import { applyDocumentLinkDraft, documentLinkLabel, documentLinkSchema, preserveDocumentLink, publishedDocumentSnapshot, resolveDocumentLinkTarget } from "./documentLink";
import { hasLegacyPropertyPage } from "@/lib/listings/legacyPropertyPages";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { buildSalesBrochureDocument, buildRentalBrochureDocument, getMockSalesBrochureCopy } from "@/lib/collateral/buildSalesBrochureDocument";
import { buildBusinessCardDocument } from "@/lib/collateral/buildBusinessCardDocument";
import { ensureBusinessCardDocument } from "@/lib/collateral/business-card/normalizeBusinessCardDocument";
import { provisionCollateralQr } from "@/lib/collateral/provisionCollateralQr";
import { salesBrochureNeedsRepublish } from "@/lib/collateral/sales-brochure/brochurePublishSync";
import { outreachGenerateRequestSchema } from "@/lib/delivery/outreach/schema";
import { generateCollateralDocument } from "@/lib/collateral/generateCollateralDocument";
import { buildBrochureTemplatePreview } from "@/lib/collateral/sales-brochure/templatePreviewDocument";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("document link choices", () => {
  it.each(["javascript:alert(1)", "data:text/html,hello", "ftp://example.com/a", "https://user:secret@example.com", "invalid", "", "//example.com/a"])("rejects %s", (url) => {
    expect(documentLinkSchema.safeParse({ mode: "custom", url }).success).toBe(false);
  });
  it("validates and normalises an explicit destination", () => {
    expect(documentLinkSchema.parse({ mode: "custom", url: " https://example.com/property?a=1#photos " })).toEqual({ mode: "custom", url: "https://example.com/property?a=1#photos" });
  });
  it("defaults new documents to no QR while retaining legacy QR images", () => {
    expect(preserveDocumentLink(null)).toEqual({ document_link: { mode: "none" } });
    expect(preserveDocumentLink({ assets: { qr_code_url: "old.png" } })).toEqual({});
  });
  it("only uses a report URL when that document explicitly chooses it", () => {
    expect(resolveDocumentLinkTarget({ mode: "none" }, "https://staypack.app/a/report")).toBe("");
    expect(resolveDocumentLinkTarget({ mode: "report" }, "https://staypack.app/a/report")).toBe("https://staypack.app/a/report");
    expect(() => resolveDocumentLinkTarget({ mode: "report" })).toThrow("online report");
  });
  it("keeps two reports independent and does not mutate a published snapshot", () => {
    const old = { assets: { qr_code_url: "published.png", pdf_url: "published.pdf" }, document_link_draft: { link: { mode: "custom" as const, url: "https://example.com/one" }, target_url: "https://example.com/one", qr_code_url: "one.png" } };
    const second = { ...old, document_link_draft: { link: { mode: "none" as const }, target_url: "", qr_code_url: "" } };
    const firstResult = applyDocumentLinkDraft(old);
    expect(firstResult.assets).toEqual({ qr_code_url: "one.png", pdf_url: "" });
    expect(firstResult.document_link_draft).toBeUndefined();
    expect(applyDocumentLinkDraft(second).assets.qr_code_url).toBe("");
    expect(old.assets.qr_code_url).toBe("published.png");
    expect(old.document_link_draft).toBeDefined();
  });
  it("does not remove or regenerate legacy QR assets on publication", () => {
    const old = { assets: { qr_code_url: "old-printed.png" }, qr_target_url: "https://example.com/old" };
    expect(applyDocumentLinkDraft(old)).toBe(old);
  });
  it("does not expose an unpublished destination in a public snapshot", () => {
    const published = { assets: { qr_code_url: "printed.png", pdf_url: "printed.pdf" }, document_link: { mode: "none" as const }, document_link_draft: { link: { mode: "custom" as const, url: "https://example.test/private-draft" }, target_url: "https://example.test/private-draft", qr_code_url: "draft.png" } };
    const snapshot = publishedDocumentSnapshot(published);
    expect(snapshot).toEqual({ assets: published.assets, document_link: published.document_link });
    expect(JSON.stringify(snapshot)).not.toContain("private-draft");
    expect(published.document_link_draft).toBeDefined();
  });
  it("uses destination-specific wording", () => {
    expect(documentLinkLabel({ document_link: { mode: "report" } })).toBe("Scan to view this report");
    expect(documentLinkLabel({ document_link: { mode: "custom", url: "https://example.com" } })).toBe("Scan for more information");
  });
});

describe("regeneration and backwards compatibility", () => {
  const fixture = createLintRegressionFixtures();
  const draft = { link: { mode: "custom" as const, url: "https://example.com/new" }, target_url: "https://example.com/new", qr_code_url: "new.png" };
  it.each(["sales_brochure", "rental_brochure"] as const)("does not add a placeholder QR to a new %s template preview", (collateralType) => {
    const preview = buildBrochureTemplatePreview({ agency: fixture.agency, listing: fixture.listing, collateral: { ...fixture.collateral, document_json: null }, templateId: fixture.document.template_id, collateralType });
    expect(preview.document_link).toEqual({ mode: "none" });
    expect(preview.assets.qr_code_url).toBe("");
    expect(preview.qr_target_url).toBe("");
  });
  it("previews the saved pending choice when switching brochure templates", () => {
    const preview = buildBrochureTemplatePreview({ agency: fixture.agency, listing: fixture.listing, collateral: { ...fixture.collateral, document_json: { ...fixture.document, document_link_draft: draft } }, templateId: fixture.document.template_id, collateralType: "sales_brochure" });
    expect(preview.document_link).toEqual(draft.link);
    expect(preview.assets.qr_code_url).toBe(draft.qr_code_url);
    expect(preview.qr_target_url).toBe(draft.target_url);
  });
  it.each([buildSalesBrochureDocument, buildRentalBrochureDocument])("preserves pending links when brochure copy is rebuilt", (build) => {
    const doc = { ...fixture.document, document_link: { mode: "none" as const }, document_link_draft: draft };
    const rebuilt = build({ agency: fixture.agency, listing: fixture.listing, collateral: { ...fixture.collateral, document_json: doc }, copy: getMockSalesBrochureCopy(fixture.listing, fixture.agency), qrCodeUrl: "", qrTargetUrl: "" });
    expect(rebuilt.document_link_draft).toEqual(draft);
    expect(rebuilt.assets.qr_code_url).toBe("");
    expect(applyDocumentLinkDraft(rebuilt).assets.qr_code_url).toBe("new.png");
  });
  it("keeps a business card's own destination through normalisation", () => {
    const card = buildBusinessCardDocument({ agency: fixture.agency, listing: null, collateral: fixture.collateral });
    const saved = ensureBusinessCardDocument({ ...card, document_link: draft.link, qr_target_url: draft.target_url, assets: { qr_code_url: draft.qr_code_url } });
    expect(saved.document_link).toEqual(draft.link);
    expect(saved.assets.qr_code_url).toBe("new.png");
  });
  it("does not contact Supabase or provision a page while preparing a brochure", async () => {
    const from = vi.fn(() => { throw new Error("Unexpected database call"); });
    const result = await provisionCollateralQr({ agency: fixture.agency, listing: fixture.listing, collateral: { ...fixture.collateral, document_json: null }, supabase: { from } as unknown as SupabaseClient });
    expect(result.qrCodeUrl).toBe("");
    expect(result.provisionedListing).toBe(fixture.listing);
    expect(from).not.toHaveBeenCalled();
  });
  it("preserves a standalone card's destination when regenerating without a property", async () => {
    const from = vi.fn(() => { throw new Error("Unexpected database call"); });
    const collateral = { ...fixture.card, document_json: { ...fixture.card.document_json!, document_link: draft.link, qr_target_url: draft.target_url, assets: { qr_code_url: draft.qr_code_url } } };
    const result = await generateCollateralDocument({ agency: fixture.agency, listing: null, collateral, supabase: { from } as unknown as SupabaseClient });
    expect(result).toMatchObject({ document_link: draft.link, qr_target_url: draft.target_url, assets: { qr_code_url: draft.qr_code_url } });
    expect(from).not.toHaveBeenCalled();
  });
  it("marks a brochure PDF stale after a saved destination edit", () => {
    expect(salesBrochureNeedsRepublish({ ...fixture.collateral, pdf_url: "old.pdf", document_json: { ...fixture.document, content_saved_at: "2026-10-08T02:00:00Z", pdf_synced_at: "2026-10-08T01:00:00Z", document_link_draft: draft } })).toBe(true);
  });
  it("only serves property pages with evidence of legacy publication", () => {
    const unpublished = { landing_published_at: null, public_url: null, landing_qr_code_url: null, custom_landing_url: null };
    expect(hasLegacyPropertyPage(unpublished)).toBe(false);
    for (const key of Object.keys(unpublished)) expect(hasLegacyPropertyPage({ ...unpublished, [key]: "legacy-value" })).toBe(true);
  });
  it("accepts independent outreach choices, with no implicit default URL", () => {
    const base = { tenant_slug: "mock", listing_url: "https://example.com/listing" };
    expect(outreachGenerateRequestSchema.parse(base).document_links).toBeUndefined();
    const request = outreachGenerateRequestSchema.parse({ ...base, document_links: { str: { mode: "report" }, lease_appraisal: { mode: "none" }, sales_brochure: draft.link } });
    expect(request.document_links?.sales_brochure).toEqual(draft.link);
    expect(outreachGenerateRequestSchema.safeParse({ ...base, document_links: { sales_brochure: { mode: "report" } } }).success).toBe(false);
  });
});
