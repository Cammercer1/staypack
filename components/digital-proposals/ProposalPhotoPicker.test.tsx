// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProposalPhotoPicker, type ProposalPhotoPickerProps } from "./ProposalPhotoPicker";

const photos = ["https://example.com/front.jpg", "https://example.com/living.jpg", "https://example.com/bed.jpg"];
const value = { heroImageUrl: photos[0], gallery: photos.slice(0, 2) };
function renderPicker(overrides: Partial<ProposalPhotoPickerProps> = {}) {
  const props = { open: true, onOpenChange: vi.fn(), availablePhotos: photos, value, onSave: vi.fn().mockResolvedValue(true), ...overrides };
  return { ...render(<ProposalPhotoPicker {...props} />), props };
}
const checkbox = (index: number) => screen.getByRole("checkbox", { name: `Select photo ${index}` }) as HTMLInputElement;
const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;
afterEach(cleanup);

it("keeps the cover included and saves local choices only after explicit Save", async () => {
  const { props } = renderPicker();
  expect(screen.getByRole("dialog", { name: "Proposal photos" })).toBeTruthy();
  expect(screen.getByText(/Other photos appear only in template photo sections or supported PDF layouts/)).toBeTruthy();
  expect(checkbox(1).checked).toBe(true);
  expect(checkbox(1).disabled).toBe(true);
  fireEvent.click(button("Make photo 3 the cover"));
  expect(checkbox(3).checked).toBe(true);
  expect(checkbox(3).disabled).toBe(true);
  expect(checkbox(1).disabled).toBe(false);
  fireEvent.click(checkbox(1));
  expect(screen.getByRole("status").textContent).toBe("2 of 25 photos selected");
  expect(props.onSave).not.toHaveBeenCalled();
  fireEvent.click(button("Save photos"));
  await waitFor(() => expect(props.onOpenChange).toHaveBeenCalledWith(false));
  expect(props.onSave).toHaveBeenCalledExactlyOnceWith({ heroImageUrl: photos[2], gallery: [photos[1], photos[2]] });
});

it("blocks dismissal and duplicate submissions during saving, preserving choices after failure", async () => {
  let finish!: (saved: boolean) => void;
  const onSave = vi.fn(() => new Promise<boolean>(resolve => { finish = resolve; }));
  const { props } = renderPicker({ onSave });
  fireEvent.click(button("Make photo 3 the cover"));
  const save = button("Save photos");
  fireEvent.click(save);
  fireEvent.click(save);
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(button("Saving photos…").disabled).toBe(true);
  expect(button("Cancel").disabled).toBe(true);
  expect(button("Cancel photo changes").disabled).toBe(true);
  expect(checkbox(2).disabled).toBe(true);
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape", code: "Escape" });
  expect(props.onOpenChange).not.toHaveBeenCalled();
  await act(async () => finish(false));
  expect(screen.getByRole("alert").textContent).toContain("Your choices are kept");
  expect(button("Photo 3 is the cover photo")).toBeTruthy();
  expect(checkbox(3).checked).toBe(true);
  expect(button("Cancel").disabled).toBe(false);
  fireEvent.click(button("Cancel"));
  expect(props.onOpenChange).toHaveBeenCalledWith(false);
});

it("shows the detailed parent error without a duplicate generic alert", async () => {
  const onSave = vi.fn().mockResolvedValue(false);
  const { rerender, props } = renderPicker({ onSave });
  fireEvent.click(button("Save photos"));
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  rerender(<ProposalPhotoPicker {...props} error="This proposal was changed elsewhere. Reload before saving." />);
  expect(screen.getAllByRole("alert")).toHaveLength(1);
  expect(screen.getByRole("alert").textContent).toBe("This proposal was changed elsewhere. Reload before saving.");
  expect(button("Save photos").disabled).toBe(false);
});

it("allows retry after an unexpected save rejection", async () => {
  const onSave = vi.fn().mockRejectedValueOnce(new Error("Connection lost. Try again.")).mockResolvedValueOnce(true);
  const { props } = renderPicker({ onSave });
  fireEvent.click(checkbox(2));
  fireEvent.click(button("Save photos"));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Connection lost. Try again."));
  fireEvent.click(button("Save photos"));
  await waitFor(() => expect(props.onOpenChange).toHaveBeenCalledWith(false));
  expect(onSave).toHaveBeenLastCalledWith({ heroImageUrl: photos[0], gallery: [photos[0]] });
});

