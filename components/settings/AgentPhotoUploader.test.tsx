// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AgentPhotoUploader } from "./AgentPhotoUploader";
import { AgentAvatar } from "./AgentAvatar";
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal(
    "Image",
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 1200;
      naturalHeight = 800;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    clearRect: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
    (callback) => callback(new Blob(["photo"], { type: "image/webp" })),
  );
  URL.createObjectURL = vi.fn(() => "blob:photo");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const choose = (file: File) =>
  fireEvent.change(screen.getByLabelText("Choose agent photo"), {
    target: { files: [file] },
  });
it("falls back to initials for a broken photo", () => {
  const { container } = render(
    <AgentAvatar name="Alex Smith" src="/broken.png" />,
  );
  fireEvent.error(container.querySelector("img")!);
  expect(screen.getByLabelText("Alex Smith initials").textContent).toBe("AS");
});
it("rejects an unsupported file before uploading", () => {
  render(<AgentPhotoUploader fieldId="photo" value="" onChange={vi.fn()} />);
  choose(new File(["x"], "photo.svg", { type: "image/svg+xml" }));
  expect(screen.getByRole("alert").textContent).toMatch(/Choose a PNG/);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("allows cropping and cancels without uploading", async () => {
  const changed = vi.fn();
  render(<AgentPhotoUploader fieldId="photo" value="" onChange={changed} />);
  choose(new File(["x"], "photo.png", { type: "image/png" }));
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Use photo" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  fireEvent.change(screen.getByLabelText("Zoom"), { target: { value: 2 } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel photo change" }));
  expect(screen.queryByText("Frame your photo")).toBeNull();
  expect(changed).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});
it("retains the crop after a failed upload and allows retry", async () => {
  fetchMock
    .mockRejectedValueOnce(new Error("Upload offline"))
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: "https://example.com/photo.webp" }),
    });
  const changed = vi.fn();
  render(<AgentPhotoUploader fieldId="photo" value="" onChange={changed} />);
  choose(new File(["x"], "photo.png", { type: "image/png" }));
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Use photo" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Use photo" }));
  await screen.findByText("Upload offline");
  fireEvent.click(screen.getByRole("button", { name: "Use photo" }));
  await waitFor(() =>
    expect(changed).toHaveBeenCalledWith("https://example.com/photo.webp"),
  );
  expect(screen.queryByText("Frame your photo")).toBeNull();
});

it("handles cached image failures that happened before hydration", () => {
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(0);
  render(<AgentAvatar name="Cached Failure" src="/failed-before-hydration.png" />);
  expect(screen.getByLabelText("Cached Failure initials").textContent).toBe("CF");
});
