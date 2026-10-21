// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { LeaseAppraisalDataStep } from "@/components/lease-appraisal/LeaseAppraisalDataStep";
import { SalesAppraisalDataStep } from "@/components/sales-appraisal/SalesAppraisalDataStep";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { mergeAppraisalResults, resolveAppraisalInput } from "@/lib/appraisals/resolveAppraisalInput";
import type { Listing } from "@/lib/types";

vi.mock("next/image", () => ({ default: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("treats untouched monthly rental figures as saved and clears dirty state when edits are undone", () => {
  const fixture = createLintRegressionFixtures();
  const listing = { ...fixture.listing, country: "US" };
  listing.scraped_listing_json = mergeAppraisalResults(listing, "lease", resolveAppraisalInput(fixture.listing));
  const onDirtyChange = vi.fn();
  render(<LeaseAppraisalDataStep listing={listing} onListingChange={vi.fn()} onContinue={vi.fn()} onDirtyChange={onDirtyChange} />);
  const minimum = screen.getByLabelText("Monthly min (USD)") as HTMLInputElement;
  expect(minimum.value).toBe("5200");
  expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  fireEvent.change(minimum, { target: { value: "5300" } });
  expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  fireEvent.change(minimum, { target: { value: "5200" } });
  expect(onDirtyChange).toHaveBeenLastCalledWith(false);
});

for (const kind of ["lease", "sales"] as const) {
  const Component = kind === "lease" ? LeaseAppraisalDataStep : SalesAppraisalDataStep;
  it(`${kind}: failed resets stay visible and retain the current figures`, async () => {
    const fixture = createLintRegressionFixtures();
    const listing: Listing = { ...fixture.listing, appraisal_overrides_json: kind === "lease"
      ? { lease: { weeklyMin: 1500, weeklyMax: 1700, weeklyMidpoint: 1600 } }
      : { sales: { priceMin: 3000000, priceMax: 3200000, priceMidpoint: 3100000 } } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Could not reset the estimate." }, { status: 503 })));
    render(<Component listing={listing} onListingChange={vi.fn()} onContinue={vi.fn()} />);
    const minimum = screen.getByLabelText(kind === "lease" ? "Weekly min ($)" : "Price min ($)") as HTMLInputElement;
    const currentAmount = minimum.value;
    fireEvent.click(screen.getByRole("button", { name: "Use latest suggested appraisal" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Could not reset the estimate.");
    expect(document.activeElement).toBe(alert);
    expect(minimum.value).toBe(currentAmount);
  });

  it(`${kind}: resetting figures preserves unsaved comparable choices until they are saved`, async () => {
    const fixture = createLintRegressionFixtures();
    const overridden: Listing = { ...fixture.listing, appraisal_overrides_json: kind === "lease"
      ? { lease: { weeklyMin: 1500, weeklyMax: 1700, weeklyMidpoint: 1600 } }
      : { sales: { priceMin: 3000000, priceMax: 3200000, priceMidpoint: 3100000 } } };
    const reset = { ...fixture.listing, updated_at: "2026-10-15T11:00:00Z" };
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ listing: reset })));
    vi.stubGlobal("fetch", fetcher);
    const onDirtyChange = vi.fn();
    function Harness() {
      const [listing, setListing] = useState(overridden);
      return <Component appraisalEndpoint="/api/appraisals/test/evidence" listing={listing} onListingChange={setListing} onContinue={vi.fn()} onDirtyChange={onDirtyChange} />;
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("tab", { name: "Comparables" }));
    fireEvent.click(screen.getByRole("button", { name: /20 Coast Street/ }));
    expect(screen.getByRole("button", { name: /20 Coast Street/ }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("tab", { name: kind === "lease" ? "Rent estimate" : "Price estimate" }));
    fireEvent.click(screen.getByRole("button", { name: "Use latest suggested appraisal" }));
    const minimum = kind === "lease" ? "Weekly min ($)" : "Price min ($)";
    await waitFor(() => expect((screen.getByLabelText(minimum) as HTMLInputElement).value).toBe(kind === "lease" ? "1200" : "2400000"));
    fireEvent.click(screen.getByRole("tab", { name: "Comparables" }));
    expect(screen.getByRole("button", { name: /20 Coast Street/ }).getAttribute("aria-pressed")).toBe("false");
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Continue to edit content" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    const body = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(body.expected_updated_at).toBe(reset.updated_at);
    expect(body.selected_comp_listing_ids).toHaveLength(5);
    expect(body.selected_comp_listing_ids).not.toContain("https://example.test/comparable/0");
    expect(body.weekly_min ?? body.price_min).toBeUndefined();
  });
}
