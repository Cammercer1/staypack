// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LeaseAppraisalDataStep } from "@/components/lease-appraisal/LeaseAppraisalDataStep";
import { SalesAppraisalDataStep } from "@/components/sales-appraisal/SalesAppraisalDataStep";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
import {
  mergeAppraisalResults,
  resolveAppraisalInput,
} from "@/lib/appraisals/resolveAppraisalInput";

vi.mock("next/image", () => ({ default: () => null }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

for (const kind of ["lease", "sales"] as const) {
  const Component =
    kind === "lease" ? LeaseAppraisalDataStep : SalesAppraisalDataStep;
  function property() {
    const listing = createEmptyListingDraft({
      id: "test",
      property_address: "1 Test St",
      suburb: "Bondi",
      state: "NSW",
      postcode: "2026",
      bedrooms: 3,
      property_type: "house",
    });
    const comps = Array.from({ length: 8 }, (_, i) => ({
      address: `${i + 2} Test St`,
      suburb: "Bondi",
      propertyType: "house",
      bedrooms: 3,
      listingUrl: `https://example.test/${i}`,
      weeklyRent: 1000,
      price: 1000000,
      saleStatus: "for_sale" as const,
    }));
    const selectedCompListingIds = comps
      .slice(0, 6)
      .map((comp) => comp.listingUrl);
    listing.scraped_listing_json = mergeAppraisalResults(listing, kind, {
      ...resolveAppraisalInput(listing),
      rentalComps: comps,
      rentalAppraisal: {
        weeklyMin: 900,
        weeklyMax: 1100,
        weeklyMidpoint: 1000,
        compCount: 8,
        selectedCompListingIds,
      },
      salesComps: comps,
      salesAppraisal: {
        priceMin: 900000,
        priceMax: 1100000,
        priceMidpoint: 1000000,
        compCount: 8,
        selectedCompListingIds,
      },
    });
    return listing;
  }

  describe(`${kind} appraisal review`, () => {
    it("filters without losing selections and saves the full selection from the toolbar", async () => {
      const listing = property();
      const fetcher = vi.fn().mockResolvedValue(Response.json({ listing }));
      vi.stubGlobal("fetch", fetcher);
      const onContinue = vi.fn();
      render(
        <Component
          listing={listing}
          onListingChange={vi.fn()}
          onContinue={onContinue}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Selected (6)" }));
      expect(screen.queryByText("9 Test St")).toBeNull();
      fireEvent.change(screen.getByRole("searchbox"), {
        target: { value: "  2 Test  " },
      });
      expect(screen.getByText("2 Test St")).toBeTruthy();
      expect(screen.queryByText("3 Test St")).toBeNull();
      fireEvent.click(
        screen.getByRole("button", { name: "Continue to edit content" }),
      );
      await waitFor(() => expect(onContinue).toHaveBeenCalledOnce());
      const body = JSON.parse(fetcher.mock.calls[0][1].body);
      expect(body.selected_comp_listing_ids).toHaveLength(6);
    });

    it("provides a useful empty filter state and preserves the six-comparable limit", () => {
      render(
        <Component
          listing={property()}
          onListingChange={vi.fn()}
          onContinue={vi.fn()}
        />,
      );
      fireEvent.change(screen.getByRole("searchbox"), {
        target: { value: "missing address" },
      });
      expect(screen.getByText(/No comparables match this view/)).toBeTruthy();
      fireEvent.change(screen.getByRole("searchbox"), {
        target: { value: "" },
      });
      const extra = screen.getByRole("button", { name: /9 Test St/ });
      fireEvent.click(extra);
      expect(extra.getAttribute("aria-pressed")).toBe("false");
      fireEvent.click(screen.getByRole("button", { name: /2 Test St/ }));
      fireEvent.click(extra);
      expect(extra.getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByRole("button", { name: "Selected (6)" })).toBeTruthy();
    });

    it("prevents duplicate searches while the initial request is pending", () => {
      render(
        <Component
          listing={property()}
          compsPrefetching
          onListingChange={vi.fn()}
          onContinue={vi.fn()}
        />,
      );
      expect(
        (
          screen.getByRole("button", {
            name: "Fetching comps...",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
    });
  });
}
