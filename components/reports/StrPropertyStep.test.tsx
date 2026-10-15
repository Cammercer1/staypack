// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { calculatorPropertyReviewKey } from "@/lib/str-calculator/propertyReviewIdentity";
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

it("shows and edits US monthly rent while persisting an equivalent annual comparison", async () => {
  const { listing, report } = createLintRegressionFixtures();
  listing.country = "United States";
  report.user_overrides_json = { strProperty: { propertyValue: 1584100, weeklyRent: 6269 * 12 / 52, amenities: [], additionalAmenities: [] } };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ listing })));
  const ref = createRef<StrPropertyHandle>();
  render(<StrPropertyStep ref={ref} listing={listing} report={report} busy={false} onContinue={vi.fn()} />);
  const input = await screen.findByLabelText("Long-term rent (USD / month)");
  expect((input as HTMLInputElement).value).toBe("6269");
  expect(screen.getByText("US$75,228 / year")).toBeTruthy();
  fireEvent.change(input, { target: { value: "7000" } });
  await waitFor(() => expect(screen.getByText("US$84,000 / year")).toBeTruthy());
  await act(async () => { expect((await ref.current!.read())!.values.weeklyRent! * 52).toBeCloseTo(84000); });
});

it("checks calculator evidence before confirmation and keeps the visitor's room counts", async () => {
  const { listing, report } = createLintRegressionFixtures();
  report.user_overrides_json = null;
  const imported = { ...listing, hero_image_url: "https://example.test/imported.jpg", selected_image_urls: ["https://example.test/imported.jpg"], scraped_listing_json: { ...listing.scraped_listing_json!, bedrooms: 3, bathrooms: 1, propertyLookup: { source: "domain" as const, matchedAt: new Date().toISOString(), media: [], advertisedWeeklyRent: "$950 per week" } } };
  let resolve!: (response: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((done) => { resolve = done; })));
  const ref = createRef<StrPropertyHandle>();
  render(<StrPropertyStep ref={ref} listing={listing} report={report} busy={false} calculatorReview onContinue={vi.fn()} />);
  expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({ refresh: false, calculatorReview: true, reportId: report.id });
  expect((screen.getByRole("button", { name: "Confirm property & continue" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText("Checking Domain for photos and rental details…")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Guest capacity"), { target: { value: "7" } });
  await act(async () => resolve(Response.json({ listing: imported })));
  expect((screen.getByRole("button", { name: "Confirm property & continue" }) as HTMLButtonElement).disabled).toBe(false);
  expect(screen.getByRole("img", { name: "Property photo 1" }).getAttribute("src")).toBe("https://example.test/imported.jpg");
  expect(screen.getByText(/Property record: 3 bedrooms · 1 bathroom/)).toBeTruthy();
  expect((screen.getByLabelText("Bedrooms") as HTMLInputElement).value).toBe("4");
  expect((screen.getByLabelText("Bathrooms") as HTMLInputElement).value).toBe("2");
  await act(async () => { expect((await ref.current!.read())!.values).toMatchObject({ bedrooms: 4, bathrooms: 2, accommodates: 7, weeklyRent: 950 }); });
});

it("shows an automatic locality correction without discarding edits made while the lookup loads", async () => {
  const { listing, report } = createLintRegressionFixtures();
  report.user_overrides_json = null;
  let resolve!: (response: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(done => { resolve = done; })));
  const ref = createRef<StrPropertyHandle>();
  render(<StrPropertyStep ref={ref} listing={listing} report={report} busy={false} calculatorReview onContinue={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Long-term rent ($ / week)"), { target: { value: "1400" } });
  fireEvent.change(screen.getByLabelText("Estimated property value ($)"), { target: { value: "1750000" } });
  fireEvent.change(screen.getByLabelText("Guest capacity"), { target: { value: "5" } });
  const corrected = { ...listing, suburb: "Clovelly", postcode: "2031" };
  await act(async () => resolve(Response.json({ listing: corrected, identity_changed: false, address_corrected: true })));
  expect(screen.getByText(/Address updated/)).toBeTruthy();
  await act(async () => { expect((await ref.current!.read())!.values).toMatchObject({ weeklyRent: 1400, propertyValue: 1750000, accommodates: 5 }); });
});

it("recovers a failed automatic match by selecting the exact property and returns the corrected profile", async () => {
  const { listing, report } = createLintRegressionFixtures();
  const candidate = { source: "domain", address: "2/24 Cliffbrook Parade, Coogee NSW 2034", streetAddress: "2/24 Cliffbrook Parade", suburb: "Coogee", state: "NSW", postcode: "2034", slug: "2-24-cliffbrook-parade-coogee-nsw-2034" };
  const corrected = { ...listing, property_address: candidate.streetAddress, suburb: candidate.suburb, postcode: candidate.postcode, latitude: null, longitude: null, hero_image_url: "https://example.test/corrected.jpg", selected_image_urls: ["https://example.test/corrected.jpg"] };
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ error: "No matching property profile was found." }, { status: 400 })).mockResolvedValueOnce(Response.json({ candidates: [candidate] })).mockResolvedValueOnce(Response.json({ listing: corrected, identity_changed: true }));
  vi.stubGlobal("fetch", fetchMock);
  const ref = createRef<StrPropertyHandle>();
  render(<StrPropertyStep ref={ref} listing={listing} report={report} busy={false} calculatorReview onContinue={vi.fn()} />);
  await screen.findByRole("button", { name: "Find the right property" });
  fireEvent.click(screen.getByRole("button", { name: "Find the right property" }));
  expect((screen.getByRole("button", { name: "Confirm property & continue" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => { expect(await ref.current!.read()).toBeNull(); });
  fireEvent.click(screen.getByRole("button", { name: "Find property" }));
  fireEvent.click(await screen.findByRole("button", { name: /2\/24 Cliffbrook Parade, Coogee NSW 2034/ }));
  await waitFor(() => expect((screen.getByRole("button", { name: "Confirm property & continue" }) as HTMLButtonElement).disabled).toBe(false));
  expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ refresh: true, calculatorReview: true, reportId: report.id, candidate });
  expect(screen.getByRole("img", { name: "Property photo 1" }).getAttribute("src")).toBe("https://example.test/corrected.jpg");
  await act(async () => { expect((await ref.current!.read())!.profile).toMatchObject({ property_address: candidate.streetAddress, suburb: candidate.suburb, postcode: candidate.postcode, latitude: null, longitude: null, hero_image_url: "https://example.test/corrected.jpg" }); });
});

it("saves a manually corrected address without provider data and clears details from the previous home", async () => {
  const { listing, report } = createLintRegressionFixtures();
  report.user_overrides_json = null;
  const corrected = { ...listing, property_address: "2/24 Cliffbrook Parade", suburb: "Coogee", state: "NSW", postcode: "2034", latitude: null, longitude: null, hero_image_url: null, selected_image_urls: [], scraped_listing_json: null, car_spaces: null };
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ error: "Property lookup is unavailable." }, { status: 503 })).mockResolvedValueOnce(Response.json({ listing: corrected, identity_changed: true, profile_warning: "No matching property profile was found." }));
  vi.stubGlobal("fetch", fetchMock);
  const ref = createRef<StrPropertyHandle>();
  render(<StrPropertyStep ref={ref} listing={listing} report={report} busy={false} calculatorReview onContinue={vi.fn()} />);
  await screen.findByRole("button", { name: "Find the right property" });
  fireEvent.change(screen.getByLabelText("Long-term rent ($ / week)"), { target: { value: "800" } });
  fireEvent.change(screen.getByLabelText("Estimated property value ($)"), { target: { value: "1450000" } });
  fireEvent.change(screen.getByLabelText("Car spaces"), { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "BBQ" }));
  fireEvent.change(screen.getByLabelText("Add another amenity"), { target: { value: "Tennis court" } });
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  fireEvent.click(screen.getByRole("button", { name: "Find the right property" }));
  fireEvent.click(screen.getByRole("button", { name: "Enter address manually" }));
  for (const [label, value] of [["Street address", "2/24 Cliffbrook Parade"], ["Suburb", "Coogee"], ["State", "NSW"], ["Postcode", "2034"]]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Use this address" }));
  await waitFor(() => expect((screen.getByRole("button", { name: "Confirm property & continue" }) as HTMLButtonElement).disabled).toBe(false));
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ refresh: true, calculatorReview: true, reportId: report.id, address: { property_address: "2/24 Cliffbrook Parade", suburb: "Coogee", state: "NSW", postcode: "2034" } });
  expect(screen.getByText("No property photos found")).toBeTruthy();
  expect(screen.getByText(/No matching property profile was found/)).toBeTruthy();
  expect(screen.getByText(/Address updated. Review the refreshed photos/)).toBeTruthy();
  await act(async () => { const result = await ref.current!.read(); expect(result!.profile).toMatchObject(corrected); expect(result!.values).toMatchObject({ propertyValue: null, weeklyRent: null, car_spaces: null, amenities: [], additionalAmenities: [], bedrooms: 4, bathrooms: 2, accommodates: 8 }); });
});

