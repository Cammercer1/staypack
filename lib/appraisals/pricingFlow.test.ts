import { enrichFinalReportMetrics } from "@/lib/reports/enrichFinalReportMetrics";
import { resolveFinalReportForPrint } from "@/lib/reports/resolveFinalReportForPrint";
import { mergeClassicBrochureMetricsReport } from "@/lib/collateral/templates/sales-brochure/shared/mergeClassicBrochureMetricsReport";
import { beforeEach, expect, it, vi } from "vitest";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
import { createEmptyReportDraft } from "@/lib/reports/emptyReportDraft";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { resolveAdvertisedPrice, avmPriceSuggestion } from "@/lib/listings/pricing";
import { resolveAppraisalInput, mergeAppraisalResults } from "./resolveAppraisalInput";
import { buildLeaseAppraisalReport } from "@/lib/lease-appraisal/buildLeaseAppraisalReport";
import { buildSalesAppraisalReport } from "@/lib/sales-appraisal/buildSalesAppraisalReport";
import { buildBrochureDocument, getMockSalesBrochureCopy } from "@/lib/collateral/buildSalesBrochureDocument";
import type { CollateralItem, Listing } from "@/lib/types";
const access = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/requireUser", () => ({ requireListingAccess: access }));
import { PATCH as saveRent } from "@/app/api/listings/[id]/lease-appraisal/data/route";
import { PATCH as saveSale } from "@/app/api/listings/[id]/sales-appraisal/data/route";
const { agency } = createLintRegressionFixtures();
const property = () => createEmptyListingDraft({
  id: "price-test", agency_id: agency.id, property_address: "12/22A New Street", suburb: "Bondi", state: "NSW", postcode: "2026", bedrooms: 2,
  listing_purpose: "sale", display_price: "$1,175,000", advertised_sale_price: "$1,175,000", advertised_weekly_rent: null,
  scraped_listing_json: { images: [], agents: [], confidence: "high", warnings: [], domainAvm: {
    address: "12/22A New Street", comparableSales: [], propertyId: "test", urlSlug: "test", matchedAt: new Date().toISOString(),
    valuation: { lowerPrice: 980000, midPrice: 1140000, upperPrice: 1300000, confidence: "high", date: "2026-10-02" },
    rentalEstimate: { weeklyRent: 1070, confidence: "medium", date: "2026-09-30" },
  } },
});
beforeEach(() => vi.clearAllMocks());
it("separates sale and rental advertising and never advertises an AVM automatically", () => {
  const listing = property();
  expect(resolveAdvertisedPrice(listing, "sale")).toBe("$1,175,000");
  expect(resolveAdvertisedPrice(listing, "lease")).toBeNull();
  expect(avmPriceSuggestion(listing, "lease")?.display).toBe("$1,070 per week");
  expect(resolveAdvertisedPrice({ ...listing, advertised_weekly_rent: "$1,000,000" }, "lease")).toBeNull();
  expect(resolveAdvertisedPrice({ ...listing, advertised_sale_price: "$850 per week" }, "sale")).toBeNull();
  expect(resolveAdvertisedPrice({ ...listing, advertised_weekly_rent: "$850" }, "lease")).toBe("$850 per week");
  expect(resolveAdvertisedPrice({ ...listing, advertised_weekly_rent: "$850 per week" }, "lease")).toBe("$850 per week");
  expect(resolveAdvertisedPrice({ ...listing, advertised_weekly_rent: "850" }, "lease")).toBe("$850 per week");
});
it("legacy prices are usable only for their saved purpose and explicit clears win", () => {
  const listing = { ...property(), advertised_sale_price: undefined, advertised_weekly_rent: undefined };
  expect(resolveAdvertisedPrice(listing, "lease")).toBeNull();
  expect(resolveAdvertisedPrice(listing, "sale")).toBe("$1,175,000");
  expect(resolveAdvertisedPrice({ ...listing, advertised_sale_price: null }, "sale")).toBeNull();
});
it("uses each AVM for its own appraisal while retaining the raw estimate", () => {
  const listing = property();
  const input = resolveAppraisalInput(listing);
  expect(input.rentalAppraisal?.weeklyMidpoint).toBe(1070);
  expect(input.salesAppraisal?.priceMidpoint).toBe(1140000);
  const report = createEmptyReportDraft();
  const rent = buildLeaseAppraisalReport({ agency, listing, report, parsed: input });
  const sale = buildSalesAppraisalReport({ agency, listing, report, parsed: input });
  expect(rent.property.display_price).toBe("$1,070 per week");
  expect(enrichFinalReportMetrics(listing, rent).property.display_price).toBe("$1,070 per week");
  const later = { ...listing, appraisal_overrides_json: { lease: { weeklyMidpoint: 9999 } } };
  expect(resolveFinalReportForPrint({ status: "published" }, later, rent).property.display_price).toBe("$1,070 per week");
  expect(sale.property.display_price).toBe("$980,000 – $1,300,000");
  expect(listing.scraped_listing_json?.rentalAppraisal).toBeUndefined();
});
it.each(["sales_brochure", "rental_brochure"] as const)("routes %s defaults without crossing purposes", (type) => {
  const listing = property();
  const document = buildBrochureDocument({ agency, listing, collateralType: type, collateral: { type } as CollateralItem, copy: { ...getMockSalesBrochureCopy(listing, agency), price_value: "$900 per week" }, qrCodeUrl: "", qrTargetUrl: "" });
  expect(document.property.display_price).toBe(type === "sales_brochure" ? "$1,175,000" : "");
  expect(document.copy.price_value).toBe("$900 per week");
});
it("does not fill a blank brochure price from an attached appraisal", () => {
  const listing = property();
  const rent = buildLeaseAppraisalReport({ agency, listing, report: createEmptyReportDraft(), parsed: resolveAppraisalInput(listing) });
  const brochure = { ...rent, property: { ...rent.property, display_price: "" } };
  expect(mergeClassicBrochureMetricsReport(brochure, { leaseReport: rent }).property.display_price).toBe("");
});
for (const [kind, save, body, expected] of [
  ["lease", saveRent, { weekly_min: 1200, weekly_max: 1400, weekly_midpoint: 1300 }, { weeklyMin: 1200, weeklyMax: 1400, weeklyMidpoint: 1300 }],
  ["sales", saveSale, { price_min: 1500000, price_max: 1700000, price_midpoint: 1600000 }, { priceMin: 1500000, priceMax: 1700000, priceMidpoint: 1600000 }],
] as const) {
  it(`${kind} override survives saving, refresh, reload, and can be reset without modifying the AVM`, async () => {
    let listing: Listing = property();
    const update = vi.fn((patch: Partial<Listing>) => { listing = { ...listing, ...patch }; return query; });
    const query = { update, eq: () => query, select: () => query, maybeSingle: async () => ({ data: listing, error: null }) };
    access.mockImplementation(async () => ({ listing, supabase: { from: () => query } }));
    const call = (data: unknown) => save(new Request("http://localhost/api", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }), { params: Promise.resolve({ id: listing.id }) });
    expect((await call(body)).status).toBe(200);
    expect(listing.appraisal_overrides_json?.[kind]).toEqual(expected);
    const raw = resolveAppraisalInput(listing, { applyOverrides: false });
    expect(raw.rentalAppraisal?.weeklyMidpoint).toBe(1070);
    expect(raw.salesAppraisal?.priceMidpoint).toBe(1140000);
    listing = { ...listing, scraped_listing_json: mergeAppraisalResults(listing, kind, { ...raw, rentalAppraisal: { weeklyMidpoint: 1100 }, salesAppraisal: { priceMidpoint: 1200000 } }) };
    const reloaded = resolveAppraisalInput(structuredClone(listing));
    expect(kind === "lease" ? reloaded.rentalAppraisal : reloaded.salesAppraisal).toMatchObject(expected);
    expect(listing.scraped_listing_json?.domainAvm?.rentalEstimate?.weeklyRent).toBe(1070);
    expect((await call({ reset_price: true })).status).toBe(200);
    expect(listing.appraisal_overrides_json?.[kind]).toBeUndefined();
  });
}
it("rejects inverted appraisal ranges before writing", async () => {
  const update = vi.fn();
  access.mockResolvedValue({ listing: property(), supabase: { from: () => ({ update }) } });
  const response = await saveRent(new Request("http://localhost/api", { method: "PATCH", body: JSON.stringify({ weekly_min: 2000, weekly_max: 1000 }) }), { params: Promise.resolve({ id: "price-test" }) });
  expect(response.status).toBe(400);
  expect(update).not.toHaveBeenCalled();
});

it("keeps the matching AVM when imported asking-price formatting differs from the reviewed price", () => {
  const listing = property();
  listing.scraped_listing_json = { ...listing.scraped_listing_json!, displayPrice: "For Sale $1,175,000", title: "Original headline" };
  expect(resolveAppraisalInput(listing).rentalAppraisal?.weeklyMidpoint).toBe(1070);
});
