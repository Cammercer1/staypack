// @vitest-environment jsdom
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useForm, useWatch } from "react-hook-form";
import { AppraisalRoutes } from "@/components/appraisals/AppraisalRoutes";
import { DEFAULT_PROPOSAL_DRAFT, type ProposalDraft } from "@/lib/digital-proposals/template";
import { MAX_PROPOSAL_PDF_BYTES, type ProposalAttachment, type ProposalWorkspace } from "@/lib/digital-proposals/workspace";
import { ProposalDocumentsEditor } from "./ProposalDocumentsEditor";

const id = (index: number) => `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const documents = Array.from({ length: 21 }, (_, index) => ({ id: id(index + 1), name: `Document ${index + 1}.pdf`, byte_size: 2048 }));
const link = (index: number, label = `Link ${index}`): ProposalDraft["links"][number] => ({ id: id(index + 100), label, kind: "link", url: `https://agency.example/document-${index}` });

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function Editor({ initial = {}, attachments = [], disabled = false, onBusyChange, saved = true }: {
  initial?: Partial<ProposalDraft>; attachments?: ProposalAttachment[]; disabled?: boolean;
  onBusyChange?: (busy: boolean) => void; saved?: boolean;
}) {
  const form = useForm<ProposalDraft>({ defaultValues: { ...structuredClone(DEFAULT_PROPOSAL_DRAFT), ...initial } });
  const draft = useWatch({ control: form.control }) as ProposalDraft;
  const [workspace, setWorkspace] = useState<ProposalWorkspace>({ draft: null, revision: 1, sourceFingerprint: "test", versions: [], attachments });
  return <>
    <ProposalDocumentsEditor form={form} draft={draft} reportId={saved ? "test-report" : undefined}
      workspace={saved ? workspace : undefined} disabled={disabled} onBusyChange={onBusyChange}
      onWorkspaceChange={change => setWorkspace(current => ({ ...current, ...change }))} />
    <output data-testid="draft" hidden>{JSON.stringify(draft)}</output>
    <output data-testid="attachments" hidden>{JSON.stringify(workspace.attachments)}</output>
  </>;
}

function savedDraft(): ProposalDraft {
  return JSON.parse(screen.getByTestId("draft").textContent!);
}

function savedAttachments(): ProposalAttachment[] {
  return JSON.parse(screen.getByTestId("attachments").textContent!);
}

function fileInput(): HTMLInputElement {
  return screen.getByLabelText("Upload PDF · up to 4 MB");
}

function pdf(name = "Agreement.pdf") {
  return new File(["%PDF-1.7\nA sample agreement"], name, { type: "application/pdf" });
}

function openLink() {
  fireEvent.click(screen.getByRole("button", { name: "Add link" }));
  return screen.getByRole("dialog");
}

