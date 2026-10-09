// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ListingAgentsStrip } from "./ListingAgentsStrip";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
const alex = {
  name: "Alex",
  email: "alex@example.com",
  phone: "0412345678",
  role_title: "Agent",
  photo_url: "",
};
const listing = createEmptyListingDraft({
  id: "listing",
  scraped_listing_json: {
    images: [],
    agents: [alex],
    warnings: [],
    confidence: "high",
  },
});
const profiles = [
  { ...alex, id: "alex" },
  { id: "bea", name: "Bea", email: "bea@example.com", phone: "0400111222" },
  { id: "archived", name: "Archived Agent", archived_at: "2026-01-01" },
];
const request = vi.fn();
beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({
    ok: true,
    json: async () => ({ agents: profiles }),
  });
  vi.stubGlobal("fetch", request);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function setup() {
  const saved = vi.fn();
  render(<ListingAgentsStrip listing={listing} onUpdated={saved} />);
  fireEvent.click(screen.getByRole("button", { name: "Manage agents" }));
  await screen.findByText("Bea");
  return saved;
}
it("searches agency contacts and excludes archived profiles", async () => {
  await setup();
  expect(screen.queryByText("Archived Agent")).toBeNull();
  fireEvent.change(screen.getByLabelText("Find an agency agent"), {
    target: { value: "bea@" },
  });
  expect(screen.getByText("Bea")).toBeTruthy();
  expect(screen.queryByText("Assigned")).toBeNull();
});
it("keeps removals local until save and provides undo", async () => {
  await setup();
  fireEvent.click(
    screen.getByRole("button", { name: "Remove Alex from listing" }),
  );
  expect(request).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Undo removal" }));
  expect(
    screen
      .getByRole("button", { name: "Save agents" })
      .hasAttribute("disabled"),
  ).toBe(true);
});
it("requires discard before closing a changed assignment", async () => {
  await setup();
  fireEvent.click(
    screen.getByRole("button", { name: "Remove Alex from listing" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(
    await screen.findByRole("dialog", { name: "Discard agent changes?" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
  expect(request).toHaveBeenCalledTimes(1);
});
it("retains the draft on save failure and permits retry", async () => {
  const saved = await setup();
  fireEvent.click(
    screen.getByRole("button", { name: "Remove Alex from listing" }),
  );
  request.mockResolvedValueOnce({
    ok: false,
    json: async () => ({ error: "Save failed" }),
  });
  fireEvent.click(screen.getByRole("button", { name: "Save agents" }));
  await screen.findByText("Save failed");
  expect(saved).not.toHaveBeenCalled();
  request.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      listing: {
        ...listing,
        scraped_listing_json: { ...listing.scraped_listing_json, agents: [] },
      },
    }),
  });
  fireEvent.click(screen.getByRole("button", { name: "Save agents" }));
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(JSON.parse(request.mock.calls[2][1].body)).toEqual({
    listing_agents: [],
  });
});
