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
import { AgencyCountryProvider } from "@/components/properties/AgencyCountryProvider";
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
async function lookup(includeAgents = true) {
  request
    .mockResolvedValueOnce(reply({ candidates: [candidate] }))
    .mockResolvedValueOnce(reply({ draft }));
  render(<NewListingFlow storageKey="draft-test" includeAgents={includeAgents} />);
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
it("starts with the address transferred from the property library without looking it up automatically", async () => {
  const address = "7/2-4 Dolphin Street, Randwick, NSW 2031";
  const onQueryChange = vi.fn();
  render(<NewListingFlow storageKey="draft-test" initialQuery={address} onQueryChange={onQueryChange} />);
  const input = await screen.findByLabelText("Property address");
  expect(input).toHaveProperty("value", address);
  expect(request).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: `${address} Australia` } });
  expect(onQueryChange).toHaveBeenLastCalledWith(`${address} Australia`);
});
it("prefills a new library search while retaining the previous reviewed property draft", async () => {
  await lookup();
  fireEvent.change(screen.getByLabelText("Bedrooms"), { target: { value: "4" } });
  cleanup();
  const address = "7/2-4 Dolphin Street, Randwick, NSW 2031";
  render(<NewListingFlow storageKey="draft-test" initialQuery={address} />);
  expect(await screen.findByLabelText("Property address")).toHaveProperty("value", address);
  expect(screen.getByText(/Choosing another property will replace it/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Continue this draft" }));
  expect(screen.getByLabelText("Street address")).toHaveProperty("value", candidate.streetAddress);
  expect(screen.getByLabelText("Bedrooms")).toHaveProperty("value", "4");
});
it("opens an incoming library address in address mode after an earlier URL import", async () => {
  render(<NewListingFlow storageKey="draft-test" initialQuery={candidate.address} />);
  fireEvent.click(await screen.findByRole("button", { name: "Import listing URL" }));
  cleanup();
  render(<NewListingFlow storageKey="draft-test" initialQuery={candidate.address} />);
  expect(await screen.findByLabelText("Property address")).toHaveProperty("value", candidate.address);
  expect(screen.queryByLabelText("Listing URL")).toBeNull();
});
it("automatically looks up the completed unit/range address after choosing a suggestion", async () => {
  const address = "21/8-12 Ascot Street, Kensington NSW 2033";
  request.mockResolvedValueOnce(reply({ suggestions: [{ placeId: "building", address: "21/8-12 Ascot Street, Kensington NSW", mainText: "21/8-12 Ascot Street", secondaryText: "Kensington NSW" }] }))
    .mockResolvedValueOnce(reply({ address }))
    .mockResolvedValueOnce(reply({ candidates: [{ ...candidate, address, streetAddress: "21/8-12 Ascot Street" }] }));
  render(<NewListingFlow storageKey="draft-test" />);
  const input = await screen.findByLabelText("Property address");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "21/8-12 ascot st" } });
  fireEvent.click(await screen.findByRole("option", { name: /21\/8-12 Ascot Street/ }));
  await screen.findByRole("button", { name: /21\/8-12 Ascot Street.*Property profile available/ });
  const lookups = request.mock.calls.filter(([url]) => url === "/api/listings/lookup");
  expect(lookups).toHaveLength(1);
  expect(JSON.parse(lookups[0][1].body)).toEqual({ action: "search", query: address, country: "AU" });
  expect((input as HTMLInputElement).value).toBe(address);
});
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
it.each(["imported", "restored"])("omits agent selection and attachment for %s properties when agents belong to the proposal", async (source) => {
  await lookup(source === "restored");
  if (source === "restored") {
    cleanup();
    render(<NewListingFlow storageKey="draft-test" includeAgents={false} />);
    await screen.findByText(/unfinished listing has been restored/);
  }
  expect(screen.queryByText("Listing agents")).toBeNull();
  expect(screen.queryByRole("button", { name: "Add agent" })).toBeNull();
  request.mockResolvedValueOnce(reply({ listing: { id: "saved" } }));
  fireEvent.click(screen.getByRole("button", { name: "Create listing" }));
  await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/listings/saved"));
  const saved = JSON.parse(request.mock.calls.find(([url]) => url === "/api/listings")![1].body);
  expect(saved.listing_agents).toEqual([]);
  expect(saved.scraped_listing_json.agents[0].name).toBe("Listing Agent");
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
it("imports a pasted Zillow link directly from the address box without geocoding or changing modes", async () => {
  const url = "https://www.zillow.com/homedetails/616-N-Croft-Ave-APT-2/333350724_zpid/?utm_campaign=share";
  request.mockResolvedValueOnce(reply({ draft: createEmptyListingDraft({ country: "United States", property_address: "616 N Croft Ave Apt 2", suburb: "West Hollywood", state: "CA", postcode: "90048" }) }));
  render(<AgencyCountryProvider country="US"><NewListingFlow storageKey="draft-test" /></AgencyCountryProvider>);
  fireEvent.change(await screen.findByLabelText("Property address"), { target: { value: url } });
  fireEvent.click(screen.getByRole("button", { name: "Import listing" }));
  await screen.findByLabelText("Street address");
  expect(request).toHaveBeenCalledTimes(1);
  expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ country: "US", action: "import", url });
  expect((screen.getByLabelText("Street address") as HTMLInputElement).value).toBe("616 N Croft Ave Apt 2");
});
it("labels a confirmed US profile correctly and keeps all address fields when entering details manually", async () => {
  const usCandidate = { ...candidate, source: "zillow", country: "US", address: "616 N Croft Ave Apt 2, West Hollywood CA 90048", streetAddress: "616 N Croft Ave Apt 2", suburb: "West Hollywood", state: "CA", postcode: "90048", zpid: "333350724" };
  request.mockResolvedValueOnce(reply({ candidates: [usCandidate] }));
  render(<AgencyCountryProvider country="US"><NewListingFlow storageKey="draft-test" /></AgencyCountryProvider>);
  await screen.findByLabelText("Property address");
  expect(screen.queryByLabelText("Country")).toBeNull();
  fireEvent.change(screen.getByLabelText("Property address"), { target: { value: usCandidate.address } });
  fireEvent.click(screen.getByRole("button", { name: "Find property" }));
  await screen.findByRole("button", { name: /616 N Croft.*Property profile available/ });
  fireEvent.click(screen.getByRole("button", { name: "Enter details manually" }));
  expect((await screen.findByLabelText("Street address") as HTMLInputElement).value).toBe(usCandidate.streetAddress);
  expect((screen.getByLabelText("ZIP code") as HTMLInputElement).value).toBe("90048");
});
