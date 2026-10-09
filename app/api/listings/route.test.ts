import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  duplicate: vi.fn(),
  insert: vi.fn(),
  single: vi.fn(),
}));
vi.mock("@/lib/auth/requireUser", () => ({ requireAgency: mocks.auth }));
vi.mock("@/lib/listings/findExistingProperty", () => ({
  findExistingProperty: mocks.duplicate,
}));
import { POST } from "./route";
const request = (body: unknown) =>
  new Request("http://localhost/api/listings", {
    method: "POST",
    body: JSON.stringify(body),
  });
const photo = "https://example.com/photo.jpg";
const plan = "https://example.com/plan.jpg";
const domainAvm = {
  urlSlug: "18-8-12-ascot-street-kensington-nsw-2033",
  address: "18/8-12 Ascot Street, Kensington NSW 2033",
  valuation: { lowerPrice: 1100000, midPrice: 1200000, upperPrice: 1300000, confidence: "high", date: "2026-10-09" },
  rentalEstimate: { weeklyRent: 1000, confidence: "medium", date: "2026-10-09", yieldPct: 4.3 },
  comparableSales: [],
  matchedAt: "2026-10-09T00:00:00.000Z",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.duplicate.mockResolvedValue(null);
  mocks.single.mockResolvedValue({ data: { id: "saved" }, error: null });
  mocks.insert.mockReturnValue({ select: () => ({ single: mocks.single }) });
  mocks.auth.mockResolvedValue({
    agency: { id: "my-agency" },
    user: { id: "user" },
    supabase: { from: () => ({ insert: mocks.insert }) },
  });
});
it("saves reviewed contacts and media metadata while preserving original property evidence", async () => {
  const response = await POST(
    request({
      property_address: "18/8-12 Ascot Street",
      latitude: -33.9,
      longitude: 151.2,
      bedrooms: 4,
      selected_image_urls: [photo],
      listing_image_meta: {
        [plan]: { role: "floor_plan", label: "Floor plan" },
      },
      listing_agents: [
        {
          name: "Reviewed Agent",
          photo_url: "https://example.com/new-agent.jpg",
        },
      ],
      scraped_listing_json: {
        address: "18/8-12 Ascot Street",
        bedrooms: 3,
        images: [photo, plan],
        agents: [{ name: "Original Agent" }],
        confidence: "high",
        warnings: [],
        domainAvm,
        propertyLookup: {
          source: "domain",
          matchedAt: "2026-10-09",
          originalAgents: [{ name: "Original Agent" }],
          media: [
            {
              url: plan,
              role: "floor_plan",
              current: false,
              date: "2026-06-09",
            },
          ],
        },
      },
    }),
  );
  expect(response.status).toBe(200);
  const inserted = mocks.insert.mock.calls[0][0];
  expect(inserted.agency_id).toBe("my-agency");
  expect(inserted.bedrooms).toBe(4);
  expect(inserted.scraped_listing_json.bedrooms).toBe(3);
  expect(inserted.scraped_listing_json.domainAvm).toEqual(domainAvm);
  expect(inserted.scraped_listing_json.agents[0].name).toBe("Reviewed Agent");
  expect(inserted.scraped_listing_json.agents[0].photo_url).toBe(
    "https://example.com/new-agent.jpg",
  );
  expect(
    inserted.scraped_listing_json.propertyLookup.originalAgents[0].name,
  ).toBe("Original Agent");
  expect(Object.values(inserted.listing_image_meta)).toContainEqual({
    role: "floor_plan",
    label: "Floor plan",
  });
});
it("checks for duplicates again at save time and avoids inserting", async () => {
  mocks.duplicate.mockResolvedValue({ id: "existing" });
  const response = await POST(
    request({ property_address: "18/8-12 Ascot Street" }),
  );
  expect(response.status).toBe(409);
  expect((await response.json()).duplicate.id).toBe("existing");
  expect(mocks.insert).not.toHaveBeenCalled();
});
