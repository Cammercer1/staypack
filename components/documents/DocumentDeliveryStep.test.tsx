// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DocumentDeliveryStep } from "./DocumentDeliveryStep";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function props() {
  return {
    name: "appraisal" as const,
    preview: <div>Report preview</div>,
    pdfReady: false,
    downloadUrl: "/api/reports/one/download",
    publicUrl: "https://example.test/report/one",
    published: true,
    hasLinkDraft: false,
    linkPending: false,
    renderLinkEditor: () => null,
    onPreparePdf: vi.fn().mockResolvedValue(undefined),
    onPublish: vi.fn().mockResolvedValue(undefined),
    onEdit: vi.fn(),
    onBusyChange: vi.fn(),
  };
}

it("prevents overlapping PDF and publish requests and permits retry after failure", async () => {
  const current = props();
  let reject!: (error: Error) => void;
  current.onPreparePdf.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  render(<DocumentDeliveryStep {...current} />);
  const pdf = screen.getByRole("button", { name: "Prepare PDF" });
  const publish = screen.getByRole("button", { name: "Update online report" });
  act(() => {
    fireEvent.click(pdf);
    fireEvent.click(pdf);
    fireEvent.click(publish);
  });
  expect(current.onPreparePdf).toHaveBeenCalledOnce();
  expect(current.onPublish).not.toHaveBeenCalled();
  expect(current.onBusyChange).toHaveBeenLastCalledWith(true);
  await act(async () => reject(new Error("PDF service unavailable")));
  expect(screen.getByRole("alert").textContent).toBe("PDF service unavailable");
  expect(current.onBusyChange).toHaveBeenLastCalledWith(false);
  fireEvent.click(screen.getByRole("button", { name: "Prepare PDF" }));
  await waitFor(() => expect(current.onPreparePdf).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});

it("blocks unsaved link changes and only allows draft PDFs when explicitly supported", async () => {
  const current = props();
  const { rerender } = render(<DocumentDeliveryStep {...current} linkPending />);
  expect(screen.getByRole("button", { name: "Prepare PDF" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "Update online report" })).toHaveProperty("disabled", true);
  rerender(<DocumentDeliveryStep {...current} hasLinkDraft />);
  expect(screen.getByRole("button", { name: "Prepare PDF" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "Update online report" })).toHaveProperty("disabled", false);
  rerender(<DocumentDeliveryStep {...current} hasLinkDraft allowDraftPdf />);
  fireEvent.click(screen.getByRole("button", { name: "Prepare PDF" }));
  await waitFor(() => expect(current.onPreparePdf).toHaveBeenCalledOnce());
  expect(current.onPublish).not.toHaveBeenCalled();
});

it("clears stale copy confirmation when the public URL changes and supports clipboard failure recovery", async () => {
  const current = props();
  const writeText = vi.fn().mockRejectedValueOnce(new Error("Clipboard unavailable")).mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  const { rerender } = render(<DocumentDeliveryStep {...current} />);
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Unable to copy the link");
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
  await screen.findByRole("button", { name: "Link copied" });
  expect(screen.queryByRole("alert")).toBeNull();
  const nextUrl = "https://example.test/report/two";
  rerender(<DocumentDeliveryStep {...current} publicUrl={nextUrl} />);
  expect(screen.getByLabelText("Shareable link")).toHaveProperty("value", nextUrl);
  expect(screen.queryByRole("button", { name: "Link copied" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
  await screen.findByRole("button", { name: "Link copied" });
  expect(writeText).toHaveBeenLastCalledWith(nextUrl);
});

it("keeps PDF and online links inert while customer editing disables delivery", () => {
  render(<DocumentDeliveryStep {...props()} disabled pdfReady />);
  expect(screen.getByText("Download PDF", { selector: "a" }).closest("[inert]")).toBeTruthy();
  expect(screen.getByText("Open", { selector: "a" }).closest("[inert]")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Edit report" })).toHaveProperty("disabled", true);
});
