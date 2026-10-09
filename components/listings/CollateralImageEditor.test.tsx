// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CollateralImageEditor } from "./CollateralImageEditor";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
vi.mock("@/components/reports/ReportMediaPicker", () => ({
  ReportMediaPicker: ({
    onChange,
  }: {
    onChange: (hero: string, selected: string[]) => void;
  }) => (
    <button
      onClick={() =>
        onChange("https://example.com/one.jpg", ["https://example.com/one.jpg"])
      }
    >
      Deselect second photo
    </button>
  ),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const images = ["https://example.com/one.jpg", "https://example.com/two.jpg"];
const listing = createEmptyListingDraft({
  id: "listing",
  hero_image_url: images[0],
  selected_image_urls: images,
  scraped_listing_json: {
    images,
    agents: [],
    warnings: [],
    confidence: "high",
  },
});
it("does not silently reselect deselected images when saving", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        listing: { ...listing, selected_image_urls: [images[0]] },
      }),
    });
  vi.stubGlobal("fetch", fetch);
  render(<CollateralImageEditor listing={listing} onUpdated={vi.fn()} />);
  fireEvent.click(screen.getByText("Deselect second photo"));
  fireEvent.click(screen.getByRole("button", { name: "Save photos" }));
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  expect(JSON.parse(fetch.mock.calls[0][1].body).selected_image_urls).toEqual([
    images[0],
  ]);
});
it("select all changes the draft without writing until Save", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  render(
    <CollateralImageEditor
      listing={{ ...listing, selected_image_urls: [images[0]] }}
      onUpdated={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Select all" }));
  expect(fetch).not.toHaveBeenCalled();
  expect(
    screen
      .getByRole("button", { name: "Save photos" })
      .hasAttribute("disabled"),
  ).toBe(false);
});
