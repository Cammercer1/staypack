import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
import { createEmptyReportDraft } from "@/lib/reports/emptyReportDraft";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { mergeAppraisalResults, resolveAppraisalInput } from "@/lib/appraisals/resolveAppraisalInput";

const mocks = vi.hoisted(() => ({ copy: vi.fn(), reposition: vi.fn(() => { throw new Error("Must not reprice after review"); }) }));
vi.mock("@/lib/openai/generateLeaseAppraisalCopy", () => ({ generateLeaseAppraisalCopy: mocks.copy }));
vi.mock("@/lib/lease-appraisal/positionLeaseAppraisal", () => ({ ensureLeaseAppraisalPositioning: mocks.reposition }));
import { generateLeaseAppraisalReportContent } from "./generateLeaseAppraisalForListing";

it("generates using the reviewed rent band and exact selected comps without another pricing request or listing write", async () => {
  const { agency } = createLintRegressionFixtures();
  const listing = createEmptyListingDraft({ id: "listing", agency_id: agency.id, property_address: "1 Test St", suburb: "Bondi", state: "NSW", postcode: "2026", bedrooms: 3, bathrooms: 2, property_type: "house" });
  const comps = Array.from({ length: 8 }, (_, i) => ({ address: `${i + 2} Test St`, suburb: "Bondi", bedrooms: 3, propertyType: "house", weeklyRent: 1200 + i * 20, listingUrl: `https://example.test/${i}` }));
  const selected = [comps[5], comps[1], comps[7]];
  const appraisal = { weeklyMin: 1240, weeklyMax: 1340, weeklyMidpoint: 1290, compCount: 8, selectedCompListingIds: selected.map((comp) => comp.listingUrl) };
  listing.scraped_listing_json = mergeAppraisalResults(listing, "lease", { ...resolveAppraisalInput(listing), rentalComps: comps, rentalAppraisal: appraisal });
  const report = createEmptyReportDraft({ id: "report", agency_id: agency.id, listing_id: listing.id });
  const tables: string[] = [];
  const supabase = { from: (table: string) => {
    tables.push(table);
    let patch: Record<string, unknown> = {};
    const query = {
      update: (value: Record<string, unknown>) => { patch = value; return query; },
      eq: () => query, select: () => query,
      single: async () => ({ data: { ...report, ...patch }, error: null }),
    };
    return query;
  } } as unknown as SupabaseClient;
  const result = await generateLeaseAppraisalReportContent({ supabase, agency, listing, report, templateId: "classic-lease-appraisal" });
  expect(mocks.reposition).not.toHaveBeenCalled();
  expect(tables).toEqual(["reports", "collateral_items"]);
  expect(result.listing).toBe(listing);
  expect(result.parsed.rentalAppraisal).toMatchObject(appraisal);
  expect(result.report.final_report_json?.ltr).toMatchObject({ weekly_min: 1240, weekly_max: 1340, weekly_midpoint: 1290 });
  expect(mocks.copy.mock.calls[0][0].featuredComps.map((comp: { name: string }) => comp.name)).toEqual(selected.map((comp) => comp.address));
});
