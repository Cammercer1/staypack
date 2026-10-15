// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { AppraisalRoutes } from "@/components/appraisals/AppraisalRoutes";
import type { ProposalWorkspace } from "@/lib/digital-proposals/workspace";
import { ProposalSharePanel } from "./ProposalSharePanel";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const pendingVersion = {
  id: "version-1", path: `/proposal/${"a".repeat(64)}`, draft_revision: 1,
  created_at: "2026-10-14T00:00:00Z", revoked_at: null, pdf_status: "pending" as const,
};
function StatefulPanel({ onBusyChange, status = "pending" }: { onBusyChange?: (busy: boolean) => void; status?: "pending" | "generating" }) {
  const [workspace, setWorkspace] = useState<ProposalWorkspace>({ draft: null, revision: 1, sourceFingerprint: "current", versions: [{ ...pendingVersion, pdf_status: status }], attachments: [] });
  return <ProposalSharePanel reportId="appraisal" valid workspace={workspace} onSave={async () => 1} onWorkspaceChange={value => setWorkspace(current => ({ ...current, ...value }))} onBusyChange={onBusyChange} />;
}

it.each(["pending", "generating"] as const)("keeps a completed PDF available when refresh fails after %s preparation", async status => {
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ status: "ready" })).mockResolvedValueOnce(Response.json({ error: "Refresh unavailable" }, { status: 503 }));
  vi.stubGlobal("fetch", fetch);
  render(<StatefulPanel status={status} />);
  fireEvent.click(screen.getByRole("button", { name: status === "generating" ? "Check PDF status" : "Prepare PDF" }));
  await screen.findByRole("link", { name: "Download PDF" });
  expect(screen.getByRole("status").textContent).toBe("Your proposal and PDF are ready to share.");
  expect(fetch.mock.calls[0]).toEqual(["/api/str/appraisals/appraisal/proposal/pdf", expect.objectContaining({ method: "POST", body: JSON.stringify({ versionId: pendingVersion.id }) })]);
});

it("retains a newly published version and its PDF if the workspace refresh is unavailable", async () => {
  const version = { ...pendingVersion, id: "version-2", path: `/proposal/${"b".repeat(64)}` };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ version })).mockResolvedValueOnce(Response.json({ status: "ready" })).mockResolvedValueOnce(Response.json({ error: "Refresh unavailable" }, { status: 503 })));
  render(<StatefulPanel />);
  fireEvent.click(screen.getByRole("button", { name: "Publish latest changes" }));
  const download = await screen.findByRole("link", { name: "Download PDF" });
  expect(download.getAttribute("href")).toBe(`/api/proposals/${"b".repeat(64)}/pdf`);
  expect(screen.getByLabelText("Customer share link")).toHaveProperty("value", `${window.location.origin}${version.path}`);
  expect(screen.getByText(/Previous versions/).textContent).toContain("(1)");
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Your proposal and PDF are ready to share."));
});

it("keeps a newly published version when a failed PDF's refresh is missing that version", async () => {
  const version = { ...pendingVersion, id: "version-2", path: `/proposal/${"b".repeat(64)}` };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ version }))
    .mockResolvedValueOnce(Response.json({ error: "PDF unavailable. Try again." }, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ versions: [pendingVersion] })));
  render(<StatefulPanel />);
  fireEvent.click(screen.getByRole("button", { name: "Publish latest changes" }));
  expect((await screen.findByRole("alert")).textContent).toContain("PDF unavailable");
  expect(screen.getByLabelText("Customer share link")).toHaveProperty("value", `${window.location.origin}${version.path}`);
  expect(screen.getByText(/Previous versions/).textContent).toContain("(1)");
});

