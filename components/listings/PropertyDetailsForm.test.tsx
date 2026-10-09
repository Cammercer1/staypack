// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PropertyDetailsForm } from "./PropertyDetailsForm";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
const listing = createEmptyListingDraft({
  id: "property",
  property_address: "1 Test St",
  listing_title: "Original",
  bedrooms: 3,
});
const request = vi.fn();
beforeEach(() => {
  request.mockReset();
  vi.stubGlobal("fetch", request);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function setup() {
  const onSaved = vi.fn();
  const onDirtyChange = vi.fn();
  render(
    <PropertyDetailsForm
      listing={listing}
      onSaved={onSaved}
      onDirtyChange={onDirtyChange}
    />,
  );
  return { onSaved, onDirtyChange };
}
it("validates before saving and retains invalid input", async () => {
  setup();
  fireEvent.change(screen.getByLabelText("Street address"), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText("Enter the property address");
  expect(request).not.toHaveBeenCalled();
});
it("retains edits after network failure and allows discard", async () => {
  setup();
  request.mockRejectedValue(new Error("Network unavailable"));
  fireEvent.change(screen.getByLabelText("Headline"), {
    target: { value: "Revised" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText("Network unavailable");
  expect((screen.getByLabelText("Headline") as HTMLInputElement).value).toBe(
    "Revised",
  );
  fireEvent.click(screen.getByRole("button", { name: "Discard" }));
  expect((screen.getByLabelText("Headline") as HTMLInputElement).value).toBe(
    "Original",
  );
});
it("saves only property fields, preserving photo and agent changes", async () => {
  const { onSaved, onDirtyChange } = setup();
  request.mockResolvedValue({
    ok: true,
    json: async () => ({ listing: { ...listing, listing_title: "Revised" } }),
  });
  fireEvent.change(screen.getByLabelText("Headline"), {
    target: { value: "Revised" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  const body = JSON.parse(request.mock.calls[0][1].body);
  expect(body.listing_title).toBe("Revised");
  expect(body).not.toHaveProperty("listing_agents");
  expect(body).not.toHaveProperty("selected_image_urls");
  expect(body).not.toHaveProperty("listing_purpose");
  await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
});
