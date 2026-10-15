// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { DocumentLinkEditor } from "./DocumentLinkEditor";

const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

const document = {
  document_link: { mode: "custom" as const, url: "https://agency.example/original" },
  assets: {},
};
const endpoint = "/api/reports/report-1/document-link";

function openEditor() {
  fireEvent.click(screen.getByRole("button", { name: "Edit link & QR" }));
}
function changeUrl(value: string) {
  fireEvent.change(screen.getByLabelText("Website URL"), { target: { value } });
}

it("discards cancelled link changes and restores the saved destination when reopened", async () => {
  const fetcher = vi.fn();
  const onSaved = vi.fn();
  const onPendingChange = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  render(<DocumentLinkEditor document={document} endpoint={endpoint} onSaved={onSaved} onPendingChange={onPendingChange} />);
  openEditor();
  changeUrl("https://agency.example/unsaved");
  expect(onPendingChange).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(onPendingChange).toHaveBeenLastCalledWith(false);
  openEditor();
  expect((screen.getByLabelText("Website URL") as HTMLInputElement).value).toBe(document.document_link.url);
  expect((screen.getByRole("button", { name: "Save link choice" }) as HTMLButtonElement).disabled).toBe(true);
  expect(fetcher).not.toHaveBeenCalled();
  expect(onSaved).not.toHaveBeenCalled();
});

it("keeps an invalid destination open and does not send it to the server", async () => {
  const fetcher = vi.fn();
  const onPendingChange = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  render(<DocumentLinkEditor document={document} endpoint={endpoint} onSaved={vi.fn()} onPendingChange={onPendingChange} />);
  openEditor();
  changeUrl("ftp://agency.example/file");
  fireEvent.click(screen.getByRole("button", { name: "Save link choice" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Enter a valid http or https destination URL.");
  expect(screen.getByLabelText("Website URL").getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(fetcher).not.toHaveBeenCalled();
  expect(onPendingChange).toHaveBeenLastCalledWith(true);
});

it("saves the validated destination once, reports pending work, and closes after success", async () => {
  let complete!: (response: Response) => void;
  const fetcher = vi.fn(() => new Promise<Response>(resolve => { complete = resolve; }));
  const onSaved = vi.fn();
  const onPendingChange = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  render(<DocumentLinkEditor document={document} endpoint={endpoint} onSaved={onSaved} onPendingChange={onPendingChange} />);
  openEditor();
  changeUrl(" https://agency.example/new ");
  fireEvent.click(screen.getByRole("button", { name: "Save link choice" }));
  await screen.findByRole("button", { name: "Saving…" });
  expect(fetcher).toHaveBeenCalledExactlyOnceWith(endpoint, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "custom", url: "https://agency.example/new" }),
  });
  expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByLabelText("Website URL") as HTMLInputElement).disabled).toBe(true);
  expect(onPendingChange).toHaveBeenLastCalledWith(true);
  fireEvent.submit(screen.getByRole("form", { name: "Document link" }));
  const payload = { report: { id: "report-1" } };
  complete(Response.json(payload));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(fetcher).toHaveBeenCalledOnce();
  expect(onSaved).toHaveBeenCalledExactlyOnceWith(payload);
  expect(onPendingChange).toHaveBeenLastCalledWith(false);
  expect(toast.success).toHaveBeenCalledWith("Link saved. Publish to apply it to the document.");
});

it("preserves a failed save for retry and does not report the link as saved", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ error: "Link service unavailable" }, { status: 503 })).mockResolvedValueOnce(Response.json({ saved: true }));
  const onSaved = vi.fn();
  const onPendingChange = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  render(<DocumentLinkEditor document={document} endpoint={endpoint} onSaved={onSaved} onPendingChange={onPendingChange} immediate />);
  openEditor();
  changeUrl("https://agency.example/retry");
  fireEvent.click(screen.getByRole("button", { name: "Save link choice" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Link service unavailable");
  expect((screen.getByLabelText("Website URL") as HTMLInputElement).value).toBe("https://agency.example/retry");
  expect(onSaved).not.toHaveBeenCalled();
  expect(onPendingChange).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole("button", { name: "Save link choice" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(onSaved).toHaveBeenCalledExactlyOnceWith({ saved: true });
  expect(toast.success).toHaveBeenCalledWith("Link saved");
  expect(onPendingChange).toHaveBeenLastCalledWith(false);
});

it("releases the pending callback when an edited link form is unmounted", () => {
  const onPendingChange = vi.fn();
  const { unmount } = render(<DocumentLinkEditor document={document} endpoint={endpoint} onSaved={vi.fn()} onPendingChange={onPendingChange} />);
  expect(onPendingChange).toHaveBeenLastCalledWith(false);
  openEditor();
  expect(onPendingChange).toHaveBeenLastCalledWith(false);
  changeUrl("https://agency.example/pending");
  expect(onPendingChange).toHaveBeenLastCalledWith(true);
  unmount();
  expect(onPendingChange).toHaveBeenLastCalledWith(false);
});

it("returns focus after a saved destination remounts the form without stealing it on external updates", async () => {
  const savedDocument = { ...document, document_link: { mode: "custom" as const, url: "https://agency.example/saved" } };
  const refreshedDocument = { ...document, document_link: { mode: "custom" as const, url: "https://agency.example/refreshed" } };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ document: savedDocument })));
  function Parent() {
    const [current, setCurrent] = useState(document);
    return <>
      <button type="button" onClick={() => setCurrent(refreshedDocument)}>Refresh document</button>
      <DocumentLinkEditor document={current} endpoint={endpoint} onSaved={() => setCurrent(savedDocument)} />
    </>;
  }
  render(<Parent />);
  openEditor();
  changeUrl(savedDocument.document_link.url);
  fireEvent.click(screen.getByRole("button", { name: "Save link choice" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(window.document.activeElement).toBe(screen.getByRole("button", { name: "Edit link & QR" })));
  openEditor();
  expect((screen.getByLabelText("Website URL") as HTMLInputElement).value).toBe(savedDocument.document_link.url);
  changeUrl("https://agency.example/cancelled");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(window.document.activeElement).toBe(screen.getByRole("button", { name: "Edit link & QR" })));
  const refresh = screen.getByRole("button", { name: "Refresh document" });
  refresh.focus();
  fireEvent.click(refresh);
  expect(window.document.activeElement).toBe(refresh);
  openEditor();
  expect((screen.getByLabelText("Website URL") as HTMLInputElement).value).toBe(refreshedDocument.document_link.url);
});
