// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { PropertyStartFlow } from "./PropertyStartFlow";
const fixtures = createLintRegressionFixtures();
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }));
vi.mock("@/components/listings/ListingThumbnail", () => ({ ListingThumbnail: () => <span>Photo</span> }));
vi.mock("@/components/listings/NewListingFlow", () => ({ NewListingFlow: ({ onSaved }: { onSaved: (id: string) => void }) => <button onClick={() => onSaved("existing")}>Use matched property</button> }));
vi.mock("./PropertySetup", () => ({ PropertySetup: ({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) => <><button onClick={() => onDirtyChange(true)}>Edit property</button><button onClick={() => onDirtyChange(false)}>Save property</button></> }));
vi.mock("@/components/str-appraisals/useRemoteOptions", async importOriginal => ({ ...await importOriginal<object>(), useRemoteOptions: () => ({ loading: false, error: null, data: [{ id: "existing", property_address: "Saved property", hero_image_url: null }] }) }));
beforeEach(() => { window.history.replaceState(null, "", "/social/new"); vi.stubGlobal("fetch", vi.fn(async () => Response.json({ listing: fixtures.listing }))); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("keeps property context in the URL and resumes a failed continuation", async () => {
  const proceed = vi.fn().mockRejectedValueOnce(new Error("Temporarily unavailable")).mockResolvedValue(undefined);
  render(<PropertyStartFlow initialListing={null} storageKey="test" continueLabel="Continue" onContinue={proceed} />);
  fireEvent.click(screen.getByRole("button", { name: /Saved property/ }));
  await screen.findByRole("button", { name: "Continue" });
  expect(new URLSearchParams(window.location.search).get("listing_id")).toBe(fixtures.listing.id);
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Temporarily unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await waitFor(() => expect(proceed).toHaveBeenCalledTimes(2));
  expect(proceed).toHaveBeenLastCalledWith(fixtures.listing);
});
it("blocks navigation while property changes are unsaved, including repeated edit-details clicks", async () => {
  render(<PropertyStartFlow initialListing={fixtures.listing} storageKey="test" continueLabel="Continue" onContinue={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit details/photos" }));
  fireEvent.click(screen.getByRole("button", { name: "Edit property" }));
  fireEvent.click(screen.getByRole("button", { name: "Edit details/photos" }));
  expect(screen.getByRole("button", { name: "Continue" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "Change property" })).toHaveProperty("disabled", true);
  fireEvent.click(screen.getByRole("button", { name: "Save property" }));
  expect(screen.getByRole("button", { name: "Continue" })).toHaveProperty("disabled", false);
});
it("keeps the import intent and uses a duplicate match without creating a second property", async () => {
  window.history.replaceState(null, "", "/appraisals/new?kind=lease");
  render(<PropertyStartFlow initialListing={null} storageKey="test" continueLabel="Continue" onContinue={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Import or add property" }));
  expect(window.location.search).toContain("kind=lease");
  expect(window.location.search).toContain("mode=import");
  fireEvent.click(screen.getByRole("button", { name: "Use matched property" }));
  await screen.findByRole("button", { name: "Continue" });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith("/api/listings/existing", { cache: "no-store" });
});
