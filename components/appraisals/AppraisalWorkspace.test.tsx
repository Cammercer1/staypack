// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useImperativeHandle, type Ref, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { AppraisalWorkspace } from "./AppraisalWorkspace";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import type { WorkspaceAppraisal } from "@/lib/appraisals/workspaceTypes";
import type { LeaseAppraisalJob } from "@/lib/types";
import { editAppraisalEvidence } from "@/lib/appraisals/workspaceInputs";

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/str-appraisals/AppraisalCustomerPanel", () => ({ AppraisalCustomerPanel: () => <button>Edit customer</button> }));
vi.mock("@/components/str-appraisals/AppraisalArchiveControl", () => ({ AppraisalArchiveControl: () => null }));
vi.mock("@/components/digital-proposals/ProposalWorkflow", () => ({
  ProposalWorkflow: ({ ref, onBusyChange, customerPanel }: { ref: Ref<{ savePendingEdits: () => Promise<boolean> }>; onBusyChange: (busy: boolean) => void; customerPanel?: ReactNode }) => {
    useImperativeHandle(ref, () => ({ savePendingEdits: async () => true }));
    return <>{customerPanel}<p>Proposal editor</p><button onClick={() => onBusyChange(true)}>Begin publishing</button><button onClick={() => onBusyChange(false)}>Finish publishing</button></>;
  },
}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it.each(["lease", "sales"] as const)("%s: disables customer controls for the full sharing operation", async kind => {
  const fixture = createLintRegressionFixtures();
  const appraisal: WorkspaceAppraisal = { ...fixture.appraisal, kind, inputs_json: { version: 1, listing: fixture.listing }, input_revision: 1, document_revision: 1, document_json: fixture[kind].final_report_json };
  render(<AppraisalWorkspace initialAppraisal={appraisal} initialListing={fixture.listing} archived={false} />);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "4. Review & share" })); });
  const customer = screen.getByRole("button", { name: "Edit customer" });
  expect(customer.matches(":disabled")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Begin publishing" }));
  expect(customer.matches(":disabled")).toBe(true);
  expect((screen.getByRole("button", { name: "1. Property" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Finish publishing" }));
  expect(customer.matches(":disabled")).toBe(false);
});

it.each(["lease", "sales"] as const)("%s: waits between job polls when a pending response refreshes workspace state", async kind => {
  vi.useFakeTimers();
  const fixture = createLintRegressionFixtures();
  const appraisal: WorkspaceAppraisal = { ...fixture.appraisal, kind, inputs_json: { version: 1, listing: fixture.listing }, input_revision: 1, document_revision: 1, document_json: fixture[kind].final_report_json };
  const job: LeaseAppraisalJob = { id: "pending-job", agency_id: fixture.agency.id, listing_id: fixture.listing.id, created_by: null, status: "pending", attempts: 0, request_json: {}, result_json: null, error_message: null, started_at: null, heartbeat_at: null, completed_at: null, failed_at: null, created_at: fixture.listing.updated_at, updated_at: fixture.listing.updated_at };
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ listing: fixture.listing, job })).mockImplementation(() => new Promise<Response>(() => {}));
  vi.stubGlobal("fetch", fetcher);
  render(<AppraisalWorkspace initialAppraisal={appraisal} initialListing={fixture.listing} initialJob={job} archived={false} />);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "2. Review evidence" })); });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe(`/api/appraisals/${appraisal.report_id}/evidence/jobs/pending-job`);
  await act(async () => { await vi.advanceTimersByTimeAsync(1999); });
  expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it.each(["lease", "sales"] as const)("%s: keeps pending evidence in place until it is saved, then prepares with the saved revision", async kind => {
  const fixture = createLintRegressionFixtures();
  const appraisal: WorkspaceAppraisal = { ...fixture.appraisal, kind, inputs_json: { version: 1, listing: fixture.listing }, input_revision: 1, document_revision: 1, document_json: fixture[kind].final_report_json };
  const timestamp = "2026-10-15T12:00:00Z";
  const fetcher = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
    if (url.endsWith("/evidence/data")) {
      const body = JSON.parse(init.body as string);
      return Response.json({ listing: { ...editAppraisalEvidence(fixture.listing, kind, body), updated_at: timestamp } });
    }
    if (url.endsWith("/prepare")) return Response.json({ appraisal: { ...appraisal, input_revision: 2, document_revision: 2, updated_at: "2026-10-15T12:00:01Z" } });
    throw new Error(`Unexpected request ${url}`);
  });
  vi.stubGlobal("fetch", fetcher);
  render(<AppraisalWorkspace initialAppraisal={appraisal} initialListing={fixture.listing} archived={false} />);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "2. Review evidence" })); });
  const label = kind === "lease" ? "Weekly min ($)" : "Price min ($)";
  const value = kind === "lease" ? "1250" : "2450000";
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "1. Property" }));
  expect(screen.getByRole("alert").textContent).toContain("save your evidence changes");
  expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe(value);
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Continue to proposal" }));
  await screen.findByText("Proposal editor");
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ expected_updated_at: fixture.listing.updated_at, [kind === "lease" ? "weekly_min" : "price_min"]: Number(value) });
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ expected_updated_at: timestamp });
});

it.each(["lease", "sales"] as const)("%s: a failed evidence save keeps figures and selection available for retry", async kind => {
  const fixture = createLintRegressionFixtures();
  const appraisal: WorkspaceAppraisal = { ...fixture.appraisal, kind, inputs_json: { version: 1, listing: fixture.listing }, input_revision: 1, document_revision: 1, document_json: fixture[kind].final_report_json };
  const fetcher = vi.fn().mockImplementation(async () => Response.json({ error: "Unable to save evidence" }, { status: 500 }));
  vi.stubGlobal("fetch", fetcher);
  render(<AppraisalWorkspace initialAppraisal={appraisal} initialListing={fixture.listing} archived={false} />);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "2. Review evidence" })); });
  const label = kind === "lease" ? "Weekly min ($)" : "Price min ($)";
  const value = kind === "lease" ? "1250" : "2450000";
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: /20 Coast Street/ }));
  fireEvent.click(screen.getByRole("button", { name: "Continue to proposal" }));
  await waitFor(() => expect((screen.getByRole("button", { name: "3. Proposal" }) as HTMLButtonElement).disabled).toBe(false));
  expect(fetcher).toHaveBeenCalledOnce();
  expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe(value);
  expect(screen.getByRole("button", { name: /20 Coast Street/ }).getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(screen.getByRole("button", { name: "3. Proposal" }));
  expect(screen.getByRole("alert").textContent).toContain("save your evidence changes");
  expect(screen.queryByText("Proposal editor")).toBeNull();
});
