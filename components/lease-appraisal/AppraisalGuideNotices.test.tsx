// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LeaseAppraisalDataStep } from "./LeaseAppraisalDataStep";
import { SalesAppraisalDataStep } from "@/components/sales-appraisal/SalesAppraisalDataStep";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
import { mergeAppraisalResults, resolveAppraisalInput } from "@/lib/appraisals/resolveAppraisalInput";

vi.mock("next/image", () => ({ default: () => null }));
afterEach(cleanup);

function property() {
  const listing = createEmptyListingDraft({ country: "AU", property_address: "2/6 Tower Street", suburb: "Manly", state: "NSW", postcode: "2095", bedrooms: 1, bathrooms: 1, property_type: "apartment", updated_at: "2026-10-16T00:00:00Z" });
  const parsed = resolveAppraisalInput(listing);
  const rentalComps = [630, 650].map((weeklyRent, index) => ({ address: `${index + 1}/20 Test Street, Manly`, suburb: "Manly", propertyType: "apartment", weeklyRent, bedrooms: 1, bathrooms: 1, listingUrl: `https://example.test/rental/${index}` }));
  const domainAvm = { address: "2/6 Tower Street, Manly", urlSlug: "2-6-tower-street-manly", matchedAt: "2026-10-16T00:00:00Z", comparableSales: [], rentalEstimate: { weeklyRent: 565, confidence: "high" as const }, valuation: { lowerPrice: 760000, midPrice: 880000, upperPrice: 1000000, confidence: "high" as const } };
  listing.scraped_listing_json = mergeAppraisalResults(listing, "lease", { ...parsed, domainAvm, rentalComps,
    rentalAppraisal: { weeklyMin: 540, weeklyMidpoint: 565, weeklyMax: 590, compCount: 2, selectedCompListingIds: rentalComps.map(comp => comp.listingUrl) } });
  listing.scraped_listing_json = mergeAppraisalResults(listing, "sales", { ...resolveAppraisalInput(listing), domainAvm,
    salesAppraisal: { priceMin: 835000, priceMidpoint: 880000, priceMax: 925000, compCount: 1 } });
  return listing;
}

it("explains the automated lease guide and updates the outside-evidence warning without repricing when a selection changes", () => {
  const listing = property();
  render(<LeaseAppraisalDataStep listing={listing} onListingChange={vi.fn()} onContinue={vi.fn()} />);
  expect(screen.getByText(/weekly rental guide is anchored to an automated property estimate/)).toBeTruthy();
  expect(screen.getByText(/The guide is below all selected matching advertised rents/)).toBeTruthy();
  expect(screen.queryByText("These comparables drive the suggested rent range.")).toBeNull();
  const min = screen.getByLabelText("Weekly min ($)") as HTMLInputElement;
  const max = screen.getByLabelText("Weekly max ($)") as HTMLInputElement;
  const firstComp = screen.getByRole("button", { name: /1\/20 Test Street/ });
  fireEvent.click(firstComp);
  expect(min.value).toBe("540");
  expect(max.value).toBe("590");
  expect(screen.getByText(/The guide is below all selected matching advertised rents/)).toBeTruthy();
  fireEvent.change(min, { target: { value: "630" } });
  fireEvent.change(max, { target: { value: "650" } });
  expect(screen.queryByText(/The guide is below all selected matching advertised rents/)).toBeNull();
  expect(screen.getByText(/The rental guide uses your entered figures/)).toBeTruthy();
});

it.each(["lease", "sales"] as const)("shows the saved %s override as the source instead of automated data", kind => {
  const listing = property();
  listing.appraisal_overrides_json = kind === "lease" ? { lease: { weeklyMin: 630, weeklyMidpoint: 640, weeklyMax: 650 } } : { sales: { priceMin: 900000, priceMidpoint: 925000, priceMax: 950000 } };
  const Component = kind === "lease" ? LeaseAppraisalDataStep : SalesAppraisalDataStep;
  render(<Component listing={listing} onListingChange={vi.fn()} onContinue={vi.fn()} />);
  expect(screen.getByText(/uses the agent’s appraisal figures/)).toBeTruthy();
  expect(screen.getByText(/Selecting comparables changes the evidence included, not your guide/)).toBeTruthy();
});