it("clears old imported rental defaults after an explicit address correction", async () => {
  const { listing, report } = createLintRegressionFixtures();
  report.user_overrides_json = { strProperty: { propertyValue: 1600000, weeklyRent: 1000, amenities: ["pool"], additionalAmenities: [] } };
  const corrected = { ...listing, property_address: "2/24 Cliffbrook Parade", suburb: "Coogee", postcode: "2034", advertised_sale_price: null, advertised_weekly_rent: null, scraped_listing_json: null };
  const candidate = { source: "domain", address: "2/24 Cliffbrook Parade, Coogee NSW 2034", streetAddress: "2/24 Cliffbrook Parade", suburb: "Coogee", state: "NSW", postcode: "2034" };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ listing })).mockResolvedValueOnce(Response.json({ candidates: [candidate] })).mockResolvedValueOnce(Response.json({ listing: corrected, identity_changed: true })));
  render(<StrPropertyStep listing={listing} report={report} busy={false} calculatorReview onContinue={vi.fn()} />);
  await waitFor(() => expect((screen.getByRole("button", { name: "Check or correct address" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Check or correct address" }));
  fireEvent.click(screen.getByRole("button", { name: "Find property" }));
  fireEvent.click(await screen.findByRole("button", { name: /2\/24 Cliffbrook Parade, Coogee NSW 2034/ }));
  await waitFor(() => expect((screen.getByLabelText("Long-term rent ($ / week)") as HTMLInputElement).value).toBe(""));
  expect((screen.getByLabelText("Estimated property value ($)") as HTMLInputElement).value).toBe("");
  expect(screen.getByRole("button", { name: "Pool" }).getAttribute("aria-pressed")).toBe("false");
});

it("keeps the street after a comma-separated unit number when reviewing and searching", async () => {
  const { listing, report } = createLintRegressionFixtures();
  listing.property_address = "Unit 2, 24 Cliffbrook Parade";
  listing.suburb = "Clovelly"; listing.state = "NSW"; listing.postcode = "2031";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ listing })));
  render(<StrPropertyStep listing={listing} report={report} busy={false} calculatorReview onContinue={vi.fn()} />);
  await waitFor(() => expect((screen.getByRole("button", { name: "Check or correct address" }) as HTMLButtonElement).disabled).toBe(false));
  expect(screen.getByText("Unit 2, 24 Cliffbrook Parade, Clovelly, NSW, 2031")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Check or correct address" }));
  expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("Unit 2, 24 Cliffbrook Parade, Clovelly, NSW, 2031");
});

