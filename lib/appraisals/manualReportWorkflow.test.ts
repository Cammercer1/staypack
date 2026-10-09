import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Report } from "@/lib/types";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
import { createEmptyReportDraft } from "@/lib/reports/emptyReportDraft";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { mergeAppraisalResults, resolveAppraisalInput } from "./resolveAppraisalInput";

const mocks = vi.hoisted(() => ({ rentCopy: vi.fn(), salesCopy: vi.fn() }));
vi.mock("@/lib/openai/generateLeaseAppraisalCopy", () => ({ generateLeaseAppraisalCopy: mocks.rentCopy }));
vi.mock("@/lib/openai/generateSalesAppraisalCopy", () => ({ generateSalesAppraisalCopy: mocks.salesCopy }));
import { createLeaseAppraisalDraft, generateLeaseAppraisalReportContent } from "@/lib/lease-appraisal/generateLeaseAppraisalForListing";
import { createSalesAppraisalDraft, generateSalesAppraisalReportContent } from "@/lib/sales-appraisal/generateSalesAppraisalForListing";
import { buildLeaseAppraisalTemplatePreview } from "@/lib/lease-appraisal/templatePreviewDocument";
import { buildSalesAppraisalTemplatePreview } from "@/lib/sales-appraisal/templatePreviewDocument";

const { agency } = createLintRegressionFixtures();
const manual = () => createEmptyListingDraft({ id: "manual", agency_id: agency.id, property_address: "1 Test Street", suburb: "Bondi", state: "NSW", postcode: "2026", bedrooms: 3, bathrooms: 2, car_spaces: 1, property_type: "House", listing_title: "Manually entered property", listing_description: "A three-bedroom home with two bathrooms and a private garden.", uploaded_image_urls: ["https://example.com/upload.jpg"] });

function database() {
  let report = createEmptyReportDraft({ id: "qa-report", agency_id: agency.id, listing_id: "manual" });
  const writes: { table: string; body: Record<string, unknown> }[] = [];
  const supabase = { from: (table: string) => {
    let body: Record<string, unknown> | undefined;
    const finish = async () => {
      if (body) {
        writes.push({ table, body });
        if (table === "reports") report = { ...report, ...body } as Report;
      }
      return { data: table === "reports" ? report : null, error: null };
    };
    const query = {
      insert: (value: Record<string, unknown>) => { body = value; return query; },
      update: (value: Record<string, unknown>) => { body = value; return query; },
      select: () => query, eq: () => query, neq: () => query,
      maybeSingle: finish, single: finish,
      then: (resolve: (value: Awaited<ReturnType<typeof finish>>) => unknown) => finish().then(resolve),
    };
    return query;
  } } as unknown as SupabaseClient;
  return { supabase, writes };
}

beforeEach(() => vi.clearAllMocks());
for (const [kind, create, generate, preview, copy, template] of [
  ["lease", createLeaseAppraisalDraft, generateLeaseAppraisalReportContent, buildLeaseAppraisalTemplatePreview, mocks.rentCopy, "classic-lease-appraisal"],
  ["sales", createSalesAppraisalDraft, generateSalesAppraisalReportContent, buildSalesAppraisalTemplatePreview, mocks.salesCopy, "classic-sales-appraisal"],
] as const) {
  describe(`${kind} manual report workflow`, () => {
    it("creates a draft and renders a template before any import or comparables", async () => {
      const listing = manual(), db = database();
      const { report } = await create({ supabase: db.supabase, listing, agency });
      const document = preview({ agency, listing, report, templateId: template });
      expect(document?.property).toMatchObject({ address: "1 Test Street", suburb: "Bondi", bedrooms: 3, hero_image_url: "https://example.com/upload.jpg" });
      expect(document?.copy.disclaimer).toBeTruthy();
      expect(db.writes.map((write) => write.table)).toEqual(["reports", "collateral_items"]);
      expect(listing.scraped_listing_json).toBeNull();
    });

    const withEvidence = () => {
      const listing = manual();
      listing.scraped_listing_json = mergeAppraisalResults(listing, kind, {
        ...resolveAppraisalInput(listing),
        rentalAppraisal: { weeklyMin: 800, weeklyMax: 1000, weeklyMidpoint: 900, compCount: 1, selectedCompListingIds: ["https://example.com/comp"] },
        rentalComps: [{ address: "2 Test Street", weeklyRent: 900, bedrooms: 3, propertyType: "House", listingUrl: "https://example.com/comp" }],
        salesAppraisal: { priceMin: 900000, priceMax: 1100000, priceMidpoint: 1000000, compCount: 1, selectedCompListingIds: ["https://example.com/comp"] },
        salesComps: [{ address: "2 Test Street", price: 1000000, saleStatus: "sold", soldDate: new Date().toISOString().slice(0, 10), bedrooms: 3, propertyType: "House", listingUrl: "https://example.com/comp" }],
      });
      return listing;
    };

    it("generates a persisted report snapshot with manual details, selected evidence and a disclaimer", async () => {
      const listing = withEvidence(), before = structuredClone(listing), db = database();
      const report = createEmptyReportDraft({ id: "qa-report", agency_id: agency.id, listing_id: listing.id });
      const result = await generate({ supabase: db.supabase, agency, listing, report, templateId: template });
      expect(copy.mock.calls[0][0].parsed).toMatchObject({ suburb: "Bondi", bedrooms: 3, title: "Manually entered property" });
      expect(result.report.status).toBe("generated");
      expect(result.report.final_report_json?.property).toMatchObject({ address: "1 Test Street", bedrooms: 3, hero_image_url: "https://example.com/upload.jpg" });
      expect(result.report.final_report_json?.copy.disclaimer).toBeTruthy();
      expect(JSON.stringify(result.report.final_report_json)).toContain("2 Test Street");
      expect(listing).toEqual(before);
      expect(listing.scraped_listing_json?.suburb).toBeUndefined();
    });

    it("blocks generation from stale comparables before generating copy or updating a report", async () => {
      const listing = { ...withEvidence(), bedrooms: 4 }, db = database();
      const report = createEmptyReportDraft({ id: "qa-report" });
      await expect(generate({ supabase: db.supabase, agency, listing, report, templateId: template })).rejects.toThrow(/Fetch .* comps/);
      expect(copy).not.toHaveBeenCalled();
      expect(db.writes).toHaveLength(0);
    });
  });
}
