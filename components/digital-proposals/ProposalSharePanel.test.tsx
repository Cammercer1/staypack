// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppraisalRoutes } from "@/components/appraisals/AppraisalRoutes";
import type { ProposalWorkspace } from "@/lib/digital-proposals/workspace";
import { ProposalSharePanel } from "./ProposalSharePanel";
import { PDF_STATUS_POLL_DELAYS, publicationReceiptKey } from "@/lib/digital-proposals/shareState";

beforeEach(() => { window.sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const pendingVersion = {
  id: "version-1", path: `/proposal/${"a".repeat(64)}`, draft_revision: 1,
  created_at: "2026-10-14T00:00:00Z", revoked_at: null, pdf_status: "pending" as const, source_fingerprint: "previous-source",
};
function StatefulPanel({ onBusyChange, status = "pending", current = false }: { onBusyChange?: (busy: boolean) => void; status?: "pending" | "generating"; current?: boolean }) {
  const [workspace, setWorkspace] = useState<ProposalWorkspace>({ draft: null, revision: 1, sourceFingerprint: "current", versions: [{ ...pendingVersion, source_fingerprint: current ? "current" : pendingVersion.source_fingerprint, pdf_status: status }], attachments: [] });
  return <ProposalSharePanel reportId="appraisal" valid workspace={workspace} onSave={async () => 1} onWorkspaceChange={value => setWorkspace(current => ({ ...current, ...value }))} onBusyChange={onBusyChange} />;
}

function openPreviousVersions() {
  const summary = screen.getByText(/^(Previous published versions?|Published proposal & history)$/);
  const disclosure = summary.closest("details")!;
  if (!disclosure.open) fireEvent.click(summary);
  return disclosure;
}

function openLinkSettings() {
  const summary = screen.getByText("Link settings & history");
  const disclosure = summary.closest("details")!;
  if (!disclosure.open) fireEvent.click(summary);
  return disclosure;
}

// JSDOM exposes descendants of closed native details to role queries.
function expectInsideClosedDisclosure(element: HTMLElement) {
  const disclosure = element.closest("details");
  expect(disclosure).not.toBeNull();
  expect(disclosure?.open).toBe(false);
}

it.each(["pending", "generating"] as const)("keeps a completed PDF available when refresh fails after %s preparation", async status => {
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ status: "ready" })).mockResolvedValueOnce(Response.json({ error: "Refresh unavailable" }, { status: 503 }));
  vi.stubGlobal("fetch", fetch);
  render(<StatefulPanel status={status} />);
  openPreviousVersions();
  fireEvent.click(screen.getByRole("button", { name: status === "generating" ? "Check PDF status" : "Prepare PDF" }));
  await screen.findByRole("link", { name: "Download PDF" });
  expect(screen.getByRole("status").textContent).toBe("The published version and its PDF are ready to share.");
  expect(fetch.mock.calls[0]).toEqual(["/api/str/appraisals/appraisal/proposal/pdf", expect.objectContaining({ method: "POST", body: JSON.stringify({ versionId: pendingVersion.id }) })]);
});

it("retains a newly published version and its PDF if the workspace refresh is unavailable", async () => {
  const version = { ...pendingVersion, id: "version-2", path: `/proposal/${"b".repeat(64)}` };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ version })).mockResolvedValueOnce(Response.json({ status: "ready" })).mockResolvedValueOnce(Response.json({ error: "Refresh unavailable" }, { status: 503 })));
  render(<StatefulPanel />);
  fireEvent.click(screen.getByRole("button", { name: "Update published proposal" }));
  const download = await screen.findByRole("link", { name: "Download PDF" });
  expect(download.getAttribute("href")).toBe(`/api/proposals/${"b".repeat(64)}/pdf`);
  expect(screen.getByLabelText("Client share link")).toHaveProperty("value", `${window.location.origin}${version.path}`);
  expect(within(openLinkSettings()).getAllByRole("listitem")).toHaveLength(1);
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("The published version and its PDF are ready to share."));
});

it("keeps a newly published version when a failed PDF's refresh is missing that version", async () => {
  const version = { ...pendingVersion, id: "version-2", path: `/proposal/${"b".repeat(64)}` };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ version }))
    .mockResolvedValueOnce(Response.json({ error: "PDF unavailable. Try again." }, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ versions: [pendingVersion] })));
  render(<StatefulPanel />);
  fireEvent.click(screen.getByRole("button", { name: "Update published proposal" }));
  expect((await screen.findByRole("alert")).textContent).toContain("PDF unavailable");
  expect(screen.getByLabelText("Client share link")).toHaveProperty("value", `${window.location.origin}${version.path}`);
  expect(within(openLinkSettings()).getAllByRole("listitem")).toHaveLength(1);
});

