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
    it("preserves edited figures and selections when switching between estimate and comparables", () => {
      render(<Component listing={property()} onListingChange={vi.fn()} onContinue={vi.fn()} />);
      const estimateTab = kind === "lease" ? "Rent estimate" : "Price estimate";
      const inputLabel = kind === "lease" ? "Weekly min ($)" : "Price min ($)";
      const amount = kind === "lease" ? "950" : "950000";
      expect(screen.getByRole("tab", { name: estimateTab }).getAttribute("aria-selected")).toBe("true");
      expect(screen.queryByRole("button", { name: /2 Test St/ })).toBeNull();
      fireEvent.change(screen.getByLabelText(inputLabel), { target: { value: amount } });
      fireEvent.click(screen.getByRole("tab", { name: "Comparables" }));
      fireEvent.click(screen.getByRole("button", { name: /2 Test St/ }));
      fireEvent.click(screen.getByRole("tab", { name: estimateTab }));
      expect((screen.getByLabelText(inputLabel) as HTMLInputElement).value).toBe(amount);
      fireEvent.click(screen.getByRole("tab", { name: "Comparables" }));
      expect(screen.getByRole("button", { name: /2 Test St/ }).getAttribute("aria-pressed")).toBe("false");
    });

    it("keeps failed saves visible and focused without losing edits, then retries", async () => {
      const listing = property();
      const fetcher = vi.fn()
        .mockResolvedValueOnce(Response.json({ error: "Could not save. Try again." }, { status: 503 }))
        .mockResolvedValueOnce(Response.json({ listing }));
      vi.stubGlobal("fetch", fetcher);
      const onContinue = vi.fn();
      render(<Component listing={listing} onListingChange={vi.fn()} onContinue={onContinue} continueLabel="Use this estimate" />);
      const inputLabel = kind === "lease" ? "Weekly min ($)" : "Price min ($)";
      const amount = kind === "lease" ? "950" : "950000";
      fireEvent.change(screen.getByLabelText(inputLabel), { target: { value: amount } });
      fireEvent.click(screen.getByRole("button", { name: "Use this estimate" }));
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toBe("Could not save. Try again.");
      expect(alert.classList.contains("du-alert-error")).toBe(true);
      expect(document.activeElement).toBe(alert);
      expect((screen.getByLabelText(inputLabel) as HTMLInputElement).value).toBe(amount);
      expect(onContinue).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Use this estimate" }));
      await waitFor(() => expect(onContinue).toHaveBeenCalledOnce());
      expect(screen.queryByRole("alert")).toBeNull();
      expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject(kind === "lease" ? { weekly_min: 950 } : { price_min: 950000 });
    });

    it("shows failed comparable searches above both tabs", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Search unavailable. Try again." }, { status: 503 })));
      render(<Component listing={property()} onListingChange={vi.fn()} onContinue={vi.fn()} />);
      fireEvent.click(screen.getByRole("tab", { name: "Comparables" }));
      fireEvent.click(screen.getByRole("button", { name: "Refresh comparables" }));
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toBe("Search unavailable. Try again.");
      expect(document.activeElement).toBe(alert);
      fireEvent.click(screen.getByRole("tab", { name: kind === "lease" ? "Rent estimate" : "Price estimate" }));
      expect(screen.getByRole("alert")).toBe(alert);
    });

    it("links a blocked Continue to comparable selection", () => {
      render(<Component listing={property()} onListingChange={vi.fn()} onContinue={vi.fn()} />);
      fireEvent.click(screen.getByRole("tab", { name: "Comparables" }));
      for (let address = 2; address <= 7; address++) fireEvent.click(screen.getByRole("button", { name: new RegExp(`${address} Test St`) }));
      fireEvent.click(screen.getByRole("tab", { name: kind === "lease" ? "Rent estimate" : "Price estimate" }));
      expect((screen.getByRole("button", { name: "Continue to edit content" }) as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: "Choose comparables" }));
      expect(screen.getByRole("tab", { name: "Comparables" }).getAttribute("aria-selected")).toBe("true");
      fireEvent.click(screen.getByRole("button", { name: /2 Test St/ }));
      expect((screen.getByRole("button", { name: "Continue to edit content" }) as HTMLButtonElement).disabled).toBe(false);
    });

    it("links invalid figures back to the estimate when comparables are open", () => {
      render(<Component listing={property()} onListingChange={vi.fn()} onContinue={vi.fn()} />);
      const minimum = kind === "lease" ? "Weekly min ($)" : "Price min ($)";
      fireEvent.change(screen.getByLabelText(minimum), { target: { value: kind === "lease" ? "1500" : "1500000" } });
      fireEvent.click(screen.getByRole("tab", { name: "Comparables" }));
      expect((screen.getByRole("button", { name: "Continue to edit content" }) as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByText("Minimum must not exceed maximum, and midpoint must be within the range.")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Review estimate" }));
      expect(screen.getByRole("tab", { name: kind === "lease" ? "Rent estimate" : "Price estimate" }).getAttribute("aria-selected")).toBe("true");
      fireEvent.change(screen.getByLabelText(minimum), { target: { value: kind === "lease" ? "900" : "900000" } });
      expect((screen.getByRole("button", { name: "Continue to edit content" }) as HTMLButtonElement).disabled).toBe(false);
    });

    if (kind === "sales") it("keeps the agency guide review required and links back to its acknowledgement", () => {
      const listing = property();
      const parsed = resolveAppraisalInput(listing);
      listing.scraped_listing_json = mergeAppraisalResults(listing, "sales", { ...parsed, salesAppraisal: {
        ...parsed.salesAppraisal!, agencyGuideReview: { required: true, confirmed: false, divergencePct: 20, reasons: ["Guide differs from comparable evidence"] },
      } });
      render(<Component listing={listing} onListingChange={vi.fn()} onContinue={vi.fn()} />);
      fireEvent.click(screen.getByRole("tab", { name: "Comparables" }));
      expect((screen.getByRole("button", { name: "Continue to edit content" }) as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: "Review price estimate" }));
      expect(screen.getByRole("tab", { name: "Price estimate" }).getAttribute("aria-selected")).toBe("true");
      fireEvent.click(screen.getByRole("checkbox", { name: "I have reviewed the agency guide against the comparable evidence." }));
      expect((screen.getByRole("button", { name: "Continue to edit content" }) as HTMLButtonElement).disabled).toBe(false);
    });

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
      fireEvent.click(screen.getByRole("tab", { name: "Comparables" }));
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
      fireEvent.click(screen.getByRole("tab", { name: "Comparables" }));
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
      fireEvent.click(screen.getByRole("tab", { name: "Comparables" }));
      expect(
        (
          screen.getByRole("button", {
            name: "Finding comparables…",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
    });
  });
}
