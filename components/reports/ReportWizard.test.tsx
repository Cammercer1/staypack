// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useImperativeHandle, type Ref, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { ReportWizard } from "./ReportWizard";

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/lib/reports/reportRequests", () => ({ reportRequest: vi.fn().mockResolvedValue({ agents: [] }), jsonRequest: vi.fn() }));
vi.mock("@/components/digital-proposals/ProposalWorkflow", () => ({
  ProposalWorkflow: ({ ref, onBusyChange, customerPanel }: { ref: Ref<{ savePendingEdits: () => Promise<boolean> }>; onBusyChange: (busy: boolean) => void; customerPanel?: ReactNode }) => {
    useImperativeHandle(ref, () => ({ savePendingEdits: async () => true }));
    return <>{customerPanel}<button onClick={() => onBusyChange(true)}>Begin publishing</button><button onClick={() => onBusyChange(false)}>Finish publishing</button></>;
  },
}));
afterEach(cleanup);

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
