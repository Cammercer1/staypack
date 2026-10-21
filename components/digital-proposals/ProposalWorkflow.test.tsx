// @vitest-environment jsdom
import { createRef, type ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createProposalFixture } from "@/lib/digital-proposals/fixtures";
import { DEFAULT_PROPOSAL_DRAFT, type ProposalDraft } from "@/lib/digital-proposals/template";
import type { ProposalWorkspace } from "@/lib/digital-proposals/workspace";
import type { ProposalData } from "@/lib/digital-proposals/data";
import type { ProposalPhotoSelection } from "@/lib/digital-proposals/photos";
import { ProposalWorkflow, type ProposalWorkflowHandle } from "./ProposalWorkflow";
import { PROPOSAL_AUTOSAVE_DELAY, type SavedProposalDraft } from "./proposalDraftSaver";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), share: vi.fn(), activity: vi.fn() }));
vi.mock("@/components/listings/UnsavedListingGuard", () => ({ UnsavedListingGuard: () => null }));
vi.mock("./MultiPageProposal", () => ({ MultiPageProposal: ({ data, initialPage }: { data: ProposalData; initialPage?: string }) => <><output data-testid="preview-photos" data-initial-page={initialPage}>{JSON.stringify(data.property)}</output><output data-testid="preview-agents">{JSON.stringify(data.agents)}</output></> }));
vi.mock("./ProposalPhotoPicker", () => ({ ProposalPhotoPicker: ({ value, availablePhotos, onSave, onOpenChange, error }: {
  value: ProposalPhotoSelection; availablePhotos: string[]; onSave: (selection: ProposalPhotoSelection) => Promise<boolean>; onOpenChange: (open: boolean) => void; error?: string;
}) => <div role="dialog" aria-label="Proposal photos"><output data-testid="picker-selection">{JSON.stringify(value)}</output>
  <button onClick={async () => { if (await onSave({ heroImageUrl: availablePhotos[1], gallery: [availablePhotos[1]] })) onOpenChange(false); }}>Use second photo</button>
  <button onClick={() => onOpenChange(false)}>Cancel photos</button>{error && <p role="alert">{error}</p>}
</div> }));
vi.mock("./ProposalActivity", async () => {
  const { useEffect } = await import("react");
  return { ProposalActivity: () => {
    useEffect(() => { mocks.activity(); }, []);
    return <section aria-label="Proposal activity">Proposal opens and page views</section>;
  } };
});
vi.mock("./proposalFetch", () => ({ proposalFetch: mocks.fetch }));
vi.mock("./ProposalWorkspaceControls", async () => ({
  proposalFetch: mocks.fetch,
  ProposalDocumentsEditor: (await vi.importActual<typeof import("./ProposalDocumentsEditor")>("./ProposalDocumentsEditor")).ProposalDocumentsEditor,
  ProposalPagesEditor: ({ form, draft }: { form: UseFormReturn<ProposalDraft>; draft: ProposalDraft }) => <label>Include forecast<input type="checkbox" checked={draft.pages[2].enabled} onChange={event => form.setValue("pages.2.enabled", event.target.checked, { shouldDirty: true })} /></label>,
  ProposalSharePanel: ({ workspace, onBusyChange, onSave, disabled, customerPanel, onPreviewDraft, previewingDraft, draftPreview }: {
    disabled?: boolean; workspace: ProposalWorkspace; onBusyChange: (busy: boolean) => void; onSave: () => Promise<number | null>;
    customerPanel?: ReactNode; onPreviewDraft?: () => void; previewingDraft?: boolean; draftPreview?: ReactNode;
  }) => <section aria-label="Publish and share proposal">{customerPanel}<button disabled={disabled} onClick={async () => {
    onBusyChange(true);
    try { await onSave(); await mocks.share(); } finally { onBusyChange(false); }
  }}>Publish {workspace.sourceFingerprint}</button><button onClick={onPreviewDraft}>{previewingDraft ? "Close preview" : "Preview draft"}</button>{draftPreview}</section>,
}));
const workspace = (sourceFingerprint: string): ProposalWorkspace => ({
  sourceFingerprint, revision: 0, attachments: [], versions: [],
  data: createProposalFixture(), draft: structuredClone(DEFAULT_PROPOSAL_DRAFT),
  assignment: { name: "QA proposal", version: 1, defaults: structuredClone(DEFAULT_PROPOSAL_DRAFT) },
});
beforeEach(() => vi.resetAllMocks());
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("withholds sharing and saves until customer edits have refreshed the source, preserving draft edits", async () => {
  let finishRefresh!: (value: ProposalWorkspace) => void;
  mocks.fetch.mockResolvedValueOnce(workspace("old-customer"))
    .mockImplementationOnce(() => new Promise(resolve => { finishRefresh = resolve; }));
  const ref = createRef<ProposalWorkflowHandle>();
  const view = render(<ProposalWorkflow ref={ref} reportId="report" stage="proposal" refreshKey="customer-1" />);
  fireEvent.click(await screen.findByRole("button", { name: /Edit pages/ }));
  fireEvent.click(screen.getByLabelText("Include forecast"));
  view.rerender(<ProposalWorkflow ref={ref} reportId="report" stage="share" refreshKey="customer-2" />);
  expect(screen.queryByRole("button", { name: /Publish/ })).toBeNull();
  expect(screen.getByText("Loading your proposal…")).toBeTruthy();
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

it("keeps the cover card focused on choosing a photo, leaving agency wording to the preview", async () => {
  const source = workspace("cover");
  source.assignment!.defaults.content.title = "A home at {{property.address}}";
  source.assignment!.defaults.content.introduction = "A proposal from {{agency.name}}";
  source.data!.recipient = { displayName: "Jordan Taylor" };
  source.draft!.content.title = "Unapproved cover override";
  mocks.fetch.mockResolvedValueOnce(source);
  render(<ProposalWorkflow reportId="report" stage="proposal" />);
  const cover = await screen.findByRole("region", { name: "Proposal cover" });
  expect(within(cover).getByRole("heading", { name: "Cover photo" })).toBeTruthy();
  expect(within(cover).getByRole("img", { name: "Current proposal cover photo" }).getAttribute("src")).toBe(source.data!.property.heroImageUrl);
  expect(within(cover).getByRole("button", { name: "Change cover photo" })).toBeTruthy();
  expect(screen.queryByRole("group", { name: "Proposal introduction" })).toBeNull();
  expect(screen.queryByLabelText("Heading")).toBeNull();
  expect(screen.queryByLabelText("Subtitle")).toBeNull();
  expect(screen.queryByText("Unapproved cover override")).toBeNull();
});

it("preserves page choices after a failed save and disables edits during the request", async () => {
  let failSave!: (error: Error) => void;
  mocks.fetch.mockResolvedValueOnce(workspace("save"))
    .mockImplementationOnce(() => new Promise((_, reject) => { failSave = reject; }));
  render(<ProposalWorkflow reportId="report" stage="proposal" />);
  fireEvent.click(await screen.findByRole("button", { name: /Edit pages/ }));
  const choice = screen.getByLabelText("Include forecast") as HTMLInputElement;
  fireEvent.click(choice);
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(choice.closest("fieldset")?.disabled).toBe(true));
  expect((screen.getByRole("button", { name: "Close pages" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => failSave(new Error("Save failed. Try again.")));
  expect(await screen.findByText("Save failed. Try again.")).toBeTruthy();
  expect(within(screen.getByRole("dialog", { name: "Edit pages" })).getByRole("alert").textContent).toBe("Save failed. Try again.");
  expect(choice.checked).toBe(false);
  expect(choice.closest("fieldset")?.disabled).toBe(false);
  const payload = JSON.parse(mocks.fetch.mock.calls[1][1].body);
  expect(payload.draft.content).toEqual(DEFAULT_PROPOSAL_DRAFT.content);
  expect(payload.draft.pages[2].enabled).toBe(false);
});

it("keeps the workspace busy after saving until the sharing operation finishes", async () => {
  let finishSharing!: () => void;
  const onBusyChange = vi.fn();
  mocks.fetch.mockResolvedValueOnce({ ...workspace("publish"), draft: null })
    .mockResolvedValueOnce({ draft: structuredClone(DEFAULT_PROPOSAL_DRAFT), revision: 1 });
  mocks.share.mockImplementation(() => new Promise<void>(resolve => { finishSharing = resolve; }));
  const view = render(<ProposalWorkflow reportId="report" stage="share" onBusyChange={onBusyChange} />);
  fireEvent.click(await screen.findByRole("button", { name: "Publish publish" }));
  await waitFor(() => expect(mocks.share).toHaveBeenCalledOnce());
  expect(JSON.parse(mocks.fetch.mock.calls[1][1].body).revision).toBe(0);
  expect(onBusyChange).toHaveBeenLastCalledWith(true);
  expect(screen.getByRole("tab", { name: "Client activity" }).getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(screen.getByRole("tab", { name: "Client activity" }));
  expect(mocks.activity).not.toHaveBeenCalled();
  await act(async () => finishSharing());
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
  expect(screen.getByRole("tab", { name: "Client activity" }).getAttribute("aria-disabled")).not.toBe("true");
  view.unmount();
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
});

it("blocks sharing while a navigation save is pending", async () => {
  let finishSave!: (value: { draft: ProposalDraft; revision: number }) => void;
  mocks.fetch.mockResolvedValueOnce({ ...workspace("navigation"), draft: null })
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

it("saves proposal photos with the current revision and page edits, then refreshes the preview and reloads the selection", async () => {
  const source = workspace("photos");
  source.availablePhotos = [source.data!.property.heroImageUrl, "https://example.com/second.jpg"];
  let savedDraft: ProposalDraft | undefined;
  mocks.fetch.mockResolvedValueOnce(source).mockImplementationOnce(async (_url, options) => {
    const payload = JSON.parse(options.body);
    expect(payload.revision).toBe(0);
    savedDraft = payload.draft;
    return { draft: savedDraft, revision: 1 };
  });
  const view = render(<ProposalWorkflow reportId="report" stage="proposal" />);
  fireEvent.click(await screen.findByRole("button", { name: /Edit pages/ }));
  fireEvent.click(screen.getByLabelText("Include forecast"));
  fireEvent.click(screen.getByRole("button", { name: "Close pages" }));
  fireEvent.click(screen.getByRole("button", { name: "Change cover photo" }));
  fireEvent.click(screen.getByRole("button", { name: "Use second photo" }));
  await screen.findByText("Photos saved to this proposal. Preview updated.");
  expect(screen.queryByRole("dialog")).toBeNull();
  const preview = JSON.parse(screen.getByTestId("preview-photos").textContent!);
  expect(screen.getByTestId("preview-photos").getAttribute("data-initial-page")).toBe("property");
  expect(preview.heroImageUrl).toBe(source.availablePhotos[1]);
  expect(preview.gallery).toEqual([source.availablePhotos[1]]);
  expect(savedDraft!.pages[2].enabled).toBe(false);
  expect(mocks.fetch.mock.calls[1][0]).toBe("/api/str/appraisals/report/proposal");
  expect(mocks.fetch.mock.calls[1][1].method).toBe("PUT");
  view.unmount();
  mocks.fetch.mockResolvedValueOnce({ ...source, draft: savedDraft, revision: 1 });
  render(<ProposalWorkflow reportId="report" stage="proposal" />);
  fireEvent.click(await screen.findByRole("button", { name: "Change cover photo" }));
  expect(JSON.parse(screen.getByTestId("picker-selection").textContent!).heroImageUrl).toBe(source.availablePhotos[1]);
});

it("preserves saved gallery order when reopening the photo picker", async () => {
  const source = workspace("ordered-photos");
  source.draft!.propertyImages = { heroImageUrl: "https://example.com/cover.jpg", gallery: ["https://example.com/front.jpg", "https://example.com/cover.jpg"] };
  mocks.fetch.mockResolvedValueOnce(source);
  render(<ProposalWorkflow reportId="report" stage="proposal" />);
  fireEvent.click(await screen.findByRole("button", { name: "Change cover photo" }));
  expect(JSON.parse(screen.getByTestId("picker-selection").textContent!)).toEqual(source.draft!.propertyImages);
});

it("keeps the photo picker open on save failure without changing the preview, and allows retry", async () => {
  const source = workspace("photos");
  source.availablePhotos = [source.data!.property.heroImageUrl, "https://example.com/second.jpg"];
  mocks.fetch.mockResolvedValueOnce(source).mockRejectedValueOnce(new Error("Another tab saved this proposal. Reload before saving."))
    .mockResolvedValueOnce(source)
    .mockImplementationOnce(async (_url, options) => ({ draft: JSON.parse(options.body).draft, revision: 1 }));
  render(<ProposalWorkflow reportId="report" stage="proposal" />);
  fireEvent.click(await screen.findByRole("button", { name: "Change cover photo" }));
  fireEvent.click(screen.getByRole("button", { name: "Use second photo" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Another tab saved");
  expect(screen.getByRole("dialog", { name: "Proposal photos" })).toBeTruthy();
  expect(screen.queryByTestId("preview-photos")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Use second photo" }));
  await screen.findByText("Photos saved to this proposal. Preview updated.");
  expect(JSON.parse(screen.getByTestId("preview-photos").textContent!).heroImageUrl).toBe(source.availablePhotos[1]);
  expect(screen.queryByRole("dialog", { name: "Proposal photos" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
  expect(screen.getByRole("button", { name: "Change cover photo" })).toBeTruthy();
});

it("keeps agents, cover, documents and links on the main screen with only pages in a modal", async () => {
  mocks.fetch.mockResolvedValueOnce(workspace("simple"));
  const onContinue = vi.fn();
  render(<ProposalWorkflow reportId="report" stage="proposal" onContinue={onContinue} />);
  expect(await screen.findByRole("heading", { name: "Presented by" })).toBeTruthy();
  for (const name of ["Proposal agents", "Proposal cover", "Proposal documents", "Proposal links"]) {
    expect(screen.getByRole("region", { name })).toBeTruthy();
  }
  expect(screen.queryByText("Included in your proposal")).toBeNull();
  expect(screen.queryByRole("button", { name: /Customise proposal/ })).toBeNull();
  expect(screen.getByRole("button", { name: "Choose agents" })).toBeTruthy();
  expect(screen.getAllByLabelText("Upload PDF · up to 4 MB")).toHaveLength(1);
  expect(screen.getAllByRole("button", { name: "Add link" })).toHaveLength(1);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByLabelText("Include forecast")).toBeNull();
  expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  expect(screen.getByText("Saved")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Edit pages/ }));
  const dialog = screen.getByRole("dialog", { name: "Edit pages" });
  expect(within(dialog).getByLabelText("Include forecast")).toBeTruthy();
  expect(within(dialog).queryByRole("button", { name: "Pages" })).toBeNull();
  expect(within(dialog).queryByRole("button", { name: "Documents & links" })).toBeNull();
  expect(within(dialog).queryByRole("button", { name: "Add link" })).toBeNull();
  expect(within(dialog).queryByLabelText("Upload PDF · up to 4 MB")).toBeNull();
  expect(within(dialog).queryByRole("button", { name: "Choose agents" })).toBeNull();
  fireEvent.click(screen.getByLabelText("Include forecast"));
  fireEvent.click(screen.getByRole("button", { name: "Close pages" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByRole("button", { name: /Edit pages/ })).toBe(document.activeElement);
  expect(screen.getByText("Saving…")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Edit pages/ }));
  expect((screen.getByLabelText("Include forecast") as HTMLInputElement).checked).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Close pages" }));
  fireEvent.click(screen.getByRole("button", { name: /Continue to get link or PDF/ }));
  expect(onContinue).toHaveBeenCalledOnce();
});

it("uploads a document from the main screen while locking preview, page editing and Continue", async () => {
  const attachment = { id: "16a2c819-e94f-4217-a64f-90140c5d1659", name: "Agreement.pdf", byte_size: 28 };
  let finishUpload!: (value: { attachment: ProposalWorkspace["attachments"][number] }) => void;
  const onBusyChange = vi.fn();
  mocks.fetch.mockResolvedValueOnce(workspace("documents"))
    .mockImplementationOnce(() => new Promise(resolve => { finishUpload = resolve; }));
  render(<ProposalWorkflow reportId="report" stage="proposal" onBusyChange={onBusyChange} />);
  const input = await screen.findByLabelText("Upload PDF · up to 4 MB") as HTMLInputElement;
  const preview = screen.getByRole("button", { name: "Preview proposal" }) as HTMLButtonElement;
  const pages = screen.getByRole("button", { name: /Edit pages/ }) as HTMLButtonElement;
  const proceed = screen.getByRole("button", { name: /Continue to get link or PDF/ }) as HTMLButtonElement;
  const file = new File(["%PDF-1.7\nA sample agreement"], attachment.name, { type: "application/pdf" });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
  expect(mocks.fetch.mock.calls[1][0]).toBe("/api/str/appraisals/report/proposal/attachments");
  expect(mocks.fetch.mock.calls[1][1].method).toBe("POST");
  expect(mocks.fetch.mock.calls[1][1].body.get("file").name).toBe(attachment.name);
  expect(input.disabled).toBe(true);
  expect(preview.disabled).toBe(true);
  expect(pages.disabled).toBe(true);
  expect(proceed.disabled).toBe(true);
  expect(onBusyChange).toHaveBeenLastCalledWith(true);
  expect(screen.queryByRole("dialog")).toBeNull();
  await act(async () => finishUpload({ attachment }));
  expect((await screen.findByRole("checkbox", { name: "Include Agreement.pdf" }) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByRole("link", { name: "Download Agreement.pdf" }).getAttribute("href")).toBe(`/api/str/appraisals/report/proposal/attachments/${attachment.id}`);
  expect(input.disabled).toBe(false);
  expect(preview.disabled).toBe(false);
  expect(pages.disabled).toBe(false);
  expect(proceed.disabled).toBe(false);
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
  expect(screen.getByText("Saving…")).toBeTruthy();
});

it("lets users choose presenters directly, include their contact page, preview and save them", async () => {
  const source = workspace("presenters");
  const agent = { id: "eaf04b64-711d-4e5c-aa1c-57310e390e0c", name: "Alex Morgan", role: "Property specialist", phone: "0400000000", email: "alex@agency.example", photoUrl: "" };
  source.availableAgents = [agent];
  const nextSteps = source.draft!.pages.find(page => page.kind === "next_steps")!;
  nextSteps.enabled = false;
  mocks.fetch.mockResolvedValueOnce(source)
    .mockImplementationOnce(async (_url, options) => ({ draft: JSON.parse(options.body).draft, revision: 1 }));
  const view = render(<ProposalWorkflow reportId="report" stage="proposal" />);
  fireEvent.click(await screen.findByRole("button", { name: "Choose agents" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Attach Alex Morgan" }));
  fireEvent.click(screen.getByRole("button", { name: "Add agents" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByRole("button", { name: /Edit pages/ }).getAttribute("aria-expanded")).toBe("false");
  expect(screen.getByText("Alex Morgan")).toBeTruthy();
  expect(screen.getByText(/Property specialist · alex@agency.example · 0400000000/)).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Include Next steps" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Include Next steps" }));
  expect(screen.queryByRole("button", { name: "Include Next steps" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Preview proposal" }));
  expect(JSON.parse(screen.getByTestId("preview-agents").textContent!)).toEqual([{ name: agent.name, role: agent.role, phone: agent.phone, email: agent.email, photoUrl: agent.photoUrl }]);
  await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2), { timeout: 2000 });
  await screen.findByText("Saved");
  const savedDraft = JSON.parse(mocks.fetch.mock.calls[1][1].body).draft;
  expect(savedDraft.agentIds).toEqual([agent.id]);
  expect(savedDraft.pages.find((page: ProposalDraft["pages"][number]) => page.kind === "next_steps").enabled).toBe(true);
  view.unmount();
  mocks.fetch.mockResolvedValueOnce({ ...source, draft: savedDraft, revision: 1 });
  render(<ProposalWorkflow reportId="report" stage="proposal" />);
  expect(await screen.findByText("Alex Morgan")).toBeTruthy();
  expect(screen.getByText("Saved")).toBeTruthy();
});

it("keeps the share actions available while previewing the current draft", async () => {
  mocks.fetch.mockResolvedValueOnce(workspace("visible"));
  render(<ProposalWorkflow reportId="report" stage="share" />);
  fireEvent.click(await screen.findByRole("button", { name: "Preview draft" }));
  expect(screen.getByTestId("preview-photos")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Publish visible" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
  expect(screen.queryByTestId("preview-photos")).toBeNull();
  expect(screen.getByRole("button", { name: "Publish visible" })).toBeTruthy();
});

it("keeps sharing mounted while activity is refreshed each time its tab opens", async () => {
  mocks.fetch.mockResolvedValueOnce(workspace("tabs"));
  render(<ProposalWorkflow reportId="report" stage="share" customerPanel={<button>Add client</button>} />);
  const publish = await screen.findByRole("button", { name: "Publish tabs" });
  const customer = screen.getByRole("button", { name: "Add client" });
  expect(mocks.activity).not.toHaveBeenCalled();
  expect(within(screen.getByRole("region", { name: "Publish and share proposal" })).getByRole("button", { name: "Add client" })).toBe(customer);
  expect(screen.queryByRole("button", { name: "Edit photos" })).toBeNull();
  expect(screen.queryByText("Saved")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Preview draft" }));
  const preview = screen.getByTestId("preview-photos");
  fireEvent.click(screen.getByRole("tab", { name: "Client activity" }));
  expect(await screen.findByRole("region", { name: "Proposal activity" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Publish tabs" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Add client" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Close preview" })).toBeNull();
  expect(publish.isConnected).toBe(true);
  expect(preview.closest("[hidden]")).toBeTruthy();
  expect(mocks.activity).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("tab", { name: "Share proposal" }));
  expect(screen.getByRole("button", { name: "Publish tabs" })).toBe(publish);
  expect(screen.getByRole("button", { name: "Add client" })).toBe(customer);
  expect(screen.getByTestId("preview-photos")).toBe(preview);
  expect(screen.getByRole("button", { name: "Close preview" })).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "Client activity" }));
  await waitFor(() => expect(mocks.activity).toHaveBeenCalledTimes(2));
});

it("keeps page edits local until close, then autosaves without restoring an old success message", async () => {
  mocks.fetch.mockResolvedValueOnce(workspace("status"))
    .mockImplementation(async (_url, options) => { const { draft, revision } = JSON.parse(options.body); return { draft, revision: revision + 1 }; });
  render(<ProposalWorkflow reportId="report" stage="proposal" />);
  fireEvent.click(await screen.findByRole("button", { name: /Edit pages/ }));
  fireEvent.click(screen.getByLabelText("Include forecast"));
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText("Changes saved.");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: /Edit pages/ }));
  vi.useFakeTimers();
  expect((screen.getByLabelText("Include forecast") as HTMLInputElement).checked).toBe(false);
  fireEvent.click(screen.getByLabelText("Include forecast"));
  expect(screen.queryByText("Changes saved.")).toBeNull();
  await act(async () => { await vi.advanceTimersByTimeAsync(PROPOSAL_AUTOSAVE_DELAY * 2); });
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "Close pages" }));
  expect(screen.getByText("Saving…")).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(PROPOSAL_AUTOSAVE_DELAY); });
  expect(mocks.fetch).toHaveBeenCalledTimes(3);
  expect(JSON.parse(mocks.fetch.mock.calls[2][1].body).draft.pages.find((page: ProposalDraft["pages"][number]) => page.id === "forecast").enabled).toBe(true);
  expect(screen.getByText("Saved")).toBeTruthy();
  expect(screen.queryByText("Changes saved.")).toBeNull();
});

const documentsWorkspace = () => ({ ...workspace("autosave"), attachments: [
  { id: "16a2c819-e94f-4217-a64f-90140c5d1659", name: "Agreement.pdf", byte_size: 28 },
  { id: "5385bed2-472d-42b1-8438-f0bac965e10e", name: "Guide.pdf", byte_size: 28 },
] });

it("debounces committed document choices without publishing or interrupting further edits", async () => {
  const source = documentsWorkspace();
  let finish!: (saved: SavedProposalDraft) => void;
  mocks.fetch.mockResolvedValueOnce(source).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<ProposalWorkflow reportId="report" stage="proposal" />);
  const agreement = await screen.findByRole("checkbox", { name: "Include Agreement.pdf" }) as HTMLInputElement;
  const guide = screen.getByRole("checkbox", { name: "Include Guide.pdf" }) as HTMLInputElement;
  vi.useFakeTimers();
  fireEvent.click(agreement);
  await act(async () => { await vi.advanceTimersByTimeAsync(PROPOSAL_AUTOSAVE_DELAY - 100); });
  fireEvent.click(guide);
  await act(async () => { await vi.advanceTimersByTimeAsync(PROPOSAL_AUTOSAVE_DELAY - 1); });
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  expect(agreement.disabled).toBe(false);
  expect(guide.disabled).toBe(false);
  expect((screen.getByRole("button", { name: /Continue to get link or PDF/ }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText("Saving…")).toBeTruthy();
  const payload = JSON.parse(mocks.fetch.mock.calls[1][1].body);
  expect(payload).toMatchObject({ revision: 0, draft: { attachmentIds: source.attachments.map(item => item.id) } });
  await act(async () => finish({ draft: payload.draft, revision: 1 }));
  expect(screen.getByText("Saved")).toBeTruthy();
  expect((screen.getByRole("button", { name: /Continue to get link or PDF/ }) as HTMLButtonElement).disabled).toBe(false);
  expect(mocks.share).not.toHaveBeenCalled();
});

it("keeps an overlapping upload locked when the earlier autosave finishes", async () => {
  const source = documentsWorkspace();
  const attachment = { id: "921b9ce3-7464-4ee6-8b23-966436249d01", name: "Terms.pdf", byte_size: 28 };
  let finishSave!: (value: SavedProposalDraft) => void;
  let finishUpload!: (value: { attachment: ProposalWorkspace["attachments"][number] }) => void;
  const onBusyChange = vi.fn();
  mocks.fetch.mockResolvedValueOnce(source)
    .mockImplementationOnce(() => new Promise(resolve => { finishSave = resolve; }))
    .mockImplementationOnce(() => new Promise(resolve => { finishUpload = resolve; }));
  render(<ProposalWorkflow reportId="report" stage="proposal" onBusyChange={onBusyChange} />);
  const agreement = await screen.findByRole("checkbox", { name: "Include Agreement.pdf" }) as HTMLInputElement;
  const input = screen.getByLabelText("Upload PDF · up to 4 MB") as HTMLInputElement;
  vi.useFakeTimers();
  fireEvent.click(agreement);
  await act(async () => { await vi.advanceTimersByTimeAsync(PROPOSAL_AUTOSAVE_DELAY); });
  const submitted = JSON.parse(mocks.fetch.mock.calls[1][1].body).draft;
  fireEvent.change(input, { target: { files: [new File(["%PDF-1.7\nTerms"], attachment.name, { type: "application/pdf" })] } });
  expect(mocks.fetch).toHaveBeenCalledTimes(3);
  expect(input.disabled).toBe(true);
  await act(async () => finishSave({ draft: submitted, revision: 1 }));
  expect(input.disabled).toBe(true);
  expect(agreement.disabled).toBe(true);
  expect(onBusyChange).toHaveBeenLastCalledWith(true);
  await act(async () => finishUpload({ attachment }));
  expect(input.disabled).toBe(false);
  expect(agreement.checked).toBe(true);
  expect((screen.getByRole("checkbox", { name: "Include Terms.pdf" }) as HTMLInputElement).checked).toBe(true);
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
});

it("preserves edits made during autosave and flushes them with the returned revision before navigation", async () => {
  const source = documentsWorkspace();
  let first!: (saved: SavedProposalDraft) => void, second!: (saved: SavedProposalDraft) => void;
  mocks.fetch.mockResolvedValueOnce(source)
    .mockImplementationOnce(() => new Promise(resolve => { first = resolve; }))
    .mockImplementationOnce(() => new Promise(resolve => { second = resolve; }));
  const ref = createRef<ProposalWorkflowHandle>();
  render(<ProposalWorkflow ref={ref} reportId="report" stage="proposal" />);
  const agreement = await screen.findByRole("checkbox", { name: "Include Agreement.pdf" });
  const guide = screen.getByRole("checkbox", { name: "Include Guide.pdf" }) as HTMLInputElement;
  vi.useFakeTimers();
  fireEvent.click(agreement);
  await act(async () => { await vi.advanceTimersByTimeAsync(PROPOSAL_AUTOSAVE_DELAY); });
  const firstPayload = JSON.parse(mocks.fetch.mock.calls[1][1].body);
  fireEvent.click(guide);
  let navigation!: Promise<boolean>;
  act(() => { navigation = ref.current!.savePendingEdits(); });
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  await act(async () => first({ draft: firstPayload.draft, revision: 1 }));
  expect(guide.checked).toBe(true);
  expect(mocks.fetch).toHaveBeenCalledTimes(3);
  const secondPayload = JSON.parse(mocks.fetch.mock.calls[2][1].body);
  expect(secondPayload.revision).toBe(1);
  expect(secondPayload.draft.attachmentIds).toEqual(source.attachments.map(item => item.id));
  await act(async () => { second({ draft: secondPayload.draft, revision: 2 }); expect(await navigation).toBe(true); });
  await act(async () => { await vi.advanceTimersByTimeAsync(PROPOSAL_AUTOSAVE_DELAY * 2); });
  expect(mocks.fetch).toHaveBeenCalledTimes(3);
  expect(screen.getByText("Saved")).toBeTruthy();
});

it("pauses failed autosaves until Retry and keeps edits and the expected revision intact", async () => {
  mocks.fetch.mockResolvedValueOnce(documentsWorkspace())
    .mockRejectedValueOnce(new Error("Another tab saved this proposal. Reload before saving."))
    .mockResolvedValueOnce(documentsWorkspace())
    .mockImplementationOnce(async (_url, options) => ({ draft: JSON.parse(options.body).draft, revision: 1 }));
  render(<ProposalWorkflow reportId="report" stage="proposal" />);
  const agreement = await screen.findByRole("checkbox", { name: "Include Agreement.pdf" });
  vi.useFakeTimers();
  fireEvent.click(agreement);
  await act(async () => { await vi.advanceTimersByTimeAsync(PROPOSAL_AUTOSAVE_DELAY); });
  expect(screen.getByRole("alert").textContent).toContain("Another tab saved");
  fireEvent.click(screen.getByRole("checkbox", { name: "Include Guide.pdf" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(mocks.fetch).toHaveBeenCalledTimes(3);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Retry save" })); });
  const payload = JSON.parse(mocks.fetch.mock.calls[3][1].body);
  expect(payload.revision).toBe(0);
  expect(payload.draft.attachmentIds).toHaveLength(2);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByText("Saved")).toBeTruthy();
});

it("leaves temporary link input unsaved until Add link commits it", async () => {
  mocks.fetch.mockResolvedValueOnce(workspace("link"))
    .mockImplementationOnce(async (_url, options) => ({ draft: JSON.parse(options.body).draft, revision: 1 }));
  render(<ProposalWorkflow reportId="report" stage="proposal" />);
  fireEvent.click(await screen.findByRole("button", { name: "Add link" }));
  vi.useFakeTimers();
  fireEvent.change(screen.getByLabelText("Button label"), { target: { value: "Agency website" } });
  fireEvent.change(screen.getByLabelText("Link URL"), { target: { value: "https://agency.example" } });
  await act(async () => { await vi.advanceTimersByTimeAsync(PROPOSAL_AUTOSAVE_DELAY * 2); });
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  await act(async () => { fireEvent.click(within(screen.getByRole("dialog", { name: "Add a link" })).getByRole("button", { name: "Add link" })); });
  await act(async () => { await vi.advanceTimersByTimeAsync(PROPOSAL_AUTOSAVE_DELAY); });
  expect(JSON.parse(mocks.fetch.mock.calls[1][1].body).draft.links[0]).toMatchObject({ label: "Agency website", url: "https://agency.example" });
  expect(screen.getByText("Saved")).toBeTruthy();
});

it("waits for an in-flight draft save before refreshing a changed client", async () => {
  const source = documentsWorkspace();
  let finishSave!: (saved: SavedProposalDraft) => void, finishRefresh!: (value: ProposalWorkspace) => void;
  mocks.fetch.mockResolvedValueOnce(source)
    .mockImplementationOnce(() => new Promise(resolve => { finishSave = resolve; }))
    .mockImplementationOnce(() => new Promise(resolve => { finishRefresh = resolve; }));
  const ref = createRef<ProposalWorkflowHandle>();
  const view = render(<ProposalWorkflow ref={ref} reportId="report" stage="proposal" refreshKey="client-1" />);
  const agreement = await screen.findByRole("checkbox", { name: "Include Agreement.pdf" });
  vi.useFakeTimers();
  fireEvent.click(agreement);
  await act(async () => { await vi.advanceTimersByTimeAsync(PROPOSAL_AUTOSAVE_DELAY); });
  const saved = { draft: JSON.parse(mocks.fetch.mock.calls[1][1].body).draft, revision: 1 };
  view.rerender(<ProposalWorkflow ref={ref} reportId="report" stage="share" refreshKey="client-2" />);
  expect(screen.getByText("Loading your proposal…")).toBeTruthy();
  expect(await ref.current!.savePendingEdits()).toBe(false);
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  await act(async () => finishSave(saved));
  expect(mocks.fetch).toHaveBeenCalledTimes(3);
  await act(async () => finishRefresh({ ...source, ...saved, sourceFingerprint: "new-client" }));
  expect(screen.getByRole("button", { name: "Publish new-client" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Publish autosave" })).toBeNull();
  expect(mocks.share).not.toHaveBeenCalled();
});
