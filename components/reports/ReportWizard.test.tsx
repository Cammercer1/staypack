// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useImperativeHandle, type Ref, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { ReportWizard } from "./ReportWizard";
import type { Report } from "@/lib/types";

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/lib/reports/reportRequests", () => ({ reportRequest: vi.fn().mockResolvedValue({ agents: [] }), jsonRequest: vi.fn() }));
vi.mock("@/components/digital-proposals/ProposalWorkflow", () => ({
  ProposalWorkflow: ({ ref, onBusyChange, customerPanel }: { ref: Ref<{ savePendingEdits: () => Promise<boolean> }>; onBusyChange: (busy: boolean) => void; customerPanel?: ReactNode }) => {
    useImperativeHandle(ref, () => ({ savePendingEdits: async () => true }));
    return <>{customerPanel}<button onClick={() => onBusyChange(true)}>Begin publishing</button><button onClick={() => onBusyChange(false)}>Finish publishing</button></>;
  },
}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("opens a published digital proposal on Get link or PDF without legacy report JSON", async () => {
  vi.stubGlobal("scrollTo", vi.fn());
  const fixture = createLintRegressionFixtures();
  // Digital publication does not change the legacy report status or snapshot.
  const report: Report = { ...fixture.report, status: "estimated", final_report_json: null };
  render(<ReportWizard initialListing={fixture.listing} initialReport={report} agency={fixture.agency} digitalProposal hasPublishedProposal customerPanel={<button>Edit customer</button>} />);
  await screen.findByRole("button", { name: "Edit customer" });
  expect(screen.getByRole("tab", { name: "Get link or PDF" }).getAttribute("aria-selected")).toBe("true");

  await act(async () => { fireEvent.click(screen.getByRole("tab", { name: "Review estimate" })); });
  await waitFor(() => expect(screen.getByRole("tab", { name: "Review estimate" }).getAttribute("aria-selected")).toBe("true"));
});

it("keeps an unpublished estimated proposal on Review estimate", async () => {
  const fixture = createLintRegressionFixtures();
  render(<ReportWizard initialListing={fixture.listing} initialReport={{ ...fixture.report, final_report_json: null }} agency={fixture.agency} digitalProposal />);
  await waitFor(() => expect(screen.getByRole("tab", { name: "Review estimate" }).getAttribute("aria-selected")).toBe("true"));
});

it("opens a new proposal on Confirm property", async () => {
  const fixture = createLintRegressionFixtures();
  render(<ReportWizard initialListing={fixture.listing} initialReport={{ ...fixture.report, final_report_json: null, final_estimate_json: null }} agency={fixture.agency} digitalProposal />);
  await waitFor(() => expect(screen.getByRole("tab", { name: "Confirm property" }).getAttribute("aria-selected")).toBe("true"));
});

it("honours an explicit property review when a proposal is published", async () => {
  const fixture = createLintRegressionFixtures();
  render(<ReportWizard initialListing={fixture.listing} initialReport={{ ...fixture.report, final_report_json: null }} agency={fixture.agency} digitalProposal hasPublishedProposal calculatorReview />);
  await waitFor(() => expect(screen.getByRole("tab", { name: "Confirm property" }).getAttribute("aria-selected")).toBe("true"));
});

it("disables STR customer controls throughout sharing, then enables them again", async () => {
  const fixture = createLintRegressionFixtures();
  render(<ReportWizard initialListing={fixture.listing} initialReport={fixture.report} agency={fixture.agency} digitalProposal customerPanel={<button>Edit customer</button>} />);
  const customer = await screen.findByRole("button", { name: "Edit customer" });
  expect(customer.matches(":disabled")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Begin publishing" }));
  await waitFor(() => expect(customer.matches(":disabled")).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: "Finish publishing" }));
  expect(customer.matches(":disabled")).toBe(false);
});

it("places client details in the final step and removes the duplicate property shortcut", async () => {
  vi.stubGlobal("scrollTo", vi.fn());
  const fixture = createLintRegressionFixtures();
  render(<ReportWizard initialListing={fixture.listing} initialReport={fixture.report} agency={fixture.agency} digitalProposal customerPanel={<button>Edit customer</button>} />);
  const customer = await screen.findByRole("button", { name: "Edit customer" });
  expect(customer.closest('[role="tabpanel"]')?.getAttribute("aria-labelledby")).toBe(screen.getByRole("tab", { name: "Get link or PDF" }).id);
  expect(screen.queryByRole("button", { name: "Edit property details" })).toBeNull();
  await act(async () => { fireEvent.click(screen.getByRole("tab", { name: "Check proposal" })); });
  await waitFor(() => expect(screen.getByRole("tab", { name: "Check proposal" }).getAttribute("aria-selected")).toBe("true"));
  expect(screen.queryByRole("button", { name: "Edit customer" })).toBeNull();
});
