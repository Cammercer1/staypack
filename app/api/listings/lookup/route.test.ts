import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  search: vi.fn(),
  select: vi.fn(),
  domainImport: vi.fn(),
  googleSearch: vi.fn(),
  googleSelect: vi.fn(),
  duplicate: vi.fn(),
  scrape: vi.fn(),
}));
vi.mock("@/lib/auth/requireUser", () => ({ requireAgency: mocks.auth }));
vi.mock("@/lib/domain-avm/propertyLookup", () => ({
  searchDomainProperties: mocks.search,
  lookupDomainProperty: mocks.select,
  importDomainProperty: mocks.domainImport,
}));
vi.mock("@/lib/geocoding/propertyLookup", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/geocoding/propertyLookup")>(),
  searchGoogleProperties: mocks.googleSearch,
  lookupGoogleProperty: mocks.googleSelect,
}));
vi.mock("@/lib/listings/findExistingProperty", () => ({
  findExistingProperty: mocks.duplicate,
}));
vi.mock("@/lib/scraping/extractListing", () => ({
  extractListingFromUrl: mocks.scrape,
}));
import { POST } from "./route";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
const request = (body: unknown) =>
  new Request("http://localhost/api/listings/lookup", {
    method: "POST",
    body: JSON.stringify(body),
  });
const candidate = {
  source: "domain",
  slug: "18-8-12-ascot-street-kensington-nsw-2033",
  address: "18/8-12 Ascot Street Kensington NSW 2033",
  streetAddress: "18/8-12 Ascot Street",
  suburb: "Kensington",
  state: "NSW",
  postcode: "2033",
};
const database = { from: vi.fn() };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({
    supabase: database,
    agency: { id: "agency" },
  });
  mocks.search.mockResolvedValue([candidate]);
  mocks.duplicate.mockResolvedValue(null);
  mocks.select.mockResolvedValue(
    createEmptyListingDraft({ property_address: candidate.streetAddress }),
  );
});
it("authorizes before any paid API call", async () => {
  mocks.auth.mockRejectedValue(new Error("Not signed in"));
  expect(
    (await POST(request({ action: "search", query: candidate.address })))
      .status,
  ).toBe(400);
  expect(mocks.search).not.toHaveBeenCalled();
  expect(database.from).not.toHaveBeenCalled();
});
it("uses Google address suggestions if the property provider is unavailable", async () => {
  mocks.search.mockRejectedValue(new Error("Rate limit"));
  mocks.googleSearch.mockResolvedValue([{ ...candidate, source: "google" }]);
  const result = await (
    await POST(request({ action: "search", query: candidate.address }))
  ).json();
  expect(result.candidates[0].source).toBe("google");
  expect(result.message).toContain("manually");
});
it("returns an agency-scoped duplicate without a paid details lookup", async () => {
  mocks.duplicate.mockResolvedValue({ id: "existing" });
  const result = await (
    await POST(request({ action: "select", candidate, agency_id: "other" }))
  ).json();
  expect(result.duplicate.id).toBe("existing");
  expect(mocks.duplicate).toHaveBeenCalledWith(
    database,
    "agency",
    expect.objectContaining({ property_address: candidate.streetAddress }),
  );
  expect(mocks.select).not.toHaveBeenCalled();
});
it("previews address imports without creating a listing or agent", async () => {
  const result = await (
    await POST(request({ action: "select", candidate }))
  ).json();
  expect(result.draft.id).toBe("");
  expect(result.draft.property_address).toBe(candidate.streetAddress);
  expect(database.from).not.toHaveBeenCalled();
});
it("tries the Domain API before scraping a URL", async () => {
  mocks.domainImport.mockResolvedValue(
    createEmptyListingDraft({ property_address: candidate.streetAddress }),
  );
  expect(
    (
      await POST(
        request({
          action: "import",
          url: "https://www.domain.com.au/example-2021107984",
        }),
      )
    ).status,
  ).toBe(200);
  expect(mocks.scrape).not.toHaveBeenCalled();
  expect(database.from).not.toHaveBeenCalled();
});
it("falls back to a scrape preview and preserves floor-plan roles", async () => {
  mocks.domainImport.mockResolvedValue(null);
  mocks.scrape.mockResolvedValue({
    listing: {
      address: "1 Test Street",
      images: [
        "https://example.com/photo.jpg",
        "https://example.com/floorplan.jpg",
      ],
      agents: [],
      confidence: "high",
      warnings: [],
    },
  });
  const result = await (
    await POST(
      request({ action: "import", url: "https://example.com/listing" }),
    )
  ).json();
  expect(result.draft.selected_image_urls).toEqual([
    "https://example.com/photo.jpg",
  ]);
  expect(result.draft.scraped_listing_json.propertyLookup.media[1].role).toBe(
    "floor_plan",
  );
  expect(database.from).not.toHaveBeenCalled();
});
it.each(["http://localhost:3000/", "http://127.0.0.1/", "file:///etc/passwd"])(
  "rejects non-public URL input: %s",
  async (url) => {
    expect((await POST(request({ action: "import", url }))).status).toBe(400);
    expect(mocks.scrape).not.toHaveBeenCalled();
  },
);