it.each(["ready", "generating"] as const)("uses refreshed %s PDF status after a gateway error without retrying generation", async status => {
  const version = { ...pendingVersion, id: "version-2", path: `/proposal/${"b".repeat(64)}` };
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ version }))
    .mockResolvedValueOnce(new Response("<html>Gateway timeout</html>", { status: 504 }))
    .mockResolvedValueOnce(Response.json({ versions: [{ ...version, pdf_status: status }, pendingVersion] }));
  vi.stubGlobal("fetch", fetcher);
  const onBusyChange = vi.fn();
  render(<StatefulPanel onBusyChange={onBusyChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Update published proposal" }));
  expect((await screen.findByRole("status")).textContent).toBe(status === "ready"
    ? "The published version and its PDF are ready to share." : "Your published link is ready. The PDF is still being prepared; its status will update automatically.");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByLabelText("Client share link")).toHaveProperty("value", `${window.location.origin}${version.path}`);
  expect(within(openLinkSettings()).getAllByRole("listitem")).toHaveLength(1);
  if (status === "ready") expect(screen.getByRole("link", { name: "Download PDF" }).getAttribute("href")).toBe(`/api/proposals/${"b".repeat(64)}/pdf`);
  else expect(screen.getByRole("button", { name: "Check PDF status" }).hasAttribute("disabled")).toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(fetcher.mock.calls[2]).toEqual(["/api/str/appraisals/appraisal/proposal", undefined]);
  await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
});

it.each(["ready", "generating"] as const)("uses refreshed %s PDF status after a network interruption", async status => {
  const fetcher = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce(Response.json({ versions: [{ ...pendingVersion, pdf_status: status }] }));
  vi.stubGlobal("fetch", fetcher);
  render(<StatefulPanel />);
  openPreviousVersions();
  fireEvent.click(screen.getByRole("button", { name: "Prepare PDF" }));
  await screen.findByRole("status");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(status === "ready" ? screen.getByRole("link", { name: "Download PDF" }) : screen.getByRole("button", { name: "Check PDF status" })).toBeTruthy();
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it.each(["pending", "failed", "unavailable"] as const)("retains a meaningful gateway error when refreshed status is %s", async status => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response("<html>Gateway timeout</html>", { status: 504 }))
    .mockResolvedValueOnce(status === "unavailable" ? new Response("<html>Service unavailable</html>", { status: 503 }) : Response.json({ versions: [{ ...pendingVersion, pdf_status: status }] }));
  vi.stubGlobal("fetch", fetcher);
  render(<StatefulPanel />);
  openPreviousVersions();
  fireEvent.click(screen.getByRole("button", { name: "Prepare PDF" }));
  expect((await screen.findByRole("alert")).textContent).toContain("The request timed out. Please try again shortly.");
  expect(screen.getByRole("button", { name: status === "failed" ? "Retry PDF" : "Prepare PDF" }).hasAttribute("disabled")).toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it.each([false, true])("publishes and previews through the correct workspace routes (shared=%s)", async shared => {
  const version = { ...pendingVersion, pdf_status: "ready" as const };
  const fetcher = vi.fn().mockResolvedValue(Response.json({ version }));
  vi.stubGlobal("fetch", fetcher);
  const panel = <StatefulPanel />;
  render(shared ? <AppraisalRoutes>{panel}</AppraisalRoutes> : panel);
  fireEvent.click(screen.getByRole("button", { name: "Update published proposal" }));
  await screen.findByRole("link", { name: "Download PDF" });
  expect(fetcher.mock.calls[0][0]).toBe(`${shared ? "/api/appraisals" : "/api/str/appraisals"}/appraisal/proposal/publish`);
  expect(screen.getByRole("link", { name: "View published proposal" }).getAttribute("href")).toBe(`${shared ? "/appraisals" : "/short-term-rentals/appraisals"}/appraisal/preview?version=${version.id}`);
});

it("requires the inline confirmation before revoking a version", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ revokedAt: "2026-10-15T00:00:00Z" }));
  vi.stubGlobal("fetch", fetcher);
  render(<StatefulPanel />);
  openPreviousVersions();
  fireEvent.click(screen.getByRole("button", { name: "Revoke link" }));
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Keep link" }));
  expect(screen.queryByRole("button", { name: "Revoke access" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Revoke link" }));
  fireEvent.click(screen.getByRole("button", { name: "Revoke access" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Link revoked"));
  expect(screen.queryByLabelText("Client share link")).toBeNull();
  expect(fetcher.mock.calls[0][0]).toBe("/api/str/appraisals/appraisal/proposal/revoke");
});

it("recovers after a failed render without requiring another published version", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(Response.json({ error: "The PDF could not be prepared; try again." }, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ versions: [{ ...pendingVersion, pdf_status: "failed" }] }))
    .mockResolvedValueOnce(Response.json({ status: "ready" }))
    .mockResolvedValueOnce(Response.json({ versions: [{ ...pendingVersion, pdf_status: "pending" }] })));
  render(<StatefulPanel />);
  openPreviousVersions();
  fireEvent.click(screen.getByRole("button", { name: "Prepare PDF" }));
  const retry = await screen.findByRole("button", { name: "Retry PDF" });
  await waitFor(() => expect(retry.hasAttribute("disabled")).toBe(false));
  fireEvent.click(retry);
  await screen.findByRole("link", { name: "Download PDF" });
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("The published version and its PDF are ready to share."));
  expect(within(openPreviousVersions()).getAllByRole("listitem")).toHaveLength(1);
  expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith("/publish"))).toBe(false);
});

