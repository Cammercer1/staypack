// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("./UnsavedListingGuard", () => ({ UnsavedListingGuard: () => null }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), message: vi.fn(), error: vi.fn() },
}));
import { NewListingFlow } from "./NewListingFlow";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
const request = vi.fn();
const candidate = {
  source: "domain",
  address: "12/22A New Street, Bondi NSW 2026",
  streetAddress: "12/22A New Street",
  slug: "12-22a-new-street-bondi-nsw-2026",
  suburb: "Bondi",
  state: "NSW",
  postcode: "2026",
};
const photo = "https://example.com/property.jpg";
const portrait = "https://example.com/agent.jpg";
const draft = createEmptyListingDraft({
  property_address: candidate.streetAddress,
  suburb: "Bondi",
  state: "NSW",
  postcode: "2026",
  bedrooms: 2,
  bathrooms: 1,
  selected_image_urls: [photo],
  hero_image_url: photo,
  scraped_listing_json: {
    address: candidate.streetAddress,
    bedrooms: 2,
    images: [photo],
    agents: [{ name: "Listing Agent", photo_url: portrait }],
    confidence: "high",
    warnings: [],
    propertyLookup: {
      source: "domain",
      activeListingId: 2021107984,
      matchedAt: "2026-10-09",
      originalAgents: [{ name: "Listing Agent", photo_url: portrait }],
      media: [{ url: photo, role: "photo", current: true }],
    },
  },
});
const reply = (data: unknown, ok = true) => ({ ok, json: async () => data });
beforeEach(() => {
  vi.clearAllMocks();
  request.mockReset();
  sessionStorage.clear();
  vi.stubGlobal("fetch", request);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function lookup() {
  request
    .mockResolvedValueOnce(reply({ candidates: [candidate] }))
    .mockResolvedValueOnce(reply({ draft }));
  render(<NewListingFlow storageKey="draft-test" />);
  fireEvent.change(await screen.findByLabelText("Property address"), {
    target: { value: candidate.address },
  });
  fireEvent.click(screen.getByRole("button", { name: "Find property" }));
  fireEvent.click(
    await screen.findByRole("button", {
      name: /12\/22A New Street.*Property profile available/,
    }),
  );
  await screen.findByLabelText("Street address");
}
it("previews an active property without creating records, then saves reviewed data and the agent portrait", async () => {
  await lookup();
  expect(
    request.mock.calls.every(([url]) => url === "/api/listings/lookup"),
  ).toBe(true);
  expect((screen.getByLabelText("Car spaces") as HTMLInputElement).value).toBe(
    "",
  );
  expect(screen.queryByLabelText("Photo URL")).toBeNull();
  expect(screen.getByRole("button", { name: "Change photo" })).toBeTruthy();
  expect(screen.getByRole("region", { name: "Agent photo" }).querySelector("img")?.getAttribute("src")).toBe(portrait);
  fireEvent.change(screen.getByLabelText("Bedrooms"), {
    target: { value: "3" },
  });
  request.mockResolvedValueOnce(reply({ listing: { id: "saved" } }));
  fireEvent.click(screen.getByRole("button", { name: "Create listing" }));
  await waitFor(() =>
    expect(navigation.push).toHaveBeenCalledWith("/listings/saved"),
  );
  const [url, options] = request.mock.calls[2];
  const body = JSON.parse(options.body);
  expect(url).toBe("/api/listings");
  expect(body.bedrooms).toBe(3);
  expect(body.car_spaces).toBeNull();
  expect(body.scraped_listing_json.bedrooms).toBe(2);
  expect(body.listing_agents[0].photo_url).toBe(portrait);
  expect(body).not.toHaveProperty("accommodates");
  expect(sessionStorage.getItem("draft-test")).toBeNull();
});
it("retains edits across Back, a failed save, and remounting", async () => {
  await lookup();
  fireEvent.change(screen.getByLabelText("Bedrooms"), {
    target: { value: "4" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Back to property search" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Continue this draft" }));
  expect((screen.getByLabelText("Bedrooms") as HTMLInputElement).value).toBe(
    "4",
  );
  request.mockRejectedValueOnce(new Error("Network unavailable"));
  fireEvent.click(screen.getByRole("button", { name: "Create listing" }));
  await screen.findByText("Network unavailable");
  cleanup();
  render(<NewListingFlow storageKey="draft-test" />);
  await screen.findByText(/unfinished listing has been restored/);
  expect((screen.getByLabelText("Bedrooms") as HTMLInputElement).value).toBe(
    "4",
  );
  expect(screen.queryByLabelText("Photo URL")).toBeNull();
  expect(screen.getByRole("region", { name: "Agent photo" }).querySelector("img")?.getAttribute("src")).toBe(portrait);
  expect(navigation.push).not.toHaveBeenCalled();
});
it("keeps manual entry available after lookup failure and validates unknown counts", async () => {
  request.mockRejectedValueOnce(new Error("Lookup unavailable"));
  render(<NewListingFlow storageKey="draft-test" />);
  fireEvent.change(await screen.findByLabelText("Property address"), {
    target: { value: candidate.address },
  });
  fireEvent.click(screen.getByRole("button", { name: "Find property" }));
  await screen.findByText("Lookup unavailable");
  fireEvent.click(
    screen.getByRole("button", { name: "Enter details manually" }),
  );
  expect(screen.getByText("Manual entry")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Bedrooms"), {
    target: { value: "-1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create listing" }));
  await screen.findByText(/whole number from 0 to 100/);
  expect(request).toHaveBeenCalledTimes(1);
});
it("opens a duplicate from the library without allowing another preview to create it", async () => {
  request
    .mockResolvedValueOnce(reply({ candidates: [candidate] }))
    .mockResolvedValueOnce(
      reply({
        duplicate: {
          id: "existing",
          property_address: candidate.streetAddress,
          suburb: "Bondi",
        },
      }),
    );
  render(<NewListingFlow storageKey="draft-test" />);
  fireEvent.change(await screen.findByLabelText("Property address"), {
    target: { value: candidate.address },
  });
  fireEvent.click(screen.getByRole("button", { name: "Find property" }));
  fireEvent.click(
    await screen.findByRole("button", {
      name: /12\/22A New Street.*Property profile available/,
    }),
  );
  expect(
    (
      await screen.findByRole("link", { name: "Open existing listing" })
    ).getAttribute("href"),
  ).toBe("/listings/existing");
  expect(screen.queryByRole("button", { name: "Create listing" })).toBeNull();
});
it("requires explicit selection of historical photos, keeping floor plans out of the count", async () => {
  const historical = structuredClone(draft);
  historical.hero_image_url = null;
  historical.selected_image_urls = [];
  historical.scraped_listing_json!.agents = [];
  historical.scraped_listing_json!.propertyLookup = {
    source: "domain",
    matchedAt: "2026-10-09",
    media: [
      { url: photo, role: "photo", current: false, date: "2026-06-09" },
      {
        url: "https://example.com/plan.jpg",
        role: "floor_plan",
        current: false,
        date: "2026-06-09",
      },
    ],
  };
  request.mockResolvedValueOnce(reply({ draft: historical }));
  render(<NewListingFlow storageKey="draft-test" />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Import listing URL" }),
  );
  fireEvent.change(screen.getByLabelText("Listing URL"), {
    target: { value: "https://example.com/listing" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Import listing" }));
  await screen.findByText(/0 of 25 selected/);
  fireEvent.click(screen.getByRole("button", { name: "Select latest photos" }));
  await screen.findByText(/1 of 25 selected/);
  expect(screen.queryByLabelText("Photo URL")).toBeNull();
});