it("keeps a new link out of the draft until saved and discards cancelled edits", async () => {
  const existing = link(1, "Agency website");
  render(<Editor initial={{ links: [existing] }} />);
  let dialog = openLink();
  fireEvent.change(within(dialog).getByLabelText("Button label"), { target: { value: "Management agreement" } });
  fireEvent.change(within(dialog).getByLabelText("Link URL"), { target: { value: "https://sign.example/agreement" } });
  expect(savedDraft().links).toEqual([existing]);
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(savedDraft().links).toEqual([existing]);

  dialog = openLink();
  fireEvent.change(within(dialog).getByLabelText("Button label"), { target: { value: "Management agreement" } });
  fireEvent.change(within(dialog).getByLabelText("Link URL"), { target: { value: "https://sign.example/agreement" } });
  fireEvent.change(within(dialog).getByLabelText("Link type"), { target: { value: "sign" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Add link" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(savedDraft().links).toEqual([existing, expect.objectContaining({ label: "Management agreement", url: "https://sign.example/agreement", kind: "sign" })]);
});

it.each(["", "http://agency.example", "https://user:password@agency.example", "javascript:alert(1)"])("rejects an unsafe or incomplete action URL: %s", async url => {
  render(<Editor />);
  const dialog = openLink();
  fireEvent.change(within(dialog).getByLabelText("Button label"), { target: { value: "Read more" } });
  fireEvent.change(within(dialog).getByLabelText("Link URL"), { target: { value: url } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Add link" }));
  await waitFor(() => expect(within(dialog).getByLabelText("Link URL").getAttribute("aria-invalid")).toBe("true"));
  expect(savedDraft().links).toEqual([]);
  expect(screen.getByRole("dialog")).toBe(dialog);
});

it("edits a link in place, preserves neighbors, and restores a removed link in its original position", async () => {
  const initial = [link(1, "Agency website"), link(2, "Agreement"), link(3, "Property guide")];
  render(<Editor initial={{ links: initial }} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit Agreement" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Button label"), { target: { value: "Sign agreement" } });
  fireEvent.change(within(dialog).getByLabelText("Link type"), { target: { value: "sign" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save link" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  const updated = { ...initial[1], label: "Sign agreement", kind: "sign" };
  expect(savedDraft().links).toEqual([initial[0], updated, initial[2]]);
  fireEvent.click(screen.getByRole("button", { name: "Remove Sign agreement" }));
  expect(savedDraft().links).toEqual([initial[0], initial[2]]);
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect(savedDraft().links).toEqual([initial[0], updated, initial[2]]);
});

it("limits links to twelve while allowing existing links to be edited and removed", () => {
  render(<Editor initial={{ links: Array.from({ length: 12 }, (_, index) => link(index)) }} />);
  expect((screen.getByRole("button", { name: "Add link" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Edit Link 0" }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Remove Link 0" }));
  expect(savedDraft().links).toHaveLength(11);
  expect((screen.getByRole("button", { name: "Add link" }) as HTMLButtonElement).disabled).toBe(false);
});

it("caps included documents at twenty and frees a place when one is hidden", () => {
  render(<Editor attachments={documents} initial={{ attachmentIds: documents.slice(0, 20).map(item => item.id) }} />);
  const extra = screen.getByLabelText("Include Document 21.pdf") as HTMLInputElement;
  const first = screen.getByLabelText("Include Document 1.pdf") as HTMLInputElement;
  expect(extra.disabled).toBe(true);
  expect(first.disabled).toBe(false);
  expect(fileInput().disabled).toBe(true);
  fireEvent.click(first);
  expect(extra.disabled).toBe(false);
  fireEvent.click(extra);
  expect(savedDraft().attachmentIds).toEqual(documents.slice(1).map(item => item.id));
  expect(savedAttachments()).toEqual(documents);
});

it("prevents further uploads at the library limit without preventing inclusion changes", () => {
  const library = Array.from({ length: 50 }, (_, index) => ({ id: id(index + 1), name: `Document ${index + 1}.pdf`, byte_size: 2048 }));
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<Editor attachments={library} />);
  expect(fileInput().disabled).toBe(true);
  fireEvent.drop(screen.getByLabelText("Upload a proposal document"), { dataTransfer: { files: [pdf()], types: ["Files"] } });
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText("Include Document 1.pdf"));
  expect(savedDraft().attachmentIds).toEqual([library[0].id]);
});

it.each(["empty", "wrong type", "oversize"])("rejects an %s file before requesting an upload", async kind => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<Editor />);
  const file = kind === "empty" ? new File([], "Empty.pdf", { type: "application/pdf" })
    : kind === "wrong type" ? new File(["hello"], "Notes.txt", { type: "text/plain" }) : pdf();
  if (kind === "oversize") Object.defineProperty(file, "size", { value: MAX_PROPOSAL_PDF_BYTES + 1 });
  fireEvent.change(fileInput(), { target: { files: [file] } });
  await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/PDF|empty|4 MB/i));
  expect(fetchMock).not.toHaveBeenCalled();
  expect(savedDraft().attachmentIds).toEqual([]);
});

it("uploads a dropped PDF once, includes it, and releases busy state", async () => {
  const attachment = { id: id(30), name: "Agreement.pdf", byte_size: 28 };
  let finishUpload!: (value: Response) => void;
  const fetchMock = vi.fn<typeof fetch>(() => new Promise<Response>(resolve => { finishUpload = resolve; }));
  const onBusyChange = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<Editor attachments={[documents[0]]} initial={{ attachmentIds: [documents[0].id] }} onBusyChange={onBusyChange} />);
  const dropzone = screen.getByLabelText("Upload a proposal document");
  fireEvent.drop(dropzone, { dataTransfer: { files: [pdf()], types: ["Files"] } });
  fireEvent.drop(dropzone, { dataTransfer: { files: [pdf()], types: ["Files"] } });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/str/appraisals/test-report/proposal/attachments");
  expect(fileInput().disabled).toBe(true);
  expect(onBusyChange).toHaveBeenCalledWith(true);
  await act(async () => finishUpload({ ok: true, json: async () => ({ attachment }) } as Response));
  await waitFor(() => expect(savedDraft().attachmentIds).toEqual([documents[0].id, attachment.id]));
  expect(savedAttachments()).toEqual([documents[0], attachment]);
  expect(onBusyChange.mock.calls.map(([busy]) => busy)).toEqual([true, false]);
  expect(fileInput().disabled).toBe(false);
});

it.each(["lease", "sales"])("uses the unified upload and download endpoints for a %s appraisal", async () => {
  const attachment = { id: id(30), name: "Agreement.pdf", byte_size: 28 };
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ attachment }));
  vi.stubGlobal("fetch", fetchMock);
  render(<AppraisalRoutes><Editor attachments={[documents[0]]} /></AppraisalRoutes>);
  expect(screen.getByRole("link", { name: `Download ${documents[0].name}` }).getAttribute("href")).toBe(`/api/appraisals/test-report/proposal/attachments/${documents[0].id}`);
  fireEvent.change(fileInput(), { target: { files: [pdf()] } });
  await waitFor(() => expect(savedDraft().attachmentIds).toContain(attachment.id));
  expect(fetchMock.mock.calls[0][0]).toBe("/api/appraisals/test-report/proposal/attachments");
});