it("does not restore old property overrides after reloading an unfinished address correction", async () => {
  const { listing, report } = createLintRegressionFixtures();
  const oldPropertyKey = calculatorPropertyReviewKey(listing);
  listing.property_address = "2/24 Cliffbrook Parade"; listing.suburb = "Clovelly"; listing.postcode = "2031";
  listing.advertised_sale_price = null; listing.advertised_weekly_rent = null; listing.scraped_listing_json = null; listing.car_spaces = null;
  report.user_overrides_json = { calculatorReview: { status: "pending", propertyKey: oldPropertyKey }, strProperty: { propertyValue: 1600000, weeklyRent: 1000, amenities: ["pool"], additionalAmenities: ["Tennis court"] } };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Property details unavailable." }, { status: 503 })));
  const ref = createRef<StrPropertyHandle>();
  render(<StrPropertyStep ref={ref} listing={listing} report={report} busy={false} calculatorReview onContinue={vi.fn()} />);
  await screen.findByRole("button", { name: "Find the right property" });
  await act(async () => { expect((await ref.current!.read())!.values).toMatchObject({ propertyValue: null, weeklyRent: null, amenities: [], additionalAmenities: [], bedrooms: 4, bathrooms: 2, accommodates: 8 }); });
});

it("restores corrected property details when confirmation saved them but the estimate is still pending", async () => {
  const { listing, report } = createLintRegressionFixtures();
  const oldPropertyKey = calculatorPropertyReviewKey(listing);
  listing.property_address = "2/24 Cliffbrook Parade"; listing.suburb = "Clovelly"; listing.postcode = "2031";
  listing.advertised_sale_price = null; listing.advertised_weekly_rent = null; listing.scraped_listing_json = null;
  report.user_overrides_json = { calculatorReview: { status: "pending", propertyKey: oldPropertyKey, detailsPropertyKey: calculatorPropertyReviewKey(listing) }, strProperty: { propertyValue: 1700000, weeklyRent: 800, amenities: ["wifi"], additionalAmenities: ["Tennis court"] } };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ listing })));
  const ref = createRef<StrPropertyHandle>();
  render(<StrPropertyStep ref={ref} listing={listing} report={report} busy={false} calculatorReview onContinue={vi.fn()} />);
  await waitFor(() => expect((screen.getByRole("button", { name: "Confirm property & continue" }) as HTMLButtonElement).disabled).toBe(false));
  await act(async () => { expect((await ref.current!.read())!.values).toMatchObject({ propertyValue: 1700000, weeklyRent: 800, amenities: ["wifi"], additionalAmenities: ["Tennis court"], bedrooms: 4, bathrooms: 2, accommodates: 8 }); });
});
