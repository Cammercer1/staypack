// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
import { ListingLibrary } from "./ListingLibrary";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(cleanup);

const listings = [
  createEmptyListingDraft({
    id: "sale",
    property_address: "12 Ocean Street",
    suburb: "Bondi",
    listing_purpose: "sale",
    created_at: "2026-10-01T00:00:00Z",
  }),
  createEmptyListingDraft({
    id: "lease",
    property_address: "2 Ocean Street",
    suburb: "Bondi",
    listing_purpose: "lease",
    created_at: "2026-10-02T00:00:00Z",
  }),
];

it("searches across listings and recovers from no results", () => {
  render(<ListingLibrary listings={listings} />);
  expect(screen.getByRole("link", { name: "12 Ocean Street" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "2 Ocean Street" })).toBeTruthy();
  fireEvent.change(screen.getByRole("searchbox", { name: "Search listings" }), {
    target: { value: "missing" },
  });
  expect(
    screen.getByRole("heading", { name: "No matching properties" }),
  ).toBeTruthy();
  fireEvent.click(screen.getAllByRole("button", { name: "Clear search" })[0]);
  expect(screen.getByRole("link", { name: "12 Ocean Street" })).toBeTruthy();
  expect(screen.getByRole("status").textContent).toContain("2 listings");
});

it("changes the listing order using the sort control", () => {
  render(<ListingLibrary listings={listings} />);
  const addresses = () =>
    screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
  expect(addresses()).toEqual(["2 Ocean Street", "12 Ocean Street"]);
  fireEvent.change(screen.getByRole("combobox", { name: "Sort listings" }), {
    target: { value: "oldest" },
  });
  expect(addresses()).toEqual(["12 Ocean Street", "2 Ocean Street"]);
});

it("gives an empty library a working create-listing destination", () => {
  render(<ListingLibrary listings={[]} />);
  expect(
    screen
      .getByRole("link", { name: "Create your first listing" })
      .getAttribute("href"),
  ).toBe("/listings/new");
  expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
});