it("holds the parent busy through publishing and PDF preparation", async () => {
  let completePdf!: (value: Response) => void;
  const waitingPdf = new Promise<Response>(resolve => { completePdf = resolve; });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ version: pendingVersion })).mockReturnValueOnce(waitingPdf).mockResolvedValueOnce(Response.json({ versions: [{ ...pendingVersion, pdf_status: "ready" }] })));
  const onBusyChange = vi.fn();
  const { unmount } = render(<StatefulPanel onBusyChange={onBusyChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Update published proposal" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(onBusyChange).toHaveBeenLastCalledWith(true);
  expect(screen.getByText("Preparing PDF…")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Copy link" }).hasAttribute("disabled")).toBe(true);
  completePdf(Response.json({ status: "ready" }));
  await screen.findByRole("link", { name: "Download PDF" });
  await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
  unmount();
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
});

it("releases the parent lock when leaving during PDF preparation", async () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
  const onBusyChange = vi.fn();
  const { unmount } = render(<StatefulPanel onBusyChange={onBusyChange} />);
  openPreviousVersions();
  fireEvent.click(screen.getByRole("button", { name: "Prepare PDF" }));
  await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(true));
  unmount();
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
});

it.each([false, true])("downloads the fixed published PDF in either appraisal workspace (shared=%s)", shared => {
  const versions: ProposalWorkspace["versions"] = ["ready", "pending", "failed", "revoked"].map((state, index) => ({
    id: `version-${index}`, path: `/proposal/${String(index).repeat(64)}`,
    draft_revision: index, created_at: "2026-10-14T00:00:00Z",
    revoked_at: state === "revoked" ? "2026-10-14T01:00:00Z" : null,
    pdf_status: state === "revoked" ? "ready" : state as "ready" | "pending" | "failed",
  }));
  const panel = <ProposalSharePanel reportId="appraisal" valid workspace={{ draft: null, revision: 5, sourceFingerprint: "current", versions, attachments: [] }} onSave={vi.fn()} onWorkspaceChange={vi.fn()} />;
  render(shared ? <AppraisalRoutes>{panel}</AppraisalRoutes> : panel);
  expectInsideClosedDisclosure(screen.getByRole("link", { name: "Download PDF" }));
  openPreviousVersions();
  const downloads = screen.getAllByRole("link", { name: "Download PDF" });
  expect(downloads).toHaveLength(1);
  expect(downloads[0].getAttribute("href")).toBe(`/api/proposals/${"0".repeat(64)}/pdf`);
  expect(downloads[0].hasAttribute("download")).toBe(true);
  expect(screen.getByRole("button", { name: "Prepare PDF" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Retry PDF" })).toBeTruthy();
});

const savedWorkspace = (overrides: Partial<ProposalWorkspace> = {}): ProposalWorkspace => ({
  draft: null, revision: 1, sourceFingerprint: "current", attachments: [],
  versions: [{ ...pendingVersion, source_fingerprint: "current", pdf_status: "ready" }], ...overrides,
});

it("offers one clear create action before any link has been published", () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  render(<ProposalSharePanel reportId="appraisal" valid workspace={savedWorkspace({ versions: [] })} onSave={vi.fn()} onWorkspaceChange={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Publish proposal" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Publish your proposal" })).toBeTruthy();
  expect(screen.getAllByRole("button").filter(button => !button.closest("details"))).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Copy link" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Preview draft" })).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
});

