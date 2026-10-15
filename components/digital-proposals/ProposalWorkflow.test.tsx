// @vitest-environment jsdom
import { createRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createProposalFixture } from "@/lib/digital-proposals/fixtures";
import { DEFAULT_PROPOSAL_DRAFT, type ProposalDraft } from "@/lib/digital-proposals/template";
import type { ProposalWorkspace } from "@/lib/digital-proposals/workspace";
import { ProposalWorkflow, type ProposalWorkflowHandle } from "./ProposalWorkflow";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), share: vi.fn() }));
vi.mock("@/components/listings/UnsavedListingGuard", () => ({ UnsavedListingGuard: () => null }));
vi.mock("./MultiPageProposal", () => ({ MultiPageProposal: () => null }));
vi.mock("./ProposalActivity", () => ({ ProposalActivity: () => null }));
vi.mock("./ProposalAgentPicker", () => ({ ProposalAgentPicker: () => null }));
vi.mock("./ProposalWorkspaceControls", () => ({
  proposalFetch: mocks.fetch,
  ProposalDocumentsEditor: () => null,
  ProposalPagesEditor: ({ form, draft }: { form: UseFormReturn<ProposalDraft>; draft: ProposalDraft }) => <label>Include forecast<input type="checkbox" checked={draft.pages[2].enabled} onChange={event => form.setValue("pages.2.enabled", event.target.checked, { shouldDirty: true })} /></label>,
  ProposalSharePanel: ({ workspace, onBusyChange, onSave, disabled }: { disabled?: boolean; workspace: ProposalWorkspace; onBusyChange: (busy: boolean) => void; onSave: () => Promise<number | null> }) => <button disabled={disabled} onClick={async () => {
    onBusyChange(true);
    try { await onSave(); await mocks.share(); } finally { onBusyChange(false); }
  }}>Publish {workspace.sourceFingerprint}</button>,
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
  fireEvent.click(await screen.findByLabelText("Include forecast"));
  view.rerender(<ProposalWorkflow ref={ref} reportId="report" stage="share" refreshKey="customer-2" />);
  expect(screen.queryByRole("button", { name: /Publish/ })).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("Loading your proposal…");
  expect(await ref.current!.savePendingEdits()).toBe(false);
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  await act(async () => finishRefresh(workspace("new-customer")));
  await screen.findByRole("button", { name: "Publish new-customer" });
  expect(screen.queryByRole("button", { name: "Publish old-customer" })).toBeNull();
  view.rerender(<ProposalWorkflow ref={ref} reportId="report" stage="proposal" refreshKey="customer-2" />);
  expect((screen.getByLabelText("Include forecast") as HTMLInputElement).checked).toBe(false);
});

it("shows refresh failures without offering to publish the stale customer", async () => {
  mocks.fetch.mockResolvedValueOnce(workspace("old-customer")).mockRejectedValueOnce(new Error("Unable to refresh proposal. Reload to retry."));
  const view = render(<ProposalWorkflow reportId="report" stage="share" refreshKey="customer-1" />);
  await screen.findByRole("button", { name: "Publish old-customer" });
  view.rerender(<ProposalWorkflow reportId="report" stage="share" refreshKey="customer-2" />);
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Unable to refresh proposal"));
  expect(screen.queryByRole("button", { name: /Publish/ })).toBeNull();
});

it("shows resolved account cover copy without editable heading or subtitle inputs", async () => {
  const source = workspace("cover");
  source.assignment!.defaults.content.title = "A home at {{property.address}}";
  source.assignment!.defaults.content.introduction = "A proposal from {{agency.name}}";
  source.data!.recipient = { displayName: "Jordan Taylor" };
  source.draft!.content.title = "Unapproved cover override";
  mocks.fetch.mockResolvedValueOnce(source);
  render(<ProposalWorkflow reportId="report" stage="proposal" />);
  const cover = await screen.findByRole("group", { name: "Proposal introduction" });
  expect(cover.textContent).toContain(`A home at ${source.data!.property.address}`);
  expect(cover.textContent).toContain(`A proposal from ${source.data!.agency.name}`);
  expect(cover.textContent).toContain("prepared for Jordan Taylor");
  expect(cover.textContent).not.toContain("{{");
  expect(screen.queryByLabelText("Heading")).toBeNull();
  expect(screen.queryByLabelText("Subtitle")).toBeNull();
  expect(screen.queryByText("Unapproved cover override")).toBeNull();
});

it("preserves page choices after a failed save and disables edits during the request", async () => {
  let failSave!: (error: Error) => void;
  mocks.fetch.mockResolvedValueOnce(workspace("save"))
    .mockImplementationOnce(() => new Promise((_, reject) => { failSave = reject; }));
  render(<ProposalWorkflow reportId="report" stage="proposal" />);
  const choice = await screen.findByLabelText("Include forecast") as HTMLInputElement;
  fireEvent.click(choice);
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(choice.closest("fieldset")?.disabled).toBe(true));
  await act(async () => failSave(new Error("Save failed. Try again.")));
  expect(await screen.findByText("Save failed. Try again.")).toBeTruthy();
  expect(choice.checked).toBe(false);
  expect(choice.closest("fieldset")?.disabled).toBe(false);
  const payload = JSON.parse(mocks.fetch.mock.calls[1][1].body);
  expect(payload.draft.content).toEqual(DEFAULT_PROPOSAL_DRAFT.content);
  expect(payload.draft.pages[2].enabled).toBe(false);
});

it("keeps the workspace busy after saving until the sharing operation finishes", async () => {
  let finishSharing!: () => void;
  const onBusyChange = vi.fn();
  mocks.fetch.mockResolvedValueOnce(workspace("publish"))
    .mockResolvedValueOnce({ draft: structuredClone(DEFAULT_PROPOSAL_DRAFT), revision: 1 });
  mocks.share.mockImplementation(() => new Promise<void>(resolve => { finishSharing = resolve; }));
  const view = render(<ProposalWorkflow reportId="report" stage="share" onBusyChange={onBusyChange} />);
  fireEvent.click(await screen.findByRole("button", { name: "Publish publish" }));
  await waitFor(() => expect(mocks.share).toHaveBeenCalledOnce());
  expect(onBusyChange).toHaveBeenLastCalledWith(true);
  await act(async () => finishSharing());
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
  view.unmount();
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
});

it("blocks sharing while a navigation save is pending", async () => {
  let finishSave!: (value: { draft: ProposalDraft; revision: number }) => void;
  mocks.fetch.mockResolvedValueOnce(workspace("navigation"))
    .mockImplementationOnce(() => new Promise(resolve => { finishSave = resolve; }));
  const ref = createRef<ProposalWorkflowHandle>();
  render(<ProposalWorkflow ref={ref} reportId="report" stage="share" />);
  const share = await screen.findByRole("button", { name: "Publish navigation" });
  let saving!: Promise<boolean>;
  act(() => { saving = ref.current!.savePendingEdits(); });
  expect((share as HTMLButtonElement).disabled).toBe(true);
  await act(async () => { finishSave({ draft: structuredClone(DEFAULT_PROPOSAL_DRAFT), revision: 1 }); await saving; });
  expect((share as HTMLButtonElement).disabled).toBe(false);
});
