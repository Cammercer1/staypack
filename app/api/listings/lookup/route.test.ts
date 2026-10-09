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
vi.mock("@/lib/geocoding/propertyLookup", () => ({
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