it("protects dirty choices on browser navigation and resets them on a fresh opening", async () => {
  const { unmount, props } = renderPicker();
  const pristine = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(pristine);
  expect(pristine.defaultPrevented).toBe(false);
  fireEvent.click(checkbox(2));
  const dirty = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(dirty);
  expect(dirty.defaultPrevented).toBe(true);
  fireEvent.click(button("Cancel"));
  expect(props.onSave).not.toHaveBeenCalled();
  unmount();
  renderPicker();
  expect(checkbox(2).checked).toBe(true);
  const reopened = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(reopened);
  expect(reopened.defaultPrevented).toBe(false);
});

it("removes the unsaved navigation guard when photos save successfully", async () => {
  renderPicker();
  fireEvent.click(checkbox(2));
  fireEvent.click(button("Save photos"));
  await waitFor(() => expect(button("Save photos").disabled).toBe(false));
  const saved = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(saved);
  expect(saved.defaultPrevented).toBe(false);
});

it("caps existing photo selections at 25 while preserving the cover and explains how to replace a photo", async () => {
  const availablePhotos = Array.from({ length: 27 }, (_, index) => `https://example.com/${index}.jpg`);
  const onSave = vi.fn<ProposalPhotoPickerProps["onSave"]>().mockResolvedValue(true);
  renderPicker({ onSave, availablePhotos, value: { heroImageUrl: availablePhotos[26], gallery: availablePhotos } });
  expect(screen.getByRole("status").textContent).toBe("25 of 25 photos selected");
  expect(checkbox(27).checked).toBe(true);
  expect(checkbox(27).disabled).toBe(true);
  expect(checkbox(25).checked).toBe(false);
  expect(button("Make photo 25 the cover").disabled).toBe(true);
  expect(checkbox(25).disabled).toBe(true);
  expect(screen.getByText(/25-photo limit reached/)).toBeTruthy();
  fireEvent.click(checkbox(1));
  expect(button("Make photo 25 the cover").disabled).toBe(false);
  fireEvent.click(button("Make photo 25 the cover"));
  expect(screen.getByRole("status").textContent).toBe("25 of 25 photos selected");
  expect(checkbox(25).checked).toBe(true);
  expect(checkbox(25).disabled).toBe(true);
  fireEvent.click(button("Save photos"));
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  const saved = onSave.mock.calls[0][0];
  expect(saved.heroImageUrl).toBe(availablePhotos[24]);
  expect(saved.gallery).toHaveLength(25);
  expect(new Set(saved.gallery).size).toBe(25);
});

it("deduplicates photos and adds an omitted cover to the selected photos", () => {
  renderPicker({ availablePhotos: [photos[0], photos[0], photos[1]], value: { heroImageUrl: photos[2], gallery: [photos[1], photos[1]] } });
  expect(screen.getAllByRole("article")).toHaveLength(3);
  expect(checkbox(3).checked).toBe(true);
  expect(checkbox(3).disabled).toBe(true);
  expect(screen.getByRole("status").textContent).toBe("2 of 25 photos selected");
});

it("provides an empty state when there are no photos and keeps Cancel available", () => {
  renderPicker({ availablePhotos: [], value: { heroImageUrl: "", gallery: [] }, disabled: true });
  expect(screen.getByText("No property photos available")).toBeTruthy();
  expect(button("Save photos").disabled).toBe(true);
  expect(button("Cancel").disabled).toBe(false);
});

it("labels unavailable thumbnails while keeping their saved selection intact", () => {
  renderPicker();
  fireEvent.error(screen.getByAltText("Property photo 1"));
  expect(screen.getByText("Photo unavailable")).toBeTruthy();
  expect(checkbox(1).checked).toBe(true);
});

it("explains when an omitted cover page will keep photos out of the proposal", () => {
  renderPicker({ coverPageIncluded: false });
  expect(screen.getByText("Turn on the cover page in Edit pages to show your cover photo.")).toBeTruthy();
  expect(button("Save photos").disabled).toBe(false);
});