it("offers copying and PDF download without another publish action when the draft is current", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  render(<ProposalSharePanel reportId="appraisal" valid workspace={savedWorkspace()} onSave={vi.fn()} onWorkspaceChange={vi.fn()} onPreviewDraft={vi.fn()} />);
  expect(screen.getByText("Ready to share")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Update published proposal|Publish proposal/ })).toBeNull();
  expect(screen.getAllByRole("button").filter(button => !button.closest("details"))).toHaveLength(1);
  expect(screen.getByRole("link", { name: "View published proposal" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Download PDF" }).closest("details")).toBeNull();
  expect(screen.queryByRole("button", { name: "Preview draft" })).toBeNull();
  expectInsideClosedDisclosure(screen.getByRole("button", { name: "Revoke link" }));
  expect(screen.getByText("Link settings & history").closest("details")?.open).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}${pendingVersion.path}`));
  expect(screen.getByRole("status").textContent).toBe("Link copied. It’s ready to paste into your message.");
  expect(within(openLinkSettings()).getByRole("button", { name: "Revoke link" })).toBeTruthy();
});

it("keeps published copy and PDF clearly separate from unsaved draft edits", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  const props = { reportId: "appraisal", valid: true, workspace: savedWorkspace(), onSave: vi.fn(), onWorkspaceChange: vi.fn() };
  const { rerender } = render(<ProposalSharePanel {...props} />);
  rerender(<ProposalSharePanel {...props} hasUnsavedChanges />);
  expect(screen.getByRole("heading", { name: "Changes to publish" })).toBeTruthy();
  expect(screen.getByText(/Publishing saves your draft/)).toBeTruthy();
  expect(screen.getByText(/Your share link stays the same/)).toBeTruthy();
  expectInsideClosedDisclosure(screen.getByRole("textbox", { name: "Previously published share link" }));
  expectInsideClosedDisclosure(screen.getByRole("link", { name: "Download PDF" }));
  expectInsideClosedDisclosure(screen.getByRole("button", { name: "Copy previous link" }));
  expect(screen.getByText(/^Previous published version/).closest("details")?.open).toBe(false);
  expect(screen.getAllByRole("button").filter(button => !button.closest("details"))).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Update published proposal" })).toBeTruthy();
  openPreviousVersions();
  expect(screen.getByRole("link", { name: "Download PDF" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Copy previous link" }));
  expect((await screen.findByRole("status")).textContent).toContain("draft changes are not included");
});

it("does not claim legacy publications are current or definitely changed", () => {
  render(<ProposalSharePanel reportId="appraisal" valid workspace={savedWorkspace({ versions: [{ ...pendingVersion, source_fingerprint: undefined, pdf_status: "ready" }] })} onSave={vi.fn()} onWorkspaceChange={vi.fn()} />);
  expect(screen.getByText("Check before sharing")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Update published proposal" })).toBeTruthy();
  expect(screen.queryByText("Changes ready to publish")).toBeNull();
  expect(screen.queryByText("Changes to publish")).toBeNull();
  expect(screen.queryByText("Ready to share")).toBeNull();
  expectInsideClosedDisclosure(screen.getByRole("link", { name: "Download PDF" }));
  openPreviousVersions();
  expect(screen.getByRole("textbox", { name: "Previously published share link" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Download PDF" })).toBeTruthy();
});

it("prompts republishing after client details change and clears the prompt once published", async () => {
  const version = { ...pendingVersion, id: "updated-client", path: `/proposal/${"c".repeat(64)}`, source_fingerprint: "updated-client", pdf_status: "ready" as const };
  const fetcher = vi.fn().mockResolvedValue(Response.json({ version }));
  vi.stubGlobal("fetch", fetcher);
  const props = { reportId: "appraisal", valid: true, onSave: vi.fn().mockResolvedValue(1), onWorkspaceChange: vi.fn() };
  const { rerender } = render(<ProposalSharePanel {...props} workspace={savedWorkspace()} />);
  expect(screen.getByText("Ready to share")).toBeTruthy();
  rerender(<ProposalSharePanel {...props} workspace={savedWorkspace({ sourceFingerprint: "updated-client" })} />);
  expect(screen.getByRole("heading", { name: "Changes ready to publish" })).toBeTruthy();
  expect(screen.queryByText("Ready to share")).toBeNull();
  expectInsideClosedDisclosure(screen.getByRole("textbox", { name: "Previously published share link" }));
  openPreviousVersions();
  expect(screen.getByLabelText("Previously published share link")).toHaveProperty("value", `${window.location.origin}${pendingVersion.path}`);
  fireEvent.click(screen.getByRole("button", { name: "Update published proposal" }));
  await waitFor(() => expect(props.onWorkspaceChange).toHaveBeenCalledWith({ revision: 1, versions: [version, savedWorkspace().versions[0]] }));
  rerender(<ProposalSharePanel {...props} workspace={savedWorkspace({ sourceFingerprint: "updated-client", versions: [version, savedWorkspace().versions[0]] })} />);
  expect(await screen.findByText("Ready to share")).toBeTruthy();
  expect(screen.queryByText("Changes ready to publish")).toBeNull();
  expect(fetcher.mock.calls[0][1]).toEqual(expect.objectContaining({ body: JSON.stringify({ revision: 1, sourceFingerprint: "updated-client" }) }));
});

it("confirms a successful publication even if the server reuses an identical older snapshot", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ version: { ...pendingVersion, pdf_status: "ready" } })));
  render(<StatefulPanel />);
  fireEvent.click(screen.getByRole("button", { name: "Update published proposal" }));
  await screen.findByText("Ready to share");
  expect(screen.queryByRole("button", { name: "Update published proposal" })).toBeNull();
  expect(within(openLinkSettings()).queryByRole("listitem")).toBeNull();
});

it("restores a successful reused-snapshot receipt after remount, without storing proposal content", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ version: { ...pendingVersion, pdf_status: "ready" } }));
  vi.stubGlobal("fetch", fetcher);
  const first = render(<StatefulPanel />);
  fireEvent.click(screen.getByRole("button", { name: "Update published proposal" }));
  await screen.findByText("Ready to share");
  expect(JSON.parse(window.sessionStorage.getItem(publicationReceiptKey("/short-term-rentals/appraisals/appraisal"))!)).toEqual({
    versionId: pendingVersion.id, path: pendingVersion.path, revision: 1, sourceFingerprint: "current",
  });
  first.unmount();
  render(<StatefulPanel />);
  expect(screen.getByText("Ready to share")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Update published proposal" })).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("invalidates a restored receipt when the fresh workspace changes or revokes its link", () => {
  window.sessionStorage.setItem(publicationReceiptKey("/short-term-rentals/appraisals/appraisal"), JSON.stringify({
    versionId: pendingVersion.id, path: pendingVersion.path, revision: 1, sourceFingerprint: "current",
  }));
  const props = { reportId: "appraisal", valid: true, onSave: vi.fn(), onWorkspaceChange: vi.fn() };
  const workspace = savedWorkspace({ versions: [{ ...pendingVersion, pdf_status: "ready" }] });
  const { rerender } = render(<ProposalSharePanel {...props} workspace={workspace} />);
  expect(screen.getByText("Ready to share")).toBeTruthy();
  rerender(<ProposalSharePanel {...props} workspace={{ ...workspace, revision: 2 }} />);
  expect(screen.getByText("Changes ready to publish")).toBeTruthy();
  rerender(<ProposalSharePanel {...props} workspace={{ ...workspace, sourceFingerprint: "new-source" }} />);
  expect(screen.getByText("Changes ready to publish")).toBeTruthy();
  rerender(<ProposalSharePanel {...props} workspace={workspace} hasUnsavedChanges />);
  expect(screen.getByText("Changes to publish")).toBeTruthy();
  rerender(<ProposalSharePanel {...props} workspace={{ ...workspace, versions: [{ ...workspace.versions[0], revoked_at: "2026-10-22" }] }} />);
  expect(screen.getByRole("button", { name: "Publish proposal" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Download PDF" })).toBeNull();
});

it("isolates publication receipts between editor routes", () => {
  window.sessionStorage.setItem(publicationReceiptKey("/short-term-rentals/appraisals/appraisal"), JSON.stringify({
    versionId: pendingVersion.id, path: pendingVersion.path, revision: 1, sourceFingerprint: "current",
  }));
  render(<AppraisalRoutes><StatefulPanel /></AppraisalRoutes>);
  expect(screen.getByText("Changes ready to publish")).toBeTruthy();
});

it("tolerates blocked session storage while confirming a successful publication locally", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage disabled"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage disabled"); });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ version: { ...pendingVersion, pdf_status: "ready" } })));
  render(<StatefulPanel />);
  fireEvent.click(screen.getByRole("button", { name: "Update published proposal" }));
  await screen.findByText("Ready to share");
  expect(screen.queryByRole("alert")).toBeNull();
});

it("keeps the existing version when saving edits fails before publication", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  render(<ProposalSharePanel reportId="appraisal" valid hasUnsavedChanges workspace={savedWorkspace()} onSave={async () => null} onWorkspaceChange={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Update published proposal" }));
  expect((await screen.findByRole("alert")).textContent).toContain("has not been published");
  expect(fetcher).not.toHaveBeenCalled();
  openPreviousVersions();
  expect(screen.getByLabelText("Previously published share link")).toHaveProperty("value", `${window.location.origin}${pendingVersion.path}`);
});

it("refreshes a pending PDF automatically without generating another version or locking the parent", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockImplementation(async () => Response.json({ versions: [{ ...pendingVersion, source_fingerprint: "current", pdf_status: "ready" }] }));
  vi.stubGlobal("fetch", fetcher);
  const onBusyChange = vi.fn();
  render(<StatefulPanel current status="generating" onBusyChange={onBusyChange} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(PDF_STATUS_POLL_DELAYS[0]); });
  expect(screen.getByRole("link", { name: "Download PDF" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Ready to share" })).toBeTruthy();
  expect(screen.getByRole("status").textContent).toBe("The published version’s PDF is ready to download.");
  expect(fetcher).toHaveBeenCalledExactlyOnceWith("/api/str/appraisals/appraisal/proposal", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(onBusyChange).not.toHaveBeenCalledWith(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("reconciles a replacement link for the same version before showing a ready PDF", async () => {
  vi.useFakeTimers();
  window.sessionStorage.setItem(publicationReceiptKey("/short-term-rentals/appraisals/appraisal"), JSON.stringify({
    versionId: pendingVersion.id, path: pendingVersion.path, revision: 1, sourceFingerprint: "current",
  }));
  const replacement = { ...pendingVersion, path: `/proposal/${"b".repeat(64)}`, link_id: "link-b", pdf_status: "ready" };
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ versions: [replacement] }))
    .mockResolvedValueOnce(Response.json({ revokedAt: "2026-10-22T00:00:00Z" }));
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  vi.stubGlobal("fetch", fetcher);
  render(<StatefulPanel status="generating" />);
  expect(screen.getByText("Ready to share")).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(PDF_STATUS_POLL_DELAYS[0]); });
  expect(screen.getByText("Changes ready to publish")).toBeTruthy();
  expectInsideClosedDisclosure(screen.getByRole("link", { name: "Download PDF" }));
  openPreviousVersions();
  expect(screen.getByLabelText("Previously published share link")).toHaveProperty("value", `${window.location.origin}${replacement.path}`);
  expect(screen.getByRole("link", { name: "Download PDF" }).getAttribute("href")).toBe(`/api/proposals/${"b".repeat(64)}/pdf`);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Copy previous link" })); });
  expect(writeText).toHaveBeenCalledWith(`${window.location.origin}${replacement.path}`);
  fireEvent.click(screen.getByRole("button", { name: "Revoke link" }));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Revoke access" })); });
  expect(fetcher.mock.calls[1]).toEqual(["/api/str/appraisals/appraisal/proposal/revoke", expect.objectContaining({ body: JSON.stringify({ versionId: pendingVersion.id, linkId: "link-b" }) })]);
  expect(screen.queryByRole("link", { name: "Download PDF" })).toBeNull();
});

it("backs off and stops automatic PDF checks, leaving manual status checking available", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockImplementation(async () => Response.json({ versions: [{ ...pendingVersion, pdf_status: "generating" }] }));
  vi.stubGlobal("fetch", fetcher);
  render(<StatefulPanel status="generating" />);
  for (const [index, delay] of PDF_STATUS_POLL_DELAYS.entries()) {
    await act(async () => { await vi.advanceTimersByTimeAsync(delay - 1); });
    expect(fetcher).toHaveBeenCalledTimes(index);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(fetcher).toHaveBeenCalledTimes(index + 1);
  }
  openPreviousVersions();
  expect(screen.getByText(/Automatic checks have paused/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Check PDF status" }).hasAttribute("disabled")).toBe(false);
  await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
  expect(fetcher).toHaveBeenCalledTimes(PDF_STATUS_POLL_DELAYS.length);
});

it("stops automatic checks on a failed PDF and offers Retry PDF", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockImplementation(async () => Response.json({ versions: [{ ...pendingVersion, pdf_status: "failed" }] }));
  vi.stubGlobal("fetch", fetcher);
  render(<StatefulPanel status="generating" />);
  await act(async () => { await vi.advanceTimersByTimeAsync(PDF_STATUS_POLL_DELAYS[0]); });
  openPreviousVersions();
  expect(screen.getByRole("button", { name: "Retry PDF" })).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("aborts an in-flight automatic check and clears timers when leaving", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(() => new Promise<Response>(() => {}));
  vi.stubGlobal("fetch", fetcher);
  const { unmount } = render(<StatefulPanel status="generating" />);
  await act(async () => { await vi.advanceTimersByTimeAsync(PDF_STATUS_POLL_DELAYS[0]); });
  const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1];
  expect(init.signal?.aborted).toBe(false);
  unmount();
  expect(init.signal?.aborted).toBe(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("bounds failed status checks without hiding the published link", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
  vi.stubGlobal("fetch", fetcher);
  render(<StatefulPanel status="generating" />);
  for (const delay of PDF_STATUS_POLL_DELAYS) await act(async () => { await vi.advanceTimersByTimeAsync(delay); });
  expect(fetcher).toHaveBeenCalledTimes(PDF_STATUS_POLL_DELAYS.length);
  openPreviousVersions();
  expect(screen.getByText(/Automatic checks have paused/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Copy previous link" })).toBeTruthy();
});

it("keeps a previous PDF's automatic success feedback inside its closed disclosure", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ versions: [{ ...pendingVersion, pdf_status: "ready" }] })));
  render(<StatefulPanel status="generating" />);
  await act(async () => { await vi.advanceTimersByTimeAsync(PDF_STATUS_POLL_DELAYS[0]); });
  expect(screen.getByRole("heading", { name: "Changes ready to publish" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Update published proposal" })).toBeTruthy();
  expectInsideClosedDisclosure(screen.getByRole("status"));
  expectInsideClosedDisclosure(screen.getByRole("link", { name: "Download PDF" }));
  const previous = openPreviousVersions();
  expect(within(previous).getByRole("status").textContent).toBe("The published version’s PDF is ready to download.");
  expect(within(previous).getByRole("link", { name: "Download PDF" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Ready to share" })).toBeNull();
});

it("keeps the optional client and draft preview inside the single sharing panel", () => {
  const onPreviewDraft = vi.fn();
  const props = { reportId: "appraisal", valid: true, workspace: savedWorkspace({ versions: [] }), onSave: vi.fn(), onWorkspaceChange: vi.fn(), onPreviewDraft };
  const { rerender } = render(<ProposalSharePanel {...props} customerPanel={<button>Add client</button>} />);
  const panel = screen.getByRole("region", { name: "Publish and share proposal" });
  expect(within(panel).getAllByRole("button", { name: "Add client" })).toHaveLength(1);
  expect(within(panel).getByRole("button", { name: "Publish proposal" })).toBeTruthy();
  expect(screen.queryByText("Draft preview content")).toBeNull();
  fireEvent.click(within(panel).getByRole("button", { name: "Preview draft" }));
  expect(onPreviewDraft).toHaveBeenCalledOnce();
  rerender(<ProposalSharePanel {...props} customerPanel={<button>Add client</button>} previewingDraft draftPreview={<p>Draft preview content</p>} />);
  expect(within(panel).getByText("Draft preview content")).toBeTruthy();
  expect(within(panel).getByRole("button", { name: "Publish proposal" })).toBeTruthy();
  expect(within(panel).getByRole("button", { name: "Close preview" })).toBeTruthy();
});

const stablePath = `/proposal/${"a".repeat(64)}`;
function stableWorkspace(overrides: Partial<ProposalWorkspace> = {}): ProposalWorkspace {
  return {
    ...savedWorkspace(), sourceFingerprint: pendingVersion.source_fingerprint,
    shareLink: { id: "stable-link", path: stablePath, versionId: pendingVersion.id, draft_revision: 1, source_fingerprint: "previous-source", created_at: pendingVersion.created_at, updated_at: pendingVersion.created_at, revoked_at: null },
    versions: [{ ...pendingVersion, link_id: "stable-link", path: `${stablePath}?version=${pendingVersion.id}`, pdfPath: `/api/proposals/${"a".repeat(64)}/pdf?version=${pendingVersion.id}`, pdf_status: "ready" }],
    ...overrides,
  };
}

it("updates the published proposal at the same share URL only after the publish action", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  const initial = stableWorkspace();
  const updatedVersion = { ...initial.versions[0], id: "version-2", draft_revision: 2, path: `${stablePath}?version=version-2`, pdfPath: `/api/proposals/${"a".repeat(64)}/pdf?version=version-2`, source_fingerprint: "updated" };
  const shareLink = { ...initial.shareLink!, versionId: updatedVersion.id, draft_revision: 2, source_fingerprint: "updated" };
  const fetcher = vi.fn().mockResolvedValue(Response.json({ version: updatedVersion, shareLink }));
  vi.stubGlobal("fetch", fetcher);
  const onWorkspaceChange = vi.fn();
  const onSave = vi.fn().mockResolvedValue(2);
  const props = { reportId: "appraisal", valid: true, onWorkspaceChange, onSave };
  const view = render(<ProposalSharePanel {...props} workspace={initial} />);
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
  await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(`${window.location.origin}${stablePath}`));
  const changed = { ...initial, revision: 2, sourceFingerprint: "updated" };
  view.rerender(<ProposalSharePanel {...props} workspace={changed} />);
  expect(screen.getByText("Changes ready to publish")).toBeTruthy();
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Update published proposal" }));
  await waitFor(() => expect(onWorkspaceChange).toHaveBeenCalledWith(expect.objectContaining({ shareLink, revision: 2 })));
  expect(onSave).toHaveBeenCalledOnce();
  view.rerender(<ProposalSharePanel {...props} workspace={{ ...changed, shareLink, versions: [updatedVersion, ...initial.versions] }} />);
  expect(screen.getByRole("heading", { name: "Ready to share" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
  expect(writeText).toHaveBeenLastCalledWith(`${window.location.origin}${stablePath}`);
  expect(screen.getAllByRole("link", { name: "Download PDF" }).find(link => !link.closest("details"))?.getAttribute("href")).toBe(updatedVersion.pdfPath);
  const history = openLinkSettings();
  expect(within(history).getByRole("link", { name: "Download PDF" }).getAttribute("href")).toBe(initial.versions[0].pdfPath);
  expect(screen.getAllByRole("button", { name: "Revoke link" })).toHaveLength(1);
});

it("recognises a reused older snapshot as current without a browser receipt", () => {
  const initial = stableWorkspace();
  const older = initial.versions[0];
  const newer = { ...older, id: "version-2", draft_revision: 2 };
  const workspace = { ...initial, revision: 3, sourceFingerprint: "current", shareLink: { ...initial.shareLink!, draft_revision: 3, source_fingerprint: "current" }, versions: [newer, older] };
  render(<ProposalSharePanel reportId="appraisal" valid workspace={workspace} onSave={vi.fn()} onWorkspaceChange={vi.fn()} />);
  expect(screen.getByRole("heading", { name: "Ready to share" })).toBeTruthy();
  expect(screen.getAllByRole("link", { name: "View published proposal" }).find(link => !link.closest("details"))?.getAttribute("href")).toContain(`version=${older.id}`);
  expect(screen.getByLabelText("Client share link")).toHaveProperty("value", `${window.location.origin}${stablePath}`);
});

it("copies the stable published link while draft changes wait for deliberate publication", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  const fetcher = vi.fn();
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  vi.stubGlobal("fetch", fetcher);
  render(<ProposalSharePanel reportId="appraisal" valid hasUnsavedChanges workspace={stableWorkspace()} onSave={vi.fn()} onWorkspaceChange={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Update published proposal" })).toBeTruthy();
  const history = openPreviousVersions();
  fireEvent.click(within(history).getByRole("button", { name: "Copy published link" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}${stablePath}`));
  expect(fetcher).not.toHaveBeenCalled();
  expect(screen.getByRole("heading", { name: "Changes to publish" })).toBeTruthy();
});