it.each(["ready", "generating"] as const)("uses refreshed %s PDF status after a gateway error without retrying generation", async status => {
  const version = { ...pendingVersion, id: "version-2", path: `/proposal/${"b".repeat(64)}` };
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ version }))
    .mockResolvedValueOnce(new Response("<html>Gateway timeout</html>", { status: 504 }))
    .mockResolvedValueOnce(Response.json({ versions: [{ ...version, pdf_status: status }, pendingVersion] }));
  vi.stubGlobal("fetch", fetcher);
  const onBusyChange = vi.fn();
  render(<StatefulPanel onBusyChange={onBusyChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Publish latest changes" }));
  expect((await screen.findByRole("status")).textContent).toBe(status === "ready"
    ? "Your proposal and PDF are ready to share." : "Your link is ready. The PDF is still being prepared; check its status below.");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByLabelText("Customer share link")).toHaveProperty("value", `${window.location.origin}${version.path}`);
  expect(screen.getByText(/Previous versions/).textContent).toContain("(1)");
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
  fireEvent.click(screen.getByRole("button", { name: "Publish latest changes" }));
  await screen.findByRole("link", { name: "Download PDF" });
  expect(fetcher.mock.calls[0][0]).toBe(`${shared ? "/api/appraisals" : "/api/str/appraisals"}/appraisal/proposal/publish`);
  expect(screen.getByRole("link", { name: "Preview published version" }).getAttribute("href")).toBe(`${shared ? "/appraisals" : "/short-term-rentals/appraisals"}/appraisal/preview?version=${version.id}`);
});

it("requires the inline confirmation before revoking a version", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ revokedAt: "2026-10-15T00:00:00Z" }));
  vi.stubGlobal("fetch", fetcher);
  render(<StatefulPanel />);
  fireEvent.click(screen.getByRole("button", { name: "Revoke link" }));
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Keep link" }));
  expect(screen.queryByRole("button", { name: "Revoke access" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Revoke link" }));
  fireEvent.click(screen.getByRole("button", { name: "Revoke access" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Link revoked"));
  expect(screen.queryByLabelText("Customer share link")).toBeNull();
  expect(fetcher.mock.calls[0][0]).toBe("/api/str/appraisals/appraisal/proposal/revoke");
});

it("recovers after a failed render without requiring another published version", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(Response.json({ error: "The PDF could not be prepared; try again." }, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ versions: [{ ...pendingVersion, pdf_status: "failed" }] }))
    .mockResolvedValueOnce(Response.json({ status: "ready" }))
    .mockResolvedValueOnce(Response.json({ versions: [{ ...pendingVersion, pdf_status: "pending" }] })));
  render(<StatefulPanel />);
  fireEvent.click(screen.getByRole("button", { name: "Prepare PDF" }));
  const retry = await screen.findByRole("button", { name: "Retry PDF" });
  await waitFor(() => expect(retry.hasAttribute("disabled")).toBe(false));
  fireEvent.click(retry);
  await screen.findByRole("link", { name: "Download PDF" });
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Your proposal and PDF are ready to share."));
  expect(screen.queryByText(/Previous versions/)).toBeNull();
});

it("holds the parent busy through publishing and PDF preparation", async () => {
  let completePdf!: (value: Response) => void;
  const waitingPdf = new Promise<Response>(resolve => { completePdf = resolve; });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ version: pendingVersion })).mockReturnValueOnce(waitingPdf).mockResolvedValueOnce(Response.json({ versions: [{ ...pendingVersion, pdf_status: "ready" }] })));
  const onBusyChange = vi.fn();
  const { unmount } = render(<StatefulPanel onBusyChange={onBusyChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Publish latest changes" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(onBusyChange).toHaveBeenLastCalledWith(true);
  expect(screen.getByRole("button", { name: "Preparing PDF…" }).hasAttribute("disabled")).toBe(true);
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
  const downloads = screen.getAllByRole("link", { name: "Download PDF" });
  expect(downloads).toHaveLength(1);
  expect(downloads[0].getAttribute("href")).toBe(`/api/proposals/${"0".repeat(64)}/pdf`);
  expect(downloads[0].hasAttribute("download")).toBe(true);
  fireEvent.click(screen.getByText(/Previous versions/));
  expect(screen.getByRole("button", { name: "Prepare PDF" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Retry PDF" })).toBeTruthy();
});