it("releases the parent lock when unmounting during an upload", async () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
  const onBusyChange = vi.fn();
  const { unmount } = render(<Editor onBusyChange={onBusyChange} />);
  fireEvent.change(fileInput(), { target: { files: [pdf()] } });
  await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(true));
  unmount();
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
});

it("preserves the draft after a failed upload and permits retrying the same file", async () => {
  const attachment = { id: id(30), name: "Agreement.pdf", byte_size: 28 };
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Document upload failed. Please try again." }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ attachment }) });
  const onBusyChange = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<Editor attachments={[documents[0]]} initial={{ attachmentIds: [documents[0].id] }} onBusyChange={onBusyChange} />);
  const file = pdf();
  fireEvent.change(fileInput(), { target: { files: [file] } });
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Document upload failed"));
  expect(savedDraft().attachmentIds).toEqual([documents[0].id]);
  expect(savedAttachments()).toEqual([documents[0]]);
  expect(fileInput().value).toBe("");
  expect(fileInput().disabled).toBe(false);
  fireEvent.change(fileInput(), { target: { files: [file] } });
  await waitFor(() => expect(savedDraft().attachmentIds).toContain(attachment.id));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(onBusyChange.mock.calls.map(([busy]) => busy)).toEqual([true, false, true, false]);
});

it("blocks portal edits and file drops when the parent becomes disabled", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const { rerender } = render(<Editor />);
  const dialog = openLink();
  fireEvent.change(within(dialog).getByLabelText("Button label"), { target: { value: "Guide" } });
  fireEvent.change(within(dialog).getByLabelText("Link URL"), { target: { value: "https://agency.example/guide" } });
  rerender(<Editor disabled />);
  expect((within(dialog).getByRole("button", { name: "Add link" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(within(dialog).getByRole("button", { name: "Add link" }));
  fireEvent.drop(screen.getByLabelText("Upload a proposal document"), { dataTransfer: { files: [pdf()], types: ["Files"] } });
  expect(savedDraft().links).toEqual([]);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("enables a hidden Next steps page without changing the page order or other content", () => {
  const pages = DEFAULT_PROPOSAL_DRAFT.pages.map(page => ({ ...page, enabled: page.kind === "next_steps" ? false : page.enabled }));
  render(<Editor initial={{ pages, links: [link(1)] }} />);
  fireEvent.click(screen.getByRole("button", { name: "Include Next steps" }));
  expect(savedDraft().pages).toEqual(pages.map(page => page.kind === "next_steps" ? { ...page, enabled: true } : page));
  expect(savedDraft().links).toEqual([link(1)]);
  expect(screen.queryByRole("button", { name: "Include Next steps" })).toBeNull();
});