it("follows a newer stable publication when the polled version is absent from refreshed history", async () => {
  vi.useFakeTimers();
  const initial = stableWorkspace();
  initial.versions[0].pdf_status = "generating";
  const newer = { ...initial.versions[0], id: "version-2", pdf_status: "ready" as const, path: `${stablePath}?version=version-2`, pdfPath: `/api/proposals/${"a".repeat(64)}/pdf?version=version-2` };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ...initial, versions: [newer], shareLink: { ...initial.shareLink!, versionId: newer.id } })));
  function Panel() {
    const [workspace, setWorkspace] = useState(initial);
    return <ProposalSharePanel reportId="appraisal" valid workspace={workspace} onSave={vi.fn()} onWorkspaceChange={change => setWorkspace(current => ({ ...current, ...change }))} />;
  }
  render(<Panel />);
  await act(async () => { await vi.advanceTimersByTimeAsync(PDF_STATUS_POLL_DELAYS[0]); });
  expect(screen.getAllByRole("link", { name: "Download PDF" }).find(link => !link.closest("details"))?.getAttribute("href")).toBe(newer.pdfPath);
  expect(screen.getByLabelText("Client share link")).toHaveProperty("value", `${window.location.origin}${stablePath}`);
});

it("keeps an older PDF result separate when another session updates the stable link", async () => {
  vi.useFakeTimers();
  const initial = stableWorkspace();
  initial.versions[0].pdf_status = "generating";
  const newer = { ...initial.versions[0], id: "version-2", draft_revision: 2, source_fingerprint: "new-source", pdf_status: "ready" as const, path: `${stablePath}?version=version-2`, pdfPath: `/api/proposals/${"a".repeat(64)}/pdf?version=version-2` };
  const refreshed = { ...initial, versions: [newer, { ...initial.versions[0], pdf_status: "ready" }], shareLink: { ...initial.shareLink!, versionId: newer.id, draft_revision: 2, source_fingerprint: "new-source" } };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(refreshed)));
  function Panel() {
    const [workspace, setWorkspace] = useState(initial);
    return <ProposalSharePanel reportId="appraisal" valid workspace={workspace} onSave={vi.fn()} onWorkspaceChange={change => setWorkspace(current => ({ ...current, ...change }))} />;
  }
  render(<Panel />);
  await act(async () => { await vi.advanceTimersByTimeAsync(PDF_STATUS_POLL_DELAYS[0]); });
  expect(screen.getByRole("heading", { name: "Changes ready to publish" })).toBeTruthy();
  expectInsideClosedDisclosure(screen.getByRole("status"));
  const previous = openPreviousVersions();
  expect(within(previous).getAllByRole("link", { name: "Download PDF" }).map(link => link.getAttribute("href"))).toEqual([newer.pdfPath, initial.versions[0].pdfPath]);
});
