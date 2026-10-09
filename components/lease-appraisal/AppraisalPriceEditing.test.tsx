// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LeaseAppraisalDataStep } from "./LeaseAppraisalDataStep";
import { SalesAppraisalDataStep } from "@/components/sales-appraisal/SalesAppraisalDataStep";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
import { mergeAppraisalResults, resolveAppraisalInput } from "@/lib/appraisals/resolveAppraisalInput";
vi.mock("next/image", () => ({ default: () => null }));
afterEach(cleanup);
const property = () => {
  const listing = createEmptyListingDraft({ property_address: "1 Test St", suburb: "Bondi", state: "NSW", postcode: "2026", bedrooms: 2, updated_at: "2026-10-09T00:00:00Z" });
  listing.scraped_listing_json = mergeAppraisalResults(listing, "lease", { ...resolveAppraisalInput(listing), rentalAppraisal: { weeklyMidpoint: 1000, compCount: 1 } });
  listing.scraped_listing_json = mergeAppraisalResults(listing, "sales", { ...resolveAppraisalInput(listing), salesAppraisal: { priceMidpoint: 1000000, compCount: 1 } });
  return listing;
};
it.each(["lease", "sales"] as const)("preserves unsaved %s figures when background data refreshes", (kind) => {
  const listing = property();
  const Component = kind === "lease" ? LeaseAppraisalDataStep : SalesAppraisalDataStep;
  const props = { listing, onListingChange: vi.fn(), onContinue: vi.fn() };
  const view = render(<Component {...props} />);
  const label = kind === "lease" ? "Weekly midpoint ($)" : "Price midpoint ($)";
  const field = screen.getByLabelText(label) as HTMLInputElement;
  fireEvent.change(field, { target: { value: kind === "lease" ? "1500" : "1500000" } });
  view.rerender(<Component {...props} listing={{ ...listing, updated_at: "2026-10-09T00:01:00Z", scraped_listing_json: { ...listing.scraped_listing_json!, rentalAppraisal: { weeklyMidpoint: 1100, compCount: 2 }, salesAppraisal: { priceMidpoint: 1100000, compCount: 2 } } }} />);
  expect(field.value).toBe(kind === "lease" ? "1500" : "1500000");
});