vi.mock("@/lib/us-property/lookup", () => ({ lookupUsProperty: vi.fn(), importUsProperty: vi.fn() }));
vi.mock("@/lib/geocoding/places", () => ({ searchPlaceProperties: vi.fn() }));
const usCandidate = { source: "google", country: "US", address: "616 N Croft Ave Apt 2, West Hollywood CA 90048", streetAddress: "616 N Croft Ave Apt 2", suburb: "West Hollywood", state: "CA", postcode: "90048", placeId: "croft" };
function usAccount() { mocks.auth.mockResolvedValue({ supabase: database, agency: { id: "agency", country_code: "US" } }); }
it("uses account country for US Google Places searches even when the request omits it", async () => {
  usAccount();
  const { searchPlaceProperties } = await import("@/lib/geocoding/places");
  vi.mocked(searchPlaceProperties).mockResolvedValue([usCandidate as import("@/lib/listings/propertyLookupTypes").PropertyCandidate]);
  const result = await (await POST(request({ action: "search", query: usCandidate.address }))).json();
  expect(result.candidates[0].source).toBe("google");
  expect(searchPlaceProperties).toHaveBeenCalledWith(usCandidate.address, "US");
  expect(mocks.search).not.toHaveBeenCalled();
  expect(mocks.googleSearch).not.toHaveBeenCalled();
});
it.each(["AU", "US"] as const)("rejects a country override for a %s account before provider calls", async country => {
  mocks.auth.mockResolvedValue({ agency: { country_code: country } });
  const response = await POST(request({ action: "search", country: country === "AU" ? "US" : "AU", query: candidate.address }));
  expect(response.status).toBe(400);
  expect(mocks.search).not.toHaveBeenCalled();
  const { searchPlaceProperties } = await import("@/lib/geocoding/places");
  expect(searchPlaceProperties).not.toHaveBeenCalled();
});
it("verifies the Google place and enriches US property details through Zillow", async () => {
  usAccount();
  const { lookupUsProperty } = await import("@/lib/us-property/lookup");
  const draft = createEmptyListingDraft({ country: "United States", property_address: usCandidate.streetAddress, state: "CA", postcode: "90048" });
  mocks.googleSelect.mockResolvedValue(draft);
  vi.mocked(lookupUsProperty).mockResolvedValue({ ...draft, bedrooms: 3 });
  const result = await (await POST(request({ action: "select", candidate: usCandidate }))).json();
  expect(result.draft.country).toBe("United States");
  expect(result.draft.bedrooms).toBe(3);
  expect(mocks.googleSelect).toHaveBeenCalledWith(usCandidate);
  expect(lookupUsProperty).toHaveBeenCalledWith(usCandidate);
  expect(mocks.select).not.toHaveBeenCalled();
});
it("keeps the verified US address editable when its exact profile cannot be retrieved", async () => {
  usAccount();
  const { lookupUsProperty } = await import("@/lib/us-property/lookup");
  vi.mocked(lookupUsProperty).mockRejectedValue(new Error("Profile mismatch"));
  mocks.googleSelect.mockResolvedValue(createEmptyListingDraft({ country: "United States", property_address: usCandidate.streetAddress, state: "CA", postcode: "90048" }));
  const response = await POST(request({ action: "select", candidate: usCandidate }));
  expect(response.status).toBe(200);
  const { draft } = await response.json();
  expect(draft).toMatchObject({ country: "United States", property_address: usCandidate.streetAddress, state: "CA", postcode: "90048" });
  expect(draft.scraped_listing_json?.usProperty).toBeUndefined();
});
it("rejects a forged Google place before calling Zillow", async () => {
  usAccount();
  mocks.googleSelect.mockRejectedValue(new Error("Choose a property in United States"));
  expect((await POST(request({ action: "select", candidate: usCandidate }))).status).toBe(400);
  expect((await import("@/lib/us-property/lookup")).lookupUsProperty).not.toHaveBeenCalled();
});
it.each(["AU", "US"] as const)("rejects overseas property links for a %s account", async country => {
  mocks.auth.mockResolvedValue({ agency: { country_code: country } });
  const response = await POST(request({ action: "import", url: country === "AU" ? "https://www.zillow.com/homedetails/123_zpid/" : "https://www.domain.com.au/example-2021107984" }));
  expect(response.status).toBe(400);
  expect((await import("@/lib/us-property/lookup")).importUsProperty).not.toHaveBeenCalled();
  expect(mocks.domainImport).not.toHaveBeenCalled();
  expect(mocks.scrape).not.toHaveBeenCalled();
});
it("rejects an overseas selection without performing a duplicate lookup", async () => {
  expect((await POST(request({ action: "select", candidate: usCandidate }))).status).toBe(400);
  expect(mocks.duplicate).not.toHaveBeenCalled();
});
