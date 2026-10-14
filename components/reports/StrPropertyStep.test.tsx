// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { StrPropertyStep, type StrPropertyHandle } from "./StrPropertyStep";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function setup(saved = false) {
  const { listing, report } = createLintRegressionFixtures();
  listing.advertised_sale_price = "$1,600,000";
  listing.advertised_weekly_rent = null;
  listing.scraped_listing_json = { ...listing.scraped_listing_json!, rentalAppraisal: undefined, domainAvm: undefined, propertyLookup: undefined };
  report.user_overrides_json = saved ? { strProperty: { propertyValue: null, weeklyRent: null, amenities: [], additionalAmenities: [] } } : null;
  const incoming = { ...listing, scraped_listing_json: { ...listing.scraped_listing_json!, domainAvm: { urlSlug: "example", address: "Example", matchedAt: new Date().toISOString(), comparableSales: [], valuation: { lowerPrice: 1000000, midPrice: 1200000, upperPrice: 1400000, confidence: "medium" as const, date: "2026-10-10" } }, propertyLookup: { source: "domain" as const, matchedAt: new Date().toISOString(), media: [], advertisedSalePrice: "$1,600,000", advertisedWeeklyRent: "$950 per week", features: ["Pool", "Air conditioning"] } } };
  let resolve!: (response: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((done) => { resolve = done; })));
  const ref = createRef<StrPropertyHandle>();
  render(<StrPropertyStep ref={ref} listing={listing} report={report} busy={false} onContinue={vi.fn()} />);
  return { ref, complete: async () => { await act(async () => resolve(Response.json({ listing: incoming }))); }, fail: async () => { await act(async () => resolve(Response.json({ error: "Property details unavailable. Enter details manually." }, { status: 503 }))); } };
}
it("prefills Domain fields, accepts toggles and flushes an unsubmitted custom amenity", async () => {
  const { ref, complete } = setup();
  await complete();
  expect((screen.getByLabelText("Car spaces") as HTMLInputElement).value).toBe("2");
  expect((screen.getByLabelText("Estimated property value ($)") as HTMLInputElement).value).toBe("1200000");
  expect((screen.getByLabelText("Long-term rent ($ / week)") as HTMLInputElement).value).toBe("950");
  expect(screen.getByText("$49,400 / year")).toBeTruthy();
  expect(screen.getByText("Estimated gross LTR yield: 4.1%")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Pool" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Pool" }));
  fireEvent.change(screen.getByLabelText("Add another amenity"), { target: { value: "Private tennis court" } });
  let result: Awaited<ReturnType<StrPropertyHandle["read"]>>;
  await act(async () => { result = await ref.current!.read(); });
  expect(result!.values).toMatchObject({ propertyValue: 1200000, weeklyRent: 950, amenities: ["air_conditioning"], additionalAmenities: ["Private tennis court"] });
});
it("keeps edits made before a slow Domain response arrives", async () => {
  const { complete } = setup();
  fireEvent.change(screen.getByLabelText("Car spaces"), { target: { value: "0" } });
  fireEvent.change(screen.getByLabelText("Estimated property value ($)"), { target: { value: "1450000" } });
  fireEvent.change(screen.getByLabelText("Long-term rent ($ / week)"), { target: { value: "875" } });
  fireEvent.click(screen.getByRole("button", { name: "BBQ" }));
  await complete();
  expect((screen.getByLabelText("Car spaces") as HTMLInputElement).value).toBe("0");
  expect((screen.getByLabelText("Estimated property value ($)") as HTMLInputElement).value).toBe("1450000");
  expect((screen.getByLabelText("Long-term rent ($ / week)") as HTMLInputElement).value).toBe("875");
  expect(screen.getByRole("button", { name: "Pool" }).getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByRole("button", { name: "BBQ" }).getAttribute("aria-pressed")).toBe("true");
});
it("keeps saved clears when reopening and refreshing Domain", async () => {
  const { complete } = setup(true);
  await complete();
  expect((screen.getByLabelText("Long-term rent ($ / week)") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("Estimated property value ($)") as HTMLInputElement).value).toBe("");
  expect(screen.getByRole("button", { name: "Pool" }).getAttribute("aria-pressed")).toBe("false");
  expect(screen.queryByText(/Estimated gross LTR yield:/)).toBeNull();
});
it("updates the gross LTR comparison using the estimated value and hides it when cleared", async () => {
  const { complete } = setup();
  await complete();
  fireEvent.change(screen.getByLabelText("Estimated property value ($)"), { target: { value: "1000000" } });
  fireEvent.change(screen.getByLabelText("Long-term rent ($ / week)"), { target: { value: "1000" } });
  await waitFor(() => expect(screen.getByText("Estimated gross LTR yield: 5.2%")).toBeTruthy());
  fireEvent.change(screen.getByLabelText("Estimated property value ($)"), { target: { value: "" } });
  await waitFor(() => expect(screen.queryByText(/Estimated gross LTR yield:/)).toBeNull());
  expect(vi.mocked(fetch).mock.calls).toHaveLength(1);
  expect(vi.mocked(fetch).mock.calls[0][0]).toContain("/property-profile");
});
it("allows manual continuation when Domain fails and validates rental input", async () => {
  const { ref, fail } = setup();
  await fail();
  expect(screen.getByText(/Property details unavailable/)).toBeTruthy();
  expect((screen.getByLabelText("Estimated property value ($)") as HTMLInputElement).value).toBe("");
  fireEvent.change(screen.getByLabelText("Long-term rent ($ / week)"), { target: { value: "-1" } });
  await act(async () => { expect(await ref.current!.read()).toBeNull(); });
  fireEvent.change(screen.getByLabelText("Long-term rent ($ / week)"), { target: { value: "" } });
  await waitFor(() => expect(screen.queryByText("Enter a weekly rent greater than zero, or leave it blank.")).toBeNull());
  await act(async () => { expect((await ref.current!.read())?.values.weeklyRent).toBeNull(); });
});

it("distinguishes unknown parking from zero and rejects invalid counts", async () => {
  const { ref, complete } = setup();
  await complete();
  for (const value of ["-1", "1.5", "21"]) {
    fireEvent.change(screen.getByLabelText("Car spaces"), { target: { value } });
    await act(async () => { expect(await ref.current!.read()).toBeNull(); });
  }
  fireEvent.change(screen.getByLabelText("Car spaces"), { target: { value: "0" } });
  await act(async () => { expect((await ref.current!.read())?.values.car_spaces).toBe(0); });
  fireEvent.change(screen.getByLabelText("Car spaces"), { target: { value: "" } });
  await act(async () => { expect((await ref.current!.read())?.values.car_spaces).toBeNull(); });
});
