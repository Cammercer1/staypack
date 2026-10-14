// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AppraisalRoutes } from "@/components/appraisals/AppraisalRoutes";
import type { ProposalWorkspace } from "@/lib/digital-proposals/workspace";
import { ProposalSharePanel } from "./ProposalWorkspaceControls";

afterEach(cleanup);

it.each([false, true])("downloads the fixed published PDF in either appraisal workspace (shared=%s)", shared => {
  const versions: ProposalWorkspace["versions"] = ["ready", "pending", "failed", "revoked"].map((state, index) => ({
    id: `version-${index}`, path: `/proposal/${String(index).repeat(64)}`,
    draft_revision: index, created_at: "2026-10-14T00:00:00Z",
    revoked_at: state === "revoked" ? "2026-10-14T01:00:00Z" : null,
    pdf_status: state === "revoked" ? "ready" : state as "ready" | "pending" | "failed",
  }));
  const panel = <ProposalSharePanel reportId="appraisal" valid workspace={{ draft: null, revision: 5, sourceFingerprint: "current", versions, attachments: [] }} onSave={vi.fn()} onWorkspaceChange={vi.fn()} />;
  render(shared ? <AppraisalRoutes>{panel}</AppraisalRoutes> : panel);
  const downloads = screen.getAllByRole("link", { name: "Download appraisal PDF" });
  expect(downloads).toHaveLength(1);
  expect(downloads[0].getAttribute("href")).toBe(`/api/proposals/${"0".repeat(64)}/pdf`);
  expect(downloads[0].hasAttribute("download")).toBe(true);
  expect(screen.getByRole("button", { name: "Prepare PDF" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Retry PDF" })).toBeTruthy();
});
