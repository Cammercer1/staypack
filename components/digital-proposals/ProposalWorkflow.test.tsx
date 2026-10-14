// @vitest-environment jsdom
import { createRef } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createProposalFixture } from "@/lib/digital-proposals/fixtures";
import { DEFAULT_PROPOSAL_DRAFT } from "@/lib/digital-proposals/template";
import type { ProposalWorkspace } from "@/lib/digital-proposals/workspace";
import { ProposalWorkflow, type ProposalWorkflowHandle } from "./ProposalWorkflow";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/components/listings/UnsavedListingGuard", () => ({ UnsavedListingGuard: () => null }));
vi.mock("./MultiPageProposal", () => ({ MultiPageProposal: () => null }));
vi.mock("./ProposalActivity", () => ({ ProposalActivity: () => null }));
vi.mock("./ProposalAgentPicker", () => ({ ProposalAgentPicker: () => null }));
vi.mock("./ProposalWorkspaceControls", () => ({
  proposalFetch: mocks.fetch,
  ProposalDocumentsEditor: () => null,
  ProposalPagesEditor: () => null,
  ProposalSharePanel: ({ workspace }: { workspace: ProposalWorkspace }) => <button>Publish {workspace.sourceFingerprint}</button>,
}));
const workspace = (sourceFingerprint: string): ProposalWorkspace => ({
  sourceFingerprint, revision: 0, attachments: [], versions: [],
  data: createProposalFixture(), draft: structuredClone(DEFAULT_PROPOSAL_DRAFT),
  assignment: { name: "QA proposal", version: 1, defaults: structuredClone(DEFAULT_PROPOSAL_DRAFT) },
});
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

it("withholds sharing and saves until customer edits have refreshed the source, preserving draft edits", async () => {
  let finishRefresh!: (value: ProposalWorkspace) => void;
  mocks.fetch.mockResolvedValueOnce(workspace("old-customer"))
    .mockImplementationOnce(() => new Promise(resolve => { finishRefresh = resolve; }));
  const ref = createRef<ProposalWorkflowHandle>();
  const view = render(<ProposalWorkflow ref={ref} reportId="report" stage="proposal" refreshKey="customer-1" />);
  const heading = await screen.findByLabelText("Heading");
  fireEvent.change(heading, { target: { value: "Keep my introduction" } });
  view.rerender(<ProposalWorkflow ref={ref} reportId="report" stage="share" refreshKey="customer-2" />);
  expect(screen.queryByRole("button", { name: /Publish/ })).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("Loading your proposal…");
  expect(await ref.current!.savePendingEdits()).toBe(false);
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  await act(async () => finishRefresh(workspace("new-customer")));
  await screen.findByRole("button", { name: "Publish new-customer" });
  expect(screen.queryByRole("button", { name: "Publish old-customer" })).toBeNull();
  view.rerender(<ProposalWorkflow ref={ref} reportId="report" stage="proposal" refreshKey="customer-2" />);
  expect((screen.getByLabelText("Heading") as HTMLInputElement).value).toBe("Keep my introduction");
});

it("shows refresh failures without offering to publish the stale customer", async () => {
  mocks.fetch.mockResolvedValueOnce(workspace("old-customer")).mockRejectedValueOnce(new Error("Unable to refresh proposal. Reload to retry."));
  const view = render(<ProposalWorkflow reportId="report" stage="share" refreshKey="customer-1" />);
  await screen.findByRole("button", { name: "Publish old-customer" });
  view.rerender(<ProposalWorkflow reportId="report" stage="share" refreshKey="customer-2" />);
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Unable to refresh proposal"));
  expect(screen.queryByRole("button", { name: /Publish/ })).toBeNull();
});
